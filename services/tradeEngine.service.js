// services/tradeEngine.service.js
"use strict";

const PaperTrade = require("../models/PaperTrade");
const m2Service = require("./m2.service"); // for RSI + LTP data
const fy = require("./fyersSdk"); // for quotes() -> live LTP

// Tunable concurrency values (safe defaults)
const AUTOENTER_CONCURRENCY = 6;
const CHECK_OPEN_CONCURRENCY = 8;

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
    console.error("[tradeEngine] fetchLTP error for", symbol, err?.message || err);
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
async function autoEnterOnSignal() {
  // run a fresh scan (M2)
  const scan = await m2Service.scanRSIEntryZone();
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
        // can't reliably enter without price
        console.warn("[tradeEngine] skipping entry - no entry price for", symbol);
        return null;
      }

      const qty = 1; // configurable later if you want

      const targetPrice = entryPrice * (1 + 1.5 / 100);
      const stopPrice = entryPrice * (1 - 0.75 / 100);

      // Re-check and create atomically-ish:
      // We attempt a final findOne to see if an OPEN trade got created while we fetched LTP.
      const alreadyOpenBeforeCreate = await PaperTrade.findOne({ symbol, status: "OPEN" }).lean();
      if (alreadyOpenBeforeCreate) return null;

      const tradeDoc = {
        symbol,
        entryPrice,
        qty,
        targetPrice,
        stopPrice,
        rsiAtEntry: sig.rsi,
        changePctAtEntry: sig.changePct,
        notes: "Auto-entry from RSI zone strategy"
      };

      const trade = await PaperTrade.create(tradeDoc);
      return trade;
    } catch (err) {
      console.error("[tradeEngine] autoEnter worker error for", sig?.symbol, err?.message || err);
      return null;
    }
  }

  // process signals with controlled concurrency
  const results = await asyncPool(signals, worker, AUTOENTER_CONCURRENCY);

  // filter created trades
  const createdTrades = results.filter(r => r != null);

  return { ok: true, created: createdTrades };
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

  const toClose = [];

  // worker checks a trade and returns closed trade object if closed
  async function worker(tr) {
    try {
      if (!tr || !tr.symbol) return null;
      const ltp = await fetchLTP(tr.symbol);
      if (ltp == null || !Number.isFinite(Number(ltp))) return null;

      let shouldClose = false;
      let exitReason = "";

      if (ltp >= tr.targetPrice) {
        shouldClose = true;
        exitReason = "TARGET";
      } else if (ltp <= tr.stopPrice) {
        shouldClose = true;
        exitReason = "STOPLOSS";
      }

      if (!shouldClose) return null;

      const pnlAbs = (ltp - tr.entryPrice) * tr.qty;
      const pnlPct = ((ltp - tr.entryPrice) / tr.entryPrice) * 100;

      // prepare updated doc
      return {
        _id: tr._id,
        exitPrice: ltp,
        exitTime: new Date(),
        pnlAbs,
        pnlPct,
        status: "CLOSED",
        notes: exitReason
      };
    } catch (err) {
      console.error("[tradeEngine] checkOpen worker error for", tr?.symbol, err?.message || err);
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
            notes: c.notes
          },
          { new: true }
        );
      } catch (err) {
        console.error("[tradeEngine] failed to persist closed trade", c._id, err?.message || err);
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
  const exitPx = (ltp != null && Number.isFinite(Number(ltp))) ? ltp : tr.entryPrice;

  const pnlAbs = (exitPx - tr.entryPrice) * tr.qty;
  const pnlPct = ((exitPx - tr.entryPrice) / tr.entryPrice) * 100;

  tr.exitPrice = exitPx;
  tr.exitTime = new Date();
  tr.pnlAbs = pnlAbs;
  tr.pnlPct = pnlPct;
  tr.status = "CLOSED";
  tr.notes = "MANUAL";

  await tr.save();
  return { ok: true, trade: tr };
}

module.exports = {
  autoEnterOnSignal,
  checkOpenTradesAndUpdate,
  getAllTrades,
  closeTradeManual
};
