// services/tradeEngine.service.js — CENTRALIZED QUEUED TRADE ENGINE
"use strict";

const { DateTime } = require("luxon");
const PaperTrade = require("../models/PaperTrade");
const User = require("../models/User");
const M2Signal = require("../models/M2Signal");
const fy = require("./fyersSdk");
const marketSocket = require("./marketSocket.service");
const angelTrade = require("./angel.trade.service");
const { getSettings } = require("./settings.service");
const { resolveToken } = require("./instruments.service");

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const CFG = {
  IST: "Asia/Kolkata",
  CUT_H: 14,
  CUT_M: 45,
  EXIT_CUT_H: 15,   // hard exit 15:20 IST
  EXIT_CUT_M: 20,
  TARGET_PCT: Number(process.env.TARGET_PCT) || 1.5,
  STOP_PCT: Number(process.env.STOP_PCT) || 0.75,
  LOCK_TIMEOUT_MS: 15000,
  SIGNAL_STALE_MS: 30 * 60 * 1000,   // 30 minutes
  TICK_THROTTLE_MS: 300,
  BO_TRAILING: Number(process.env.ANGEL_BO_TRAIL || 0), // trailing SL ticks for BO
};

const SIGNAL_QUERY = {
  inEntryZone: true,
  $or: [{ consumedAt: null }, { consumedAt: { $exists: false } }],
};

// ------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------
let activeSignal = null;
let currentTradeSymbol = null;
let tradeTickHandler = null;
let tickProcessing = false;
let lastTickRun = 0;
let tradeSubscriptionSymbol = null;
let autoRunTimer = null;

// ------------------------------------------------------------
// UTILS
// ------------------------------------------------------------
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function nowIST() {
  return DateTime.now().setZone(CFG.IST);
}

function isAfterCutoff() {
  const n = nowIST();
  return n.hour > CFG.CUT_H || (n.hour === CFG.CUT_H && n.minute >= CFG.CUT_M);
}

function isExitCutoff() {
  const n = nowIST();
  return n.hour > CFG.EXIT_CUT_H || (n.hour === CFG.EXIT_CUT_H && n.minute >= CFG.EXIT_CUT_M);
}

// ------------------------------------------------------------
// LTP HELPERS
// ------------------------------------------------------------
async function fetchBatchLTP(symbols = []) {
  if (!symbols.length) return {};
  try {
    const rows = await fy.getQuotes(symbols);
    const out = {};
    for (const r of rows || []) {
      const s = r?.symbol;
      const l = num(r?.ltp);
      if (s && l) out[s] = l;
    }
    return out;
  } catch {
    return {};
  }
}

async function getOptimizedLTPMap(symbols) {
  const out = {};
  const fallback = [];

  for (const s of symbols) {
    const tick = marketSocket.getLastTick(s);
    if (tick && num(tick.ltp)) {
      out[s] = tick.ltp;
    } else {
      fallback.push(s);
    }
  }

  if (fallback.length) {
    try {
      const viaApi = await fetchBatchLTP(fallback);
      Object.assign(out, viaApi);
    } catch (err) {
      console.warn("[TradeEngine] Fallback LTP failed:", err.message);
    }
  }

  return out;
}

async function fetchEntryPrice(symbol) {
  const map = await getOptimizedLTPMap([symbol]);
  return map[symbol];
}

// ------------------------------------------------------------
// LOCK SYSTEM — per-user guard
// ------------------------------------------------------------
const _locks = new Map();

function isLocked(uid) {
  const ts = _locks.get(uid);
  if (!ts) return false;
  if (Date.now() - ts > CFG.LOCK_TIMEOUT_MS) {
    _locks.delete(uid);
    return false;
  }
  return true;
}

function lock(uid) {
  _locks.set(uid, Date.now());
}

function unlock(uid) {
  _locks.delete(uid);
}

