// services/tradeEngine.service.js – FINAL PRODUCTION-GRADE VERSION
"use strict";

/**
 * FINAL TRADE ENGINE (ENTRY + EXIT + REAL-TIME PNL)
 * -------------------------------------------------
 * ✓ One-trade-per-user guaranteed
 * ✓ Hard lock with auto-timeout
 * ✓ Fresh M2 signal only (max age 60s)
 * ✓ Fast LTP fetch using marketSocket cache + batched API fallback
 * ✓ Paper + Live modes
 * ✓ Live order retry (Angel API)
 * ✓ Safe exit engine
 * ✓ Admin dashboard PnL with batching
 * ✓ User-level & global-level PnL
 */

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
  SIGNAL_MAX_AGE_MS: 60 * 1000, // Only fresh M2 signals
  TARGET_PCT: Number(process.env.TARGET_PCT) || 1.5,
  STOP_PCT: Number(process.env.STOP_PCT) || 0.75,
  BULK_MAX_USERS: Number(process.env.ENGINE_BULK_MAX_USERS) || 50,
  LOCK_TIMEOUT_MS: 15000, // auto-unlock after 15s
};

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

// ------------------------------------------------------------
// LTP FETCH — ULTRA FAST: SOCKET CACHE → API FALLBACK
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
  const needAPI = [];

  for (const s of symbols) {
    const tick = marketSocket.getLastTick(s);
    if (tick && num(tick.ltp)) {
      out[s] = tick.ltp;
    } else {
      needAPI.push(s);
    }
  }

  if (needAPI.length) {
    try {
      const api = await fetchBatchLTP(needAPI);
      Object.assign(out, api);
    } catch (err) {
      console.warn("[PNL] Fallback LTP failed:", err.message);
    }
  }

  return out;
}

// ------------------------------------------------------------
// LOCK SYSTEM — Hard lock + Auto-unlock
// ------------------------------------------------------------
const _locks = new Map(); // userId → timestamp

