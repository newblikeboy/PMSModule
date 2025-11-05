// services/tradeEngine.service.js
"use strict";

const PaperTrade = require("../models/PaperTrade");
const m2Service = require("./m2.service"); // for RSI + LTP data
const fy = require("./fyersSdk"); // for quotes() -> live LTP
const settingsService = require("./settings.service");
const angelOne = require("./angelOne.service");
const { env } = require("../config/env");
const logger = require("../config/logger");

// Tunable concurrency values (safe defaults)
const AUTOENTER_CONCURRENCY = 6;
const CHECK_OPEN_CONCURRENCY = 8;
const CONFIGURED_DEFAULT_QTY = Number(env.TRADE_DEFAULT_QTY);
const DEFAULT_ORDER_QTY =
  Number.isFinite(CONFIGURED_DEFAULT_QTY) && CONFIGURED_DEFAULT_QTY > 0
    ? Math.round(CONFIGURED_DEFAULT_QTY)
    : 1;

/**
 * small concurrency pool: runs workerFn(item) for each item, at most `concurrency` in flight.
 */
async function asyncPool(items, workerFn, concurrency = 5) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const p = (async () => workerFn(item))();
    results.push(p);
    executing.add(p);

    const cleanup = () => executing.delete(p);
    p.then(cleanup, cleanup);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

function resolveExecutionMode() {
  return settingsService.getExecutionMode();
}

function computeTargets(entryPrice) {
  const base = Number(entryPrice);
  if (!Number.isFinite(base)) {
    throw new Error("Cannot compute target/stop without a valid entry price");
  }
  const target = Number((base * (1 + 1.5 / 100)).toFixed(2));
  const stop = Number((base * (1 - 0.75 / 100)).toFixed(2));
  return { target, stop };
}

function isLiveMode(mode) {
  return mode === "LIVE";
}

function tagForNotes(mode, detail) {
  if (mode === "LIVE") {
    return `[LIVE] ${detail}`;
  }
  return `[PAPER] ${detail}`;
}

// helper: fetch live LTP for a symbol using fy.getQuotes()
// Robust to multiple possible FYERS shapes and defensive on errors.
async function fetchLTP(symbol) {
  try {
    const resp = await fy.getQuotes(symbol);
    const d = resp?.d ?? resp?.data ?? resp;

    // If array shape (common): try several nested places
    if (Array.isArray(d) && d.length > 0) {
      const tick = d[0];

      // try common properties in order of likelihood
      const candidates = [
        tick.ltp,
        tick.c,
        tick.v?.lp,
        tick.v?.last_price,
        tick.v?.lastPrice,
        tick.v?.last,
        tick.lp, // sometimes directly
        tick.last_price
      ];

      for (const c of candidates) {
        if (c != null && Number.isFinite(Number(c))) return Number(c);
      }

      // some providers wrap price under tick.v or tick.v.lp etc already checked; fallback to nested search
      if (tick.n && typeof tick === "object") {
        // try to find any numeric property quick scan
        for (const k of Object.keys(tick)) {
          const val = tick[k];
          if (val != null && Number.isFinite(Number(val))) return Number(val);
        }
      }

      return null;
    }

    // object shapes
    if (d && typeof d === "object") {
      const candidates = [
        d.ltp,
        d.c,
        d.last_price,
        d.lastPrice,
        d.v?.lp,
        d.v?.last_price,
        d.v?.lastPrice
      ];
      for (const c of candidates) {
        if (c != null && Number.isFinite(Number(c))) return Number(c);
      }
    }

    // fallback: try top level numeric
    if (resp != null && Number.isFinite(Number(resp))) return Number(resp);

    return null;
  } catch (err) {
    logger.error({ err, symbol }, "[tradeEngine] fetchLTP error");
    return null;
  }
}

/**
 * Create a new paper trade if:
 * - RSI signal says inEntryZone = true
 * - we don't already have an OPEN trade for that symbol
 *
 * Implementation notes:
 * - We process signals in controlled parallelism to speed up network/DB calls.
 * - Before creating we re-check for an OPEN trade to reduce races.
 */