// ------------------------------------------------------------
// TRADE MODE + QTY
// ------------------------------------------------------------
function decideTradeMode(user, globalSettings) {
  if (globalSettings.marketHalt) return "off";

  const allowPaper = globalSettings.isPaperTradingActive !== false;
  const wantsLive = !!user.autoTradingEnabled;
  const userLiveOK = wantsLive && !!user.angelLiveEnabled;
  const globalLiveOK = !!globalSettings.isLiveExecutionAllowed;

  if (userLiveOK && globalLiveOK) return "live";
  return allowPaper ? "paper" : "off";
}

async function computeLiveQty(user, entryPrice) {
  const allowed = Number(user.angelAllowedMarginPct ?? 0.5);
  try {
    const funds = await angelTrade.getFunds(user._id);
    const avail = Number(funds.availableMargin || 0);
    const usable = avail * allowed;
    return Math.max(1, Math.floor(usable / entryPrice));
  } catch {
    return 1;
  }
}

async function hasOpenTrades() {
  return !!(await PaperTrade.exists({ status: "OPEN" }));
}

// ------------------------------------------------------------
// SIGNAL MANAGEMENT
// ------------------------------------------------------------
async function restoreSignalFromOpenTrades() {
  const open = await PaperTrade.findOne({ status: "OPEN" }).lean();
  if (open && open.signalId) {
    const sig = await M2Signal.findById(open.signalId).lean();
    if (sig) {
      activeSignal = sig;
      currentTradeSymbol = sig.symbol;
      return sig;
    }
  }
  return null;
}

function isSignalStale(signal) {
  const ts = new Date(signal.capturedAt || signal.updatedAt || Date.now()).getTime();
  return Date.now() - ts > CFG.SIGNAL_STALE_MS;
}

async function getActiveSignal() {
  if (activeSignal) {
    if (isSignalStale(activeSignal)) {
      await consumeActiveSignal("stale");
      return null;
    }
    return activeSignal;
  }
  const restored = await restoreSignalFromOpenTrades();
  if (restored) {
    await ensureTradeSubscription(restored.symbol);
    ensureTradeTickListener();
    return restored;
  }
  return null;
}

async function fetchNextSignal() {
  const sig = await M2Signal.findOne(SIGNAL_QUERY).sort({ capturedAt: 1, updatedAt: 1 }).lean();
  if (!sig) return null;

  if (isSignalStale(sig)) {
    await M2Signal.findByIdAndUpdate(sig._id, {
      $set: { consumedAt: new Date(), inEntryZone: false, updatedAt: new Date() },
    });
    return fetchNextSignal();
  }

  activeSignal = sig;
  return sig;
}

async function ensureSignalForEntry() {
  const existing = await getActiveSignal();
  if (existing) return existing;
  return fetchNextSignal();
}

async function consumeActiveSignal(reason = "completed") {
  if (!activeSignal) {
    await ensureTradeSubscription(null);
    detachTradeTickListener();
    return;
  }

  try {
    await M2Signal.findByIdAndUpdate(
      activeSignal._id,
      {
        $set: {
          consumedAt: new Date(),
          inEntryZone: false,
          updatedAt: new Date(),
          consumeReason: reason,
        },
      },
      { new: false }
    );
  } catch (err) {
    console.warn("[TradeEngine] consumeActiveSignal:", err.message);
  }

  activeSignal = null;
  currentTradeSymbol = null;
  await ensureTradeSubscription(null);
  detachTradeTickListener();
}

function scheduleNextAutoRun(delay = 1000) {
  if (autoRunTimer) clearTimeout(autoRunTimer);
  autoRunTimer = setTimeout(() => {
    autoRunTimer = null;
    autoEnterOnSignal()
      .catch((err) => console.error("[TradeEngine] auto run error:", err.message));
  }, delay);
}

// ------------------------------------------------------------
// MARKET SOCKET SUBSCRIPTIONS
// ------------------------------------------------------------
async function ensureTradeSubscription(symbol) {
  try {
    if (tradeSubscriptionSymbol && tradeSubscriptionSymbol !== symbol) {
      await marketSocket.unsubscribe([tradeSubscriptionSymbol], "trade-engine");
      tradeSubscriptionSymbol = null;
    }

    if (symbol && tradeSubscriptionSymbol !== symbol) {
      await marketSocket.subscribe([symbol], "trade-engine");
      tradeSubscriptionSymbol = symbol;
    } else if (!symbol) {
      tradeSubscriptionSymbol = null;
    }
  } catch (err) {
    console.warn("[TradeEngine] socket subscription error:", err.message);
  }
}