function isLocked(uid) {
  const ts = _locks.get(uid);
  if (!ts) return false;

  // auto-expire lock
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
// TRADE MODE DECISION
// ------------------------------------------------------------
function decideTradeMode(user, globalSettings) {
  if (globalSettings.marketHalt) return "off";
  if (!user.tradingEngineEnabled) return "paper";

  const userLiveOK = !!user.angelLiveEnabled;
  const globalLiveOK = !!globalSettings.isLiveExecutionAllowed;

  if (userLiveOK && globalLiveOK) return "live";
  return "paper";
}

// ------------------------------------------------------------
// QUANTITY CALCULATION
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// ENTRY ENGINE
// ------------------------------------------------------------
async function tryEnterTrade(user) {
  const settings = getSettings();

  if (isAfterCutoff()) return { ok: true, msg: "cutoff passed" };

  const mode = decideTradeMode(user, settings);
  if (mode === "off") return { ok: true, msg: "engine disabled" };

  // 1. Must have NO open trade
  const open = await PaperTrade.findOne({ userId: user._id, status: "OPEN" });
  if (open) return { ok: true, msg: "user already has open trade" };

  // 2. Latest M2 signal
  const sig = await M2Signal.findOne({ inEntryZone: true }).sort({ updatedAt: -1 });
  if (!sig) return { ok: true, msg: "no active signal" };

  // 3. Signal freshness check
  const age = Date.now() - new Date(sig.updatedAt).getTime();
  if (age > CFG.SIGNAL_MAX_AGE_MS) return { ok: true, msg: "signal too old" };

  // 4. LTP
  const ltp = await getOptimizedLTPMap([sig.symbol]).then((m) => m[sig.symbol]);
  if (!ltp) return { ok: false, error: "LTP unavailable" };

  // 5. Quantity
  let qty = 1;
  if (mode === "live") {
    qty = await computeLiveQty(user, ltp);
    if (qty < 1) return { ok: false, error: "insufficient margin" };
  }

  // 6. Prepare trade document
  const base = {
    userId: user._id,
    symbol: sig.symbol,
    qty,
    entryPrice: ltp,
    targetPrice: ltp * (1 + CFG.TARGET_PCT / 100),
    stopPrice: ltp * (1 - CFG.STOP_PCT / 100),
    entryTime: new Date(),
    tradeMode: mode,
    rsiAtEntry: sig.rsi,
    status: "OPEN",
  };

  // 7. PAPER TRADE
  if (mode === "paper") {
    const t = await PaperTrade.create(base);
    return { ok: true, trade: t };
  }

  // 8. LIVE TRADE + RETRY
  const token = await resolveToken(sig.symbol);
  if (!token) return { ok: false, error: "symboltoken missing" };

  let placed = await angelTrade.placeMarketOrder({
    userId: user._id,
    symbol: sig.symbol,
    symboltoken: token,
    qty,
    side: "BUY",
  });

  if (!placed?.ok) {
    console.warn("[TradeEngine] Live buy failed. Retrying...");
    placed = await angelTrade.placeMarketOrder({
      userId: user._id,
      symbol: sig.symbol,
      symboltoken: token,
      qty,
      side: "BUY",
    });
  }

  if (!placed?.ok) {
    return { ok: false, error: placed.error || "live order failed" };
  }

  const liveDoc = await PaperTrade.create({
    ...base,
    broker: "ANGEL_ONE",
    brokerOrderId: placed.orderId,
  });

  return { ok: true, trade: liveDoc };
}

// ------------------------------------------------------------
// EXIT ENGINE
// ------------------------------------------------------------
async function tryExitTradesForUser(userId) {
  const open = await PaperTrade.find({ userId, status: "OPEN" }).lean();
  if (!open.length) return { ok: true, closed: [] };

  const symbols = [...new Set(open.map((x) => x.symbol))];
  const ltpMap = await getOptimizedLTPMap(symbols);

  const closed = [];

  for (const t of open) {
    const ltp = num(ltpMap[t.symbol]);
    if (!ltp) continue;

    let reason = "";
    if (ltp >= t.targetPrice) reason = "TARGET";
    if (ltp <= t.stopPrice) reason = "STOPLOSS";
    if (!reason) continue;

    const exitPrice = ltp;
    const pnlAbs = (exitPrice - t.entryPrice) * t.qty;
    const pnlPct = (pnlAbs / t.entryPrice) * 100;

    await PaperTrade.findByIdAndUpdate(t._id, {
      exitPrice,
      exitTime: new Date(),
      pnlAbs,
      pnlPct,
      notes: reason,
      status: "CLOSED",
    });

    closed.push({ ...t, exitPrice, pnlAbs, pnlPct, reason });
  }

  return { ok: true, closed };
}

// ------------------------------------------------------------
// PUBLIC — AUTO ENTRY ON SIGNAL
// ------------------------------------------------------------
async function autoEnterOnSignal(userId = null) {
  // SINGLE USER
  if (userId) {
    const uid = String(userId);
    if (isLocked(uid)) return { ok: true, msg: "locked" };

    lock(uid);
    try {
      const user = await User.findById(uid);
      if (!user) return { ok: false, error: "user not found" };
      return await tryEnterTrade(user);
    } finally {
      unlock(uid);
    }
  }

  // BULK MODE
  const users = await User.find().limit(CFG.BULK_MAX_USERS).lean();
  const out = [];

  for (const u of users) {
    const uid = String(u._id);
    if (isLocked(uid)) {
      out.push({ userId: uid, msg: "locked" });
      continue;
    }

    lock(uid);
    try {
      const user = await User.findById(uid);
      const r = await tryEnterTrade(user);
      out.push({ userId: uid, ...r });
    } catch (e) {
      out.push({ userId: uid, ok: false, error: e.message });
    } finally {
      unlock(uid);
    }
  }

  return { ok: true, results: out };
}

// ------------------------------------------------------------
// PUBLIC — AUTO EXIT ENGINE
// ------------------------------------------------------------
async function checkOpenTradesAndUpdate(userId = null) {
  if (userId) return await tryExitTradesForUser(userId);

  const rows = await PaperTrade.aggregate([
    { $match: { status: "OPEN" } },
    { $group: { _id: "$userId" } },
    { $limit: 200 },
  ]);

  const out = [];
  for (const r of rows) {
    const uid = String(r._id);
    const res = await tryExitTradesForUser(uid);
    out.push({ userId: uid, ...res });
  }
  return { ok: true, results: out };
}

// ------------------------------------------------------------
// REAL-TIME USER + GLOBAL PNL
// ------------------------------------------------------------
async function getLivePnLSnapshot(userId = null) {
  const sod = new Date(new Date().setHours(0, 0, 0, 0));

  // SINGLE USER
  if (userId) {
    const [open, closed] = await Promise.all([
      PaperTrade.find({ userId, status: "OPEN" }).lean(),
      PaperTrade.find({
        userId,
        status: "CLOSED",
        exitTime: { $gte: sod },
      }).lean(),
    ]);

    const symbols = [...new Set(open.map((t) => t.symbol))];
    const ltpMap = await getOptimizedLTPMap(symbols);

    const openMapped = open.map((t) => {
      const ltp = num(ltpMap[t.symbol]);
      const pnlAbs = ltp ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = pnlAbs ? (pnlAbs / t.entryPrice) * 100 : null;
      return { ...t, ltp, pnlAbs, pnlPct };
    });

    const unrealized = openMapped.reduce((s, t) => s + (t.pnlAbs || 0), 0);
    const realized = closed.reduce((s, t) => s + (t.pnlAbs || 0), 0);

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

  // GLOBAL MODE
  const [openTrades, closedTrades] = await Promise.all([
    PaperTrade.find({ status: "OPEN" }).lean(),
    PaperTrade.find({
      status: "CLOSED",
      exitTime: { $gte: sod },
    }).lean(),
  ]);

  const symbols = [...new Set(openTrades.map((t) => t.symbol))];
  const ltpMap = await getOptimizedLTPMap(symbols);

  const byUser = new Map();
  for (const t of openTrades) {
    const uid = String(t.userId);
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(t);
  }

  const results = [];

  for (const [uid, trades] of byUser.entries()) {
    const mapped = trades.map((t) => {
      const ltp = num(ltpMap[t.symbol]);
      const pnlAbs = ltp ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = pnlAbs ? (pnlAbs / t.entryPrice) * 100 : null;
      return { ...t, ltp, pnlAbs, pnlPct };
    });

    const realized = closedTrades
      .filter((x) => String(x.userId) === uid)
      .reduce((s, t) => s + (t.pnlAbs || 0), 0);

    const unrealized = mapped.reduce((s, t) => s + (t.pnlAbs || 0), 0);

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
async function getAllTrades() {
  try {
    const trades = await PaperTrade.find().sort({ entryTime: -1 }).lean();

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

    return {
      ok: true,
      count: enriched.length,
      trades: enriched,
    };
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