async function autoEnterOnSignal(options = {}) {
  const executionMode = resolveExecutionMode();

  if (executionMode === "HALT") {
    return { ok: true, created: [], msg: "market halt active" };
  }

  if (executionMode === "DISABLED") {
    return { ok: true, created: [], msg: "trading disabled in settings" };
  }

  if (isLiveMode(executionMode) && !angelOne.isConfigured()) {
    const error = "Angel One credentials/configuration missing";
    logger.error({ error }, "[tradeEngine] Live trading unavailable");
    return { ok: false, created: [], error };
  }

  const refreshMovers = Boolean(options.refreshMovers);

  // run a fresh scan (M2)
  const scan = await m2Service.scanRSIEntryZone({ refreshMovers });
  if (!scan || !scan.ok || !Array.isArray(scan.data) || scan.data.length === 0) {
    return { ok: true, created: [], msg: "no signals" };
  }

  const signals = scan.data;

  // worker processes one signal
  async function worker(sig) {
    try {
      if (!sig || !sig.inEntryZone) return null;

      const symbol = sig.symbol;
      if (!symbol) return null;

      // quick check: is there already an OPEN trade? (avoid extra work)
      const alreadyOpen = await PaperTrade.findOne({ symbol, status: "OPEN" }).lean();
      if (alreadyOpen) return null;

      // Use LTP from scan if present, else fallback to fresh quotes
      let entryPrice = sig.ltp;
      if (entryPrice == null || !Number.isFinite(Number(entryPrice))) {
        entryPrice = await fetchLTP(symbol);
      }
      if (entryPrice == null || !Number.isFinite(Number(entryPrice))) {
        logger.warn({ symbol }, "[tradeEngine] skipping entry - no entry price");
        return null;
      }

      const qty = DEFAULT_ORDER_QTY;

      // Re-check to avoid race while fetching price
      const alreadyOpenBeforeCreate = await PaperTrade.findOne({ symbol, status: "OPEN" }).lean();
      if (alreadyOpenBeforeCreate) return null;

      let brokerOrderId = null;
      let executionEntryPrice = Number(entryPrice);

      if (isLiveMode(executionMode)) {
        try {
          const orderRes = await angelOne.placeOrder({
            symbol,
            qty,
            side: "BUY",
            orderType: "MARKET",
            productType: "INTRADAY",
            price: executionEntryPrice,
            tag: "RSI_AUTO_ENTRY"
          });
          brokerOrderId = orderRes.orderId || null;
          if (orderRes.price != null && Number.isFinite(Number(orderRes.price))) {
            executionEntryPrice = Number(orderRes.price);
          }
        } catch (err) {
          logger.error({ err, symbol }, "[tradeEngine] LIVE entry failed");
          return null;
        }
      }

      const { target, stop } = computeTargets(executionEntryPrice);

      const tradeDoc = {
        symbol,
        entryPrice: executionEntryPrice,
        qty,
        targetPrice: target,
        stopPrice: stop,
        rsiAtEntry: sig.rsi,
        changePctAtEntry: sig.changePct,
        executionMode,
        brokerOrderId,
        notes: tagForNotes(executionMode, "Auto-entry from RSI zone strategy")
      };

      const trade = await PaperTrade.create(tradeDoc);
      return trade;
    } catch (err) {
      logger.error({ err, symbol: sig?.symbol }, "[tradeEngine] autoEnter worker error");
      return null;
    }
  }

  // process signals with controlled parallelism
  const results = await asyncPool(signals, worker, AUTOENTER_CONCURRENCY);

  // filter created trades
  const createdTrades = results.filter(r => r != null);

  return { ok: true, created: createdTrades, mode: executionMode };
}

/**
 * Check all OPEN trades:
 * - get current LTP
 * - if LTP >= targetPrice → close as WIN
 * - if LTP <= stopPrice → close as LOSS
 *
 * Optimized to fetch LTPs in parallel with a concurrency limit and save updates in parallel.
 */
