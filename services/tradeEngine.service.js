// services/tradeEngine.service.js
"use strict";

/**
 * FINAL UPDATED TRADE ENGINE
 * ---------------------------
 * ✓ User Trading Engine ON/OFF decides LIVE or PAPER
 * ✓ Reads signals from M2Signal DB (not m2Service)
 * ✓ Only 1 open trade per user at a time
 * ✓ Sequential trade execution (queue behaviour)
 * ✓ Allowed margin % per user → dynamic qty
 * ✓ No new trades after 14:45 IST
 * ✓ Real-time PnL available
 */

const { DateTime } = require("luxon");
const PaperTrade = require("../models/PaperTrade");
const User = require("../models/User");
const M2Signal = require("../models/M2Signal");
const fy = require("./fyersSdk");
const { getSettings } = require("./settings.service");
const angelTrade = require("./angel.trade.service");
const { resolveToken } = require("./instruments.service");

// ---------------- Config ----------------
const CFG = Object.freeze({
  IST: "Asia/Kolkata",
  CUT_H: 14,
  CUT_M: 45, // no entries after 14:45 IST
  TARGET_PCT: Number(process.env.TARGET_PCT) || 1.5,
  STOP_PCT: Number(process.env.STOP_PCT) || 0.75,
  BULK_MAX_USERS: Number(process.env.ENGINE_BULK_MAX_USERS) || 50,
});

// ---------------- Small utils ----------------
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

function isAfterEntryCutoff() {
  const now = DateTime.now().setZone(CFG.IST);
  return now.hour > CFG.CUT_H || (now.hour === CFG.CUT_H && now.minute >= CFG.CUT_M);
}

async function fetchLTP(symbol) {
  try {
    const rows = await fy.getQuotes(symbol);
    const r = Array.isArray(rows) ? rows[0] : null;
    return r ? num(r.ltp) : null;
  } catch {
    return null;
  }
}

async function fetchBatchLTP(symbols = []) {
  if (!symbols.length) return {};
  try {
    const rows = await fy.getQuotes(symbols);
    const map = {};
    for (const r of rows || []) if (r?.symbol) map[r.symbol] = num(r.ltp);
    return map;
  } catch {
    return {};
  }
}

// LOCKS: prevent simultaneous entry for the same user
const _locks = new Map();
const isLocked = (uid) => _locks.get(String(uid));
const lock = (uid) => _locks.set(String(uid), true);
const unlock = (uid) => _locks.delete(String(uid));

// ---------------- Core Helpers ----------------
async function computeLiveQty(user, entryPrice) {
  const allowed = Number(user.angelAllowedMarginPct ?? 0.5);
  const funds = await angelTrade.getFunds(user._id);
  const avail = Number(funds.availableMargin || 0);
  const usable = avail * allowed;
  return Math.max(1, Math.floor(usable / entryPrice));
}

function decideTradeMode(user, globalSettings) {
  if (globalSettings.marketHalt) return "off";
  if (!user.tradingEngineEnabled) return "paper"; // user has engine OFF ⇒ paper only

  const liveAllowedUser = !!user.angelLiveEnabled;
  const liveAllowedGlobal = !!globalSettings.isLiveExecutionAllowed;

  if (liveAllowedUser && liveAllowedGlobal) return "live";
  return "paper";
}

async function buildTradeDocument({ user, sig, entryPrice }) {
  return {
    userId: user._id,
    symbol: sig.symbol,
    entryPrice,
    targetPrice: entryPrice * (1 + CFG.TARGET_PCT / 100),
    stopPrice: entryPrice * (1 - CFG.STOP_PCT / 100),
    rsiAtEntry: sig.rsi,
    changePctAtEntry: sig.changePct,
  };
}

async function placeLiveBuy(user, symbol, qty) {
  const token = await resolveToken(symbol);
  if (!token) return { ok: false, error: "symboltoken not found for " + symbol };

  return angelTrade.placeMarketOrder({
    userId: user._id,
    symbol,
    symboltoken: token,
    qty,
    side: "BUY",
  });
}

// ---------------- ENTRY LOGIC ----------------
async function tryEnterTrade(user) {
  const gs = getSettings();

  // 1) Do not trade after cutoff
  if (isAfterEntryCutoff()) return { ok: true, msg: "entry cutoff passed" };

  // 2) Decide live/paper/off
  const mode = decideTradeMode(user, gs);
  if (mode === "off") return { ok: true, msg: "trading disabled" };

  // 3) Validate broker connection for LIVE
  if (mode === "live") {
    const ok =
      user?.broker?.brokerName?.toUpperCase() === "ANGEL" &&
      user?.broker?.connected &&
      user?.broker?.creds?.accessToken &&
      user?.broker?.creds?.apiKey;

    if (!ok) return { ok: false, error: "Angel not connected for live trade" };
  }

  // 4) Ensure only 1 open trade
  const open = await PaperTrade.findOne({ userId: user._id, status: "OPEN" });
  if (open) return { ok: true, msg: "user already has open trade" };

  // 5) Read latest entry signal from M2Signal DB
  const sig = await M2Signal.findOne({ inEntryZone: true })
    .sort({ updatedAt: -1 })
    .lean();

  if (!sig) return { ok: true, msg: "no active entry signal" };

  // 6) Fetch LTP
  const ltp = await fetchLTP(sig.symbol);
  if (!ltp) return { ok: false, error: "LTP not available" };

  // 7) Calculate quantity
  let qty = 1;
  if (mode === "live") {
    qty = await computeLiveQty(user, ltp);
    if (!qty || qty < 1) return { ok: false, error: "insufficient margin" };
  }

  // 8) Prepare trade document
  const baseDoc = await buildTradeDocument({ user, sig, entryPrice: ltp });

  // 9) PAPER TRADE
  if (mode === "paper") {
    const doc = await PaperTrade.create({
      ...baseDoc,
      qty,
      tradeMode: "paper",
      broker: "PAPER",
      status: "OPEN",
    });
    return { ok: true, trade: doc };
  }

  // 10) LIVE TRADE
  const placed = await placeLiveBuy(user, sig.symbol, qty);
  if (!placed.ok) return { ok: false, error: placed.error };

  const doc = await PaperTrade.create({
    ...baseDoc,
    qty,
    tradeMode: "live",
    broker: "ANGEL_ONE",
    brokerOrderId: placed.orderId,
    status: "OPEN",
  });

  return { ok: true, trade: doc };
}