function ensureTradeTickListener() {
  if (tradeTickHandler) return;
  tradeTickHandler = (tick) => {
    handleTradeTick(tick).catch((err) =>
      console.warn("[TradeEngine] tick handler error:", err.message)
    );
  };
  marketSocket.on("tick", tradeTickHandler);
}

function detachTradeTickListener() {
  if (!tradeTickHandler) return;
  marketSocket.off("tick", tradeTickHandler);
  tradeTickHandler = null;
}

async function handleTradeTick(tick) {
  if (!currentTradeSymbol || tick.symbol !== currentTradeSymbol) return;
  const ltp = num(tick.ltp);
  if (!ltp) return;

  const now = Date.now();
  if (now - lastTickRun < CFG.TICK_THROTTLE_MS) return;
  lastTickRun = now;

  if (tickProcessing) return;
  tickProcessing = true;
  try {
    await processTradeTick(tick.symbol, ltp);
  } finally {
    tickProcessing = false;
  }
}

async function processTradeTick(symbol, ltp) {
  const openTrades = await PaperTrade.find({ symbol, status: "OPEN" });
  if (!openTrades.length) {
    await handleTradesCompletionIfAny();
    return;
  }

  const isCutoffExit = isExitCutoff();
  const stayers = [];
  const closers = [];

  for (const trade of openTrades) {
    const pnlAbs = (ltp - trade.entryPrice) * trade.qty;
    const pnlPct = (pnlAbs / trade.entryPrice) * 100;

    let reason = null;
    if (isCutoffExit) reason = "CUTOFF";
    else if (ltp >= trade.targetPrice) reason = "TARGET";
    else if (ltp <= trade.stopPrice) reason = "STOPLOSS";

    if (reason) {
      closers.push({ tradeId: trade._id, pnlAbs, pnlPct, reason });
    } else {
      stayers.push({
        updateOne: {
          filter: { _id: trade._id, status: "OPEN" },
          update: {
            $set: {
              pnlAbs: Number(pnlAbs.toFixed(2)),
              pnlPct: Number(pnlPct.toFixed(2)),
              updatedAt: new Date(),
            },
          },
        },
      });
    }
  }

  if (stayers.length) {
    await PaperTrade.bulkWrite(stayers, { ordered: false });
  }

  if (closers.length) {
    const closeOps = closers.map((c) => ({
      updateOne: {
        filter: { _id: c.tradeId, status: "OPEN" },
        update: {
          $set: {
            exitPrice: ltp,
            exitTime: new Date(),
            pnlAbs: Number(c.pnlAbs.toFixed(2)),
            pnlPct: Number(c.pnlPct.toFixed(2)),
            notes: c.reason,
            status: "CLOSED",
            updatedAt: new Date(),
          },
        },
      },
    }));
    await PaperTrade.bulkWrite(closeOps, { ordered: false });
    await handleTradesCompletionIfAny();
  }
}

async function handleTradesCompletionIfAny() {
  const remaining = await PaperTrade.countDocuments({ status: "OPEN" });
  if (remaining === 0) {
    await consumeActiveSignal();
    scheduleNextAutoRun(1000);
  }
}