async function checkOpenTradesAndUpdate() {
  const openTrades = await PaperTrade.find({ status: "OPEN" }).lean();
  if (!Array.isArray(openTrades) || openTrades.length === 0) {
    return { ok: true, closed: [] };
  }

  async function worker(tr) {
    try {
      if (!tr || !tr.symbol) return null;

      const ltp = await fetchLTP(tr.symbol);
      if (ltp == null || !Number.isFinite(Number(ltp))) return null;

      const ltpNumber = Number(ltp);

      let shouldClose = false;
      let exitReason = "";

      if (ltpNumber >= tr.targetPrice) {
        shouldClose = true;
        exitReason = "TARGET";
      } else if (ltpNumber <= tr.stopPrice) {
        shouldClose = true;
        exitReason = "STOPLOSS";
      }

      if (!shouldClose) return null;

      const mode = tr.executionMode || "PAPER";
      let exitPrice = ltpNumber;
      let brokerExitOrderId = null;

      if (isLiveMode(mode)) {
        if (!angelOne.isConfigured()) {
          logger.error("[tradeEngine] cannot exit live trade - Angel One config missing");
          return null;
        }

        try {
          const exitRes = await angelOne.placeOrder({
            symbol: tr.symbol,
            qty: tr.qty,
            side: "SELL",
            orderType: "MARKET",
            productType: "INTRADAY",
            price: exitPrice,
            tag: `RSI_${exitReason}_EXIT`
          });
          brokerExitOrderId = exitRes.orderId || null;
          if (exitRes.price != null && Number.isFinite(Number(exitRes.price))) {
            exitPrice = Number(exitRes.price);
          }
        } catch (err) {
          logger.error({ err, symbol: tr.symbol }, "[tradeEngine] LIVE exit failed");
          return null;
        }
      }

      const pnlAbs = (exitPrice - tr.entryPrice) * tr.qty;
      const pnlPct = ((exitPrice - tr.entryPrice) / tr.entryPrice) * 100;

      // prepare updated doc
      return {
        _id: tr._id,
        exitPrice,
        exitTime: new Date(),
        pnlAbs,
        pnlPct,
        status: "CLOSED",
        notes: tagForNotes(mode, exitReason),
        brokerExitOrderId
      };
    } catch (err) {
      logger.error({ err, symbol: tr?.symbol }, "[tradeEngine] checkOpen worker error");
      return null;
    }
  }

  // process checks with concurrency
  const checks = await asyncPool(openTrades, worker, CHECK_OPEN_CONCURRENCY);

  // filter closures
  const closures = checks.filter(c => c != null);

  // Persist closures in parallel (controlled by same pool - reuse asyncPool)
  await asyncPool(
    closures,
    async (c) => {
      try {
        // use findByIdAndUpdate to ensure we update the correct trade
        await PaperTrade.findByIdAndUpdate(
          c._id,
          {
            exitPrice: c.exitPrice,
            exitTime: c.exitTime,
            pnlAbs: c.pnlAbs,
            pnlPct: c.pnlPct,
            status: c.status,
            notes: c.notes,
            brokerExitOrderId: c.brokerExitOrderId ?? null
          },
          { new: true }
        );
      } catch (err) {
        logger.error({ err, tradeId: c._id }, "[tradeEngine] failed to persist closed trade");
      }
    },
    CHECK_OPEN_CONCURRENCY
  );

  // For response, fetch the updated closed trades (optional) — but to keep behavior same, return the closures as-is.
  return { ok: true, closed: closures };
}

/**
 * Get trades list
 */
async function getAllTrades() {
  const trades = await PaperTrade.find().sort({ entryTime: -1 }).lean();
  return { ok: true, trades };
}

/**
 * Close a trade manually (force exit)
 */
async function closeTradeManual(tradeId) {
  const tr = await PaperTrade.findById(tradeId);
  if (!tr || tr.status === "CLOSED") {
    return { ok: false, error: "Trade not open / not found" };
  }

  const ltp = await fetchLTP(tr.symbol);
  let exitPx = (ltp != null && Number.isFinite(Number(ltp))) ? Number(ltp) : tr.entryPrice;
  let brokerExitOrderId = null;

  if (isLiveMode(tr.executionMode)) {
    if (!angelOne.isConfigured()) {
      return { ok: false, error: "Angel One not configured for live exits" };
    }

    try {
      const exitRes = await angelOne.placeOrder({
        symbol: tr.symbol,
        qty: tr.qty,
        side: "SELL",
        orderType: "MARKET",
        productType: "INTRADAY",
        price: exitPx,
        tag: "MANUAL_EXIT"
      });
      brokerExitOrderId = exitRes.orderId || null;
      if (exitRes.price != null && Number.isFinite(Number(exitRes.price))) {
        exitPx = Number(exitRes.price);
      }
    } catch (err) {
      return { ok: false, error: `Live exit failed: ${err?.message || err}` };
    }
  }

  const pnlAbs = (exitPx - tr.entryPrice) * tr.qty;
  const pnlPct = ((exitPx - tr.entryPrice) / tr.entryPrice) * 100;

  tr.exitPrice = exitPx;
  tr.exitTime = new Date();
  tr.pnlAbs = pnlAbs;
  tr.pnlPct = pnlPct;
  tr.status = "CLOSED";
  tr.notes = tagForNotes(tr.executionMode || "PAPER", "MANUAL EXIT");
  tr.brokerExitOrderId = brokerExitOrderId;

  await tr.save();
  return { ok: true, trade: tr };
}

module.exports = {
  autoEnterOnSignal,
  checkOpenTradesAndUpdate,
  getAllTrades,
  closeTradeManual
};