// ---------------- EXIT LOGIC ----------------
async function tryExitTradesForUser(userId) {
  const openTrades = await PaperTrade.find({ userId, status: "OPEN" }).lean();
  if (!openTrades.length) return { ok: true, closed: [] };

  const symbols = [...new Set(openTrades.map((t) => t.symbol))];
  const ltpMap = await fetchBatchLTP(symbols);

  const closed = [];
  for (const t of openTrades) {
    const ltp = num(ltpMap[t.symbol]);
    if (!ltp) continue;

    let reason = "";
    if (ltp >= t.targetPrice) reason = "TARGET";
    if (ltp <= t.stopPrice) reason = "STOPLOSS";
    if (!reason) continue;

    const exitPrice = ltp;
    const pnlAbs = (exitPrice - t.entryPrice) * t.qty;
    const pnlPct = ((exitPrice - t.entryPrice) / t.entryPrice) * 100;

    await PaperTrade.findByIdAndUpdate(t._id, {
      $set: {
        exitPrice,
        exitTime: new Date(),
        pnlAbs,
        pnlPct,
        status: "CLOSED",
        notes: reason,
      },
    });

    closed.push({ ...t, exitPrice, pnlAbs, pnlPct, reason });
  }

  return { ok: true, closed };
}

// ---------------- PUBLIC METHODS ----------------

/**
 * Entry for one user or bulk users
 */
async function autoEnterOnSignal(userId) {
  // Single user
  if (userId) {
    if (isLocked(userId)) return { ok: true, msg: "locked" };
    lock(userId);
    try {
      const user = await User.findById(userId);
      if (!user) return { ok: false, error: "user not found" };
      return await tryEnterTrade(user);
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      unlock(userId);
    }
  }

  // Bulk mode
  const users = await User.find({ tradingEngineEnabled: true })
    .limit(CFG.BULK_MAX_USERS)
    .lean();

  const out = [];
  for (const usr of users) {
    const id = String(usr._id);
    if (isLocked(id)) {
      out.push({ userId: id, msg: "locked" });
      continue;
    }
    lock(id);
    try {
      const fullUser = await User.findById(id);
      const r = await tryEnterTrade(fullUser);
      out.push({ userId: id, ...r });
    } catch (err) {
      out.push({ userId: id, ok: false, error: err.message });
    } finally {
      unlock(id);
    }
  }
  return { ok: true, results: out };
}

/**
 * Check exit conditions for one user or all users
 */
async function checkOpenTradesAndUpdate(userId) {
  if (userId) return tryExitTradesForUser(userId);

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

/**
 * Live PnL Snapshot
 */
async function getLivePnLSnapshot(userId) {
  const sod = new Date(new Date().setHours(0, 0, 0, 0));

  if (userId) {
    const [open, closedToday] = await Promise.all([
      PaperTrade.find({ userId, status: "OPEN" }).lean(),
      PaperTrade.find({ userId, status: "CLOSED", exitTime: { $gte: sod } }).lean(),
    ]);

    const symbols = [...new Set(open.map((x) => x.symbol))];
    const ltpMap = await fetchBatchLTP(symbols);

    const openMapped = open.map((t) => {
      const ltp = num(ltpMap[t.symbol]);
      const pnlAbs = ltp != null ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = ltp != null ? ((ltp - t.entryPrice) / t.entryPrice) * 100 : null;
      return { ...t, ltp, pnlAbs, pnlPct };
    });

    const unrealized = openMapped.reduce((s, r) => s + (r.pnlAbs || 0), 0);
    const realized = closedToday.reduce((s, r) => s + (r.pnlAbs || 0), 0);

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

  // Combined snapshot
  const [open, closed] = await Promise.all([
    PaperTrade.find({ status: "OPEN" }).lean(),
    PaperTrade.find({ status: "CLOSED", exitTime: { $gte: sod } }).lean(),
  ]);

  const byUser = new Map();
  for (const t of open) {
    const uid = String(t.userId);
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(t);
  }

  const result = [];
  for (const [uid, trades] of byUser.entries()) {
    const symbols = [...new Set(trades.map((t) => t.symbol))];
    const ltpMap = await fetchBatchLTP(symbols);

    const mapped = trades.map((t) => {
      const ltp = num(ltpMap[t.symbol]);
      const pnlAbs = ltp != null ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = ltp != null ? ((ltp - t.entryPrice) / t.entryPrice) * 100 : null;
      return { ...t, ltp, pnlAbs, pnlPct };
    });

    const realized = closed
      .filter((x) => String(x.userId) === uid)
      .reduce((s, r) => s + (r.pnlAbs || 0), 0);

    const unrealized = mapped.reduce((s, r) => s + (r.pnlAbs || 0), 0);

    result.push({
      userId: uid,
      open: mapped,
      totals: {
        unrealizedPnlAbs: unrealized,
        realizedToday: realized,
        netToday: realized + unrealized,
      },
    });
  }

  return { ok: true, results: result };
}

module.exports = {
  autoEnterOnSignal,
  checkOpenTradesAndUpdate,
  getLivePnLSnapshot,
};