// ------------------------------------------------------------
// ENTRY ENGINE
// ------------------------------------------------------------
async function tryEnterTrade(user, signal, entryPrice, settings) {
  if (isAfterCutoff()) return { ok: true, msg: "cutoff passed" };

  const mode = decideTradeMode(user, settings);
  if (mode === "off") return { ok: true, msg: "engine disabled" };

  const existing = await PaperTrade.findOne({ userId: user._id, status: "OPEN" });
  if (existing) return { ok: true, msg: "user already has open trade" };

  let qty = 1;
  if (mode === "live") {
    qty = await computeLiveQty(user, entryPrice);
    if (qty < 1) return { ok: false, error: "insufficient margin" };
  }

  const base = {
    userId: user._id,
    signalId: signal._id,
    signalCapturedAt: signal.capturedAt || signal.updatedAt || new Date(),
    symbol: signal.symbol,
    qty,
    entryPrice,
    targetPrice: Number((entryPrice * (1 + CFG.TARGET_PCT / 100)).toFixed(2)),
    stopPrice: Number((entryPrice * (1 - CFG.STOP_PCT / 100)).toFixed(2)),
    entryTime: new Date(),
    tradeMode: mode,
    rsiAtEntry: signal.rsi,
    status: "OPEN",
  };

  if (mode === "paper") {
    const doc = await PaperTrade.create(base);
    return { ok: true, trade: doc };
  }

  const token = await resolveToken(signal.symbol);
  if (!token) {
    console.warn("[TradeEngine] LIVE order blocked: symboltoken missing", {
      symbol: signal.symbol,
      userId: String(user._id),
    });
    return { ok: false, error: "symboltoken missing" };
  }

  const targetDiff = Number((base.targetPrice - entryPrice).toFixed(2));
  const stopDiff = Number((entryPrice - base.stopPrice).toFixed(2));
  if (!(targetDiff > 0 && stopDiff > 0)) {
    console.warn("[TradeEngine] LIVE order blocked: invalid target/stop deltas", {
      symbol: signal.symbol,
      targetDiff,
      stopDiff,
    });
    return { ok: false, error: "invalid target/stop" };
  }

  const bracket = {
    squareoff: targetDiff,
    stoploss: stopDiff,
    trailingStopLoss: CFG.BO_TRAILING > 0 ? Number(CFG.BO_TRAILING.toFixed(2)) : undefined,
  };

  console.info("[TradeEngine] LIVE BO order request", {
    userId: String(user._id),
    symbol: signal.symbol,
    token,
    qty,
    bracket,
  });

  let placed = await angelTrade.placeMarketOrder({
    userId: user._id,
    symbol: signal.symbol,
    symboltoken: token,
    qty,
    side: "BUY",
    bracket,
  });

  if (!placed?.ok) {
    console.warn("[TradeEngine] Live buy failed, retrying once...", {
      symbol: signal.symbol,
      token,
      qty,
      bracket,
      error: placed?.error,
    });
    placed = await angelTrade.placeMarketOrder({
      userId: user._id,
      symbol: signal.symbol,
      symboltoken: token,
      qty,
      side: "BUY",
      bracket,
    });
  }

  if (!placed?.ok) {
    console.warn("[TradeEngine] Live buy failed after retry", {
      symbol: signal.symbol,
      token,
      qty,
      bracket,
      error: placed?.error,
    });
    return { ok: false, error: placed?.error || "live order failed" };
  }

  console.info("[TradeEngine] LIVE order placed", {
    symbol: signal.symbol,
    qty,
    bracket,
    orderId: placed.orderId || placed?.raw?.data?.orderid || placed?.raw?.orderid,
  });

  const liveDoc = await PaperTrade.create({
    ...base,
    broker: "ANGEL_ONE",
    brokerOrderId: placed.orderId,
  });

  return { ok: true, trade: liveDoc };
}

async function autoEnterOnSignal(userId = null) {
  if (isAfterCutoff()) return { ok: true, msg: "cutoff passed" };

  const tradeRunning = await hasOpenTrades();
  if (tradeRunning) {
    ensureTradeTickListener();
    await ensureTradeSubscription(currentTradeSymbol);
    return { ok: true, msg: "trade already active" };
  }

  const signal = await ensureSignalForEntry();
  if (!signal) return { ok: true, msg: "no pending signals" };

  const entryPrice = await fetchEntryPrice(signal.symbol);
  if (!entryPrice) return { ok: false, error: "LTP unavailable" };

  currentTradeSymbol = signal.symbol;
  await ensureTradeSubscription(signal.symbol);
  ensureTradeTickListener();

  const settings = getSettings();

  if (userId) {
    const uid = String(userId);
    if (isLocked(uid)) return { ok: true, msg: "locked" };

    lock(uid);
    try {
      const user = await User.findById(uid).lean();
      if (!user) return { ok: false, error: "user not found" };
      const result = await tryEnterTrade(user, signal, entryPrice, settings);
      return { ...result, signal: signal.symbol };
    } finally {
      unlock(uid);
    }
  }

  const users = await User.find().lean();
  const out = [];

  for (const user of users) {
    const uid = String(user._id);
    if (isLocked(uid)) {
      out.push({ userId: uid, msg: "locked" });
      continue;
    }

    lock(uid);
    try {
      const res = await tryEnterTrade(user, signal, entryPrice, settings);
      out.push({ userId: uid, ...res });
    } catch (err) {
      out.push({ userId: uid, ok: false, error: err.message });
    } finally {
      unlock(uid);
    }
  }

  if (!out.some((r) => r.trade)) {
    console.warn("[TradeEngine] Signal", signal.symbol, "produced no trades.");
  }

  return {
    ok: true,
    signal: { id: signal._id, symbol: signal.symbol, entryPrice },
    results: out,
  };
}

// ------------------------------------------------------------
// FALLBACK EXIT ENGINE
// ------------------------------------------------------------
async function tryExitTradesForUser(userId) {
  const open = await PaperTrade.find({ userId, status: "OPEN" }).lean();
  if (!open.length) return { ok: true, closed: [] };

  const symbols = [...new Set(open.map((t) => t.symbol))];
  const ltpMap = await getOptimizedLTPMap(symbols);

  const closed = [];
  const isCutoffExit = isExitCutoff();

  for (const trade of open) {
    const ltp = num(ltpMap[trade.symbol]);
    if (!ltp) continue;

    let reason = "";
    if (isCutoffExit) reason = "CUTOFF";
    else if (ltp >= trade.targetPrice) reason = "TARGET";
    else if (ltp <= trade.stopPrice) reason = "STOPLOSS";

    if (!reason) continue;

    const pnlAbs = (ltp - trade.entryPrice) * trade.qty;
    const pnlPct = (pnlAbs / trade.entryPrice) * 100;

    await PaperTrade.findByIdAndUpdate(trade._id, {
      $set: {
        exitPrice: ltp,
        exitTime: new Date(),
        pnlAbs: Number(pnlAbs.toFixed(2)),
        pnlPct: Number(pnlPct.toFixed(2)),
        notes: reason,
        status: "CLOSED",
        updatedAt: new Date(),
      },
    });
    closed.push({ ...trade, exitPrice: ltp, pnlAbs, pnlPct, reason });
  }

  if (closed.length) await handleTradesCompletionIfAny();
  return { ok: true, closed };
}

async function checkOpenTradesAndUpdate(userId = null) {
  if (userId) return tryExitTradesForUser(userId);

  const rows = await PaperTrade.aggregate([
    { $match: { status: "OPEN" } },
    { $group: { _id: "$userId" } },
    { $limit: 500 },
  ]);

  const out = [];
  for (const row of rows) {
    const uid = String(row._id);
    const result = await tryExitTradesForUser(uid);
    out.push({ userId: uid, ...result });
  }
  return { ok: true, results: out };
}

// ------------------------------------------------------------
// REAL-TIME USER + GLOBAL PNL
// ------------------------------------------------------------
async function getLivePnLSnapshot(userId = null) {
  const sod = new Date(new Date().setHours(0, 0, 0, 0));

  if (userId) {
    const [open, closed] = await Promise.all([
      PaperTrade.find({ userId, status: "OPEN" }).lean(),
      PaperTrade.find({ userId, status: "CLOSED", exitTime: { $gte: sod } }).lean(),
    ]);

    const symbols = [...new Set(open.map((t) => t.symbol))];
    const ltpMap = await getOptimizedLTPMap(symbols);

    const openMapped = open.map((t) => {
      const ltp = num(ltpMap[t.symbol]);
      const pnlAbs = ltp ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = pnlAbs != null ? (pnlAbs / t.entryPrice) * 100 : null;
      return { ...t, ltp, pnlAbs, pnlPct };
    });

    const unrealized = openMapped.reduce((sum, t) => sum + (t.pnlAbs || 0), 0);
    const realized = closed.reduce((sum, t) => sum + (t.pnlAbs || 0), 0);

    return {
      ok: true,
      open: openMapped,
      totals: {
        unrealizedPnlAbs: unrealized,
        realizedToday: realized,
        netToday: realized + unrealized,
      },
    };
  }

  const [openTrades, closedTrades] = await Promise.all([
    PaperTrade.find({ status: "OPEN" }).lean(),
    PaperTrade.find({ status: "CLOSED", exitTime: { $gte: sod } }).lean(),
  ]);

  const symbols = [...new Set(openTrades.map((t) => t.symbol))];
  const ltpMap = await getOptimizedLTPMap(symbols);

  const grouped = new Map();

  for (const trade of openTrades) {
    const uid = String(trade.userId);
    if (!grouped.has(uid)) grouped.set(uid, []);
    grouped.get(uid).push(trade);
  }

  const results = [];

  for (const [uid, trades] of grouped.entries()) {
    const mapped = trades.map((t) => {
      const ltp = num(ltpMap[t.symbol]);
      const pnlAbs = ltp ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = pnlAbs != null ? (pnlAbs / t.entryPrice) * 100 : null;
      return { ...t, ltp, pnlAbs, pnlPct };
    });

    const realized = closedTrades
      .filter((t) => String(t.userId) === uid)
      .reduce((sum, t) => sum + (t.pnlAbs || 0), 0);

    const unrealized = mapped.reduce((sum, t) => sum + (t.pnlAbs || 0), 0);

    results.push({
      userId: uid,
      open: mapped,
      totals: {
        unrealizedPnlAbs: unrealized,
        realizedToday: realized,
        netToday: realized + unrealized,
      },
    });
  }

  return { ok: true, results };
}

// ------------------------------------------------------------
// ADMIN: ALL TRADES + REALTIME PNL
// ------------------------------------------------------------
async function getAllTrades(options = {}) {
  try {
    const query = {};
    if (options.start || options.end) {
      query.entryTime = {};
      if (options.start) query.entryTime.$gte = options.start;
      if (options.end) query.entryTime.$lte = options.end;
    }

    const trades = await PaperTrade.find(query).sort({ entryTime: -1 }).lean();
    const symbols = [...new Set(trades.map((t) => t.symbol))];
    const ltpMap = await getOptimizedLTPMap(symbols);

    const enriched = trades.map((t) => {
      const ltp = num(ltpMap[t.symbol]);
      const isOpen = t.status === "OPEN";

      let pnlAbs = t.pnlAbs;
      let pnlPct = t.pnlPct;

      if (isOpen && ltp) {
        pnlAbs = (ltp - t.entryPrice) * t.qty;
        pnlPct = (pnlAbs / t.entryPrice) * 100;
      }

      return {
        _id: t._id,
        userId: t.userId,
        signalId: t.signalId,
        symbol: t.symbol,
        direction: "BUY",
        quantity: t.qty,
        entryPrice: t.entryPrice,
        targetPrice: t.targetPrice,
        stopPrice: t.stopPrice,
        currentPrice: ltp || t.entryPrice,
        status: t.status,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        updatedAt: isOpen ? new Date() : t.exitTime,
        pnlAbs,
        pnlPct,
        notes: t.notes,
      };
    });

    return { ok: true, count: enriched.length, trades: enriched };
  } catch (err) {
    console.error("[TradeEngine] getAllTrades error:", err.message);
    return { ok: false, error: err.message, trades: [] };
  }
}

// ------------------------------------------------------------
// EXPORT
// ------------------------------------------------------------
module.exports = {
  autoEnterOnSignal,
  checkOpenTradesAndUpdate,
  getLivePnLSnapshot,
  getAllTrades,
};
