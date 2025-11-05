// services/tradeEngine.service.js
"use strict";

/**
 * Per-user trade engine with:
 *  - paper vs live (global + per-user)
 *  - dynamic qty from user's allowed margin % (Angel Publisher funds)
 *  - one trade at a time (per user)
 *  - no new entries after 14:45 IST
 *  - live PnL snapshot
 *
 * Works in two modes:
 *  - Per-user:  autoEnterOnSignal(userId)
 *  - Bulk:      autoEnterOnSignal()  // iterates eligible users (autoTradingEnabled + broker connected)
 */

const { DateTime } = require("luxon");
const PaperTrade = require("../models/PaperTrade");
const User = require("../models/User");
const m2Service = require("./m2.service");
const fy = require("./fyersSdk");
const { getSettings } = require("./settings.service");
const angelTrade = require("./angel.trade.service");
const { resolveToken } = require("./instruments.service");

// ---------------- Config ----------------
const CFG = Object.freeze({
  IST: "Asia/Kolkata",
  CUT_H: 14,
  CUT_M: 45, // no new entries after 14:45 IST
  TARGET_PCT: Number(process.env.TARGET_PCT) || 1.5,
  STOP_PCT: Number(process.env.STOP_PCT) || 0.75,
  BULK_MAX_USERS: Number(process.env.ENGINE_BULK_MAX_USERS) || 20, // safety cap
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
    const out = {};
    for (const r of rows || []) if (r?.symbol) out[r.symbol] = num(r.ltp);
    return out;
  } catch {
    return {};
  }
}

// Per-user lock: one OPEN at a time
const _locks = new Map();
function isLocked(userId) { return !!_locks.get(String(userId)); }
function lock(userId) { _locks.set(String(userId), true); }
function unlock(userId) { _locks.delete(String(userId)); }

// ---------------- Core helpers ----------------
async function computeLiveQty(user, entryPrice) {
  const allowed = Number(user.angelAllowedMarginPct ?? 0.5);
  const funds = await angelTrade.getFunds(user._id);
  const avail = Number(funds.availableMargin || 0);
  const usable = avail * allowed;
  return Math.max(1, Math.floor(usable / entryPrice));
}

function decideMode(user, globalSettings) {
  // If market is halted, do nothing
  if (globalSettings.marketHalt) return "off";

  // Per-user + global switches
  const perUserLive = !!user.angelLiveEnabled;
  const globalLive = !!globalSettings.isLiveExecutionAllowed;
  if (perUserLive && globalLive) return "live";

  if (globalSettings.isPaperTradingActive) return "paper";
  return "off";
}

async function buildTradeDocBase({ user, symbol, entryPrice, rsiAtEntry, changePctAtEntry }) {
  return {
    userId: user._id,
    symbol,
    entryPrice,
    targetPrice: entryPrice * (1 + CFG.TARGET_PCT / 100),
    stopPrice: entryPrice * (1 - CFG.STOP_PCT / 100),
    rsiAtEntry,
    changePctAtEntry,
  };
}

// Place a live market BUY via Angel Publisher
async function placeLiveTrade({ user, symbol, qty }) {
  // Resolve Angel symboltoken
  const token = await resolveToken(symbol);
  if (!token) return { ok: false, error: "symboltoken not found for " + symbol };

  const res = await angelTrade.placeMarketOrder({
    userId: user._id,
    symbol,
    symboltoken: token,
    qty,
    side: "BUY",
  });
  return res;
}

// ---------------- Engine (per-user) ----------------
async function _enterForUser(user) {
  const gs = getSettings();

  // no new entries after cutoff
  if (isAfterEntryCutoff()) return { ok: true, msg: "cutoff passed" };

  const mode = decideMode(user, gs);
  if (mode === "off") return { ok: true, msg: "trading disabled" };

  // Ensure broker connected if trying live
  if (mode === "live") {
    const brokerOk =
      user?.broker?.brokerName?.toUpperCase?.() === "ANGEL" &&
      !!user?.broker?.connected &&
      !!user?.broker?.creds?.accessToken &&
      !!user?.broker?.creds?.apiKey;
    if (!brokerOk) return { ok: false, error: "Angel not connected for user" };
  }

  // one open trade per user
  const open = await PaperTrade.findOne({ userId: user._id, status: "OPEN" }).lean();
  if (open) return { ok: true, msg: "user has an OPEN trade" };

  // scan M2 (uses M1 movers internally)
  const scan = await m2Service.scanRSIEntryZone();
  const sig = scan?.data?.find((s) => s.inEntryZone);
  if (!sig) return { ok: true, msg: "no entry signal" };

  const ltp = num(sig.ltp) ?? (await fetchLTP(sig.symbol));
  if (!ltp) return { ok: true, msg: "no LTP" };

  // qty
  let qty = 1;
  if (mode === "live") {
    qty = await computeLiveQty(user, ltp);
    if (!Number.isFinite(qty) || qty < 1) return { ok: true, msg: "insufficient margin" };
  }

  const base = await buildTradeDocBase({
    user,
    symbol: sig.symbol,
    entryPrice: ltp,
    rsiAtEntry: sig.rsi,
    changePctAtEntry: sig.changePct,
  });

  if (mode === "paper") {
    const doc = await PaperTrade.create({
      ...base,
      qty,
      tradeMode: "paper",
      broker: "PAPER",
      status: "OPEN",
    });
    return { ok: true, trade: doc };
  }

  // LIVE
  const live = await placeLiveTrade({ user, symbol: sig.symbol, qty });
  if (!live?.ok) return { ok: false, error: live?.error || "live order failed" };

  const doc = await PaperTrade.create({
    ...base,
    qty,
    tradeMode: "live",
    broker: "ANGEL_ONE",
    brokerOrderId: live.orderId,
    status: "OPEN",
  });
  return { ok: true, trade: doc };
}

async function _checkExitsForUser(userId) {
  const q = { userId, status: "OPEN" };
  const openTrades = await PaperTrade.find(q).lean();
  if (!openTrades.length) return { ok: true, closed: [] };

  const symbols = Array.from(new Set(openTrades.map((t) => t.symbol)));
  const ltpMap = await fetchBatchLTP(symbols);

  const closed = [];
  for (const tr of openTrades) {
    const ltp = ltpMap[tr.symbol];
    if (ltp == null) continue;

    let reason = "";
    if (ltp >= tr.targetPrice) reason = "TARGET";
    else if (ltp <= tr.stopPrice) reason = "STOPLOSS";
    if (!reason) continue;

    const exitPrice = ltp;
    const pnlAbs = (exitPrice - tr.entryPrice) * tr.qty;
    const pnlPct = ((exitPrice - tr.entryPrice) / tr.entryPrice) * 100;

    await PaperTrade.findByIdAndUpdate(tr._id, {
      $set: {
        exitPrice,
        exitTime: new Date(),
        pnlAbs,
        pnlPct,
        status: "CLOSED",
        notes: reason,
      },
    });

    closed.push({
      _id: tr._id,
      symbol: tr.symbol,
      exitPrice,
      pnlAbs,
      pnlPct,
      notes: reason,
    });
  }
  return { ok: true, closed };
}

// ---------------- Public API ----------------

/**
 * Auto-enter for a single user OR for all eligible users (bulk)
 * @param {string|undefined} userId
 */
async function autoEnterOnSignal(userId) {
  // Single-user path
  if (userId) {
    if (isLocked(userId)) return { ok: true, msg: "locked" };
    lock(userId);
    try {
      const user = await User.findById(userId);
      if (!user) return { ok: false, error: "user not found" };
      const r = await _enterForUser(user);
      return r;
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      unlock(userId);
    }
  }

  // Bulk path: pick eligible users (cap for safety)
  const users = await User.find({
    autoTradingEnabled: true,
    // Either paper globally, or live allowed + broker connected
    // (mode will be decided per user)
  })
    .select("_id angelLiveEnabled angelAllowedMarginPct broker autoTradingEnabled")
    .limit(CFG.BULK_MAX_USERS)
    .lean();

  const results = [];
  for (const u of users) {
    const id = String(u._id);
    if (isLocked(id)) {
      results.push({ userId: id, ok: true, msg: "locked" });
      continue;
    }
    lock(id);
    try {
      const full = await User.findById(id); // get full doc for safe access in helpers
      const r = await _enterForUser(full);
      results.push({ userId: id, ...r });
    } catch (e) {
      results.push({ userId: id, ok: false, error: e.message });
    } finally {
      unlock(id);
    }
  }
  return { ok: true, results };
}

/**
 * Check exits for one user, or all users with OPEN trades
 */
async function checkOpenTradesAndUpdate(userId) {
  if (userId) {
    return _checkExitsForUser(userId);
  }

  // Bulk: find distinct userIds with OPEN trades
  const rows = await PaperTrade.aggregate([
    { $match: { status: "OPEN" } },
    { $group: { _id: "$userId" } },
    { $limit: 200 },
  ]);
  const userIds = rows.map((r) => String(r._id)).filter(Boolean);

  const out = [];
  for (const id of userIds) {
    try {
      const r = await _checkExitsForUser(id);
      out.push({ userId: id, ...r });
    } catch (e) {
      out.push({ userId: id, ok: false, error: e.message });
    }
  }
  return { ok: true, results: out };
}

/**
 * Live PnL snapshot for one user (or combined if not provided)
 */
async function getLivePnLSnapshot(userId) {
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));

  if (userId) {
    const [openTrades, closedToday] = await Promise.all([
      PaperTrade.find({ userId, status: "OPEN" }).lean(),
      PaperTrade.find({ userId, status: "CLOSED", exitTime: { $gte: startOfDay } }).lean(),
    ]);

    const symbols = Array.from(new Set(openTrades.map((t) => t.symbol)));
    const ltpMap = await fetchBatchLTP(symbols);

    const open = openTrades.map((t) => {
      const ltp = ltpMap[t.symbol];
      const pnlAbs = num(ltp) != null ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = num(ltp) != null ? ((ltp - t.entryPrice) / t.entryPrice) * 100 : null;
      return {
        _id: t._id,
        userId: t.userId,
        symbol: t.symbol,
        mode: t.tradeMode || "paper",
        qty: t.qty,
        entryPrice: t.entryPrice,
        targetPrice: t.targetPrice,
        stopPrice: t.stopPrice,
        ltp: num(ltp),
        pnlAbs,
        pnlPct,
        notes: t.notes,
      };
    });

    const unrealizedPnlAbs = open.reduce((s, r) => s + (Number(r.pnlAbs) || 0), 0);
    const realizedToday = closedToday.reduce((s, r) => s + (Number(r.pnlAbs) || 0), 0);

    return {
      ok: true,
      open,
      totals: {
        unrealizedPnlAbs,
        unrealizedPctAvg: open.length
          ? open.reduce((s, r) => s + (Number(r.pnlPct) || 0), 0) / open.length
          : 0,
        realizedToday,
        netToday: realizedToday + unrealizedPnlAbs,
      },
    };
  }

  // Combined snapshot (optional)
  const [openTrades, closedToday] = await Promise.all([
    PaperTrade.find({ status: "OPEN" }).lean(),
    PaperTrade.find({ status: "CLOSED", exitTime: { $gte: startOfDay } }).lean(),
  ]);

  const byUser = new Map();
  for (const t of openTrades) {
    if (!byUser.has(String(t.userId))) byUser.set(String(t.userId), []);
    byUser.get(String(t.userId)).push(t);
  }

  const results = [];
  for (const [uid, list] of byUser.entries()) {
    const symbols = Array.from(new Set(list.map((t) => t.symbol)));
    const ltpMap = await fetchBatchLTP(symbols);
    const open = list.map((t) => {
      const ltp = ltpMap[t.symbol];
      const pnlAbs = num(ltp) != null ? (ltp - t.entryPrice) * t.qty : null;
      const pnlPct = num(ltp) != null ? ((ltp - t.entryPrice) / t.entryPrice) * 100 : null;
      return {
        _id: t._id,
        userId: t.userId,
        symbol: t.symbol,
        mode: t.tradeMode || "paper",
        qty: t.qty,
        entryPrice: t.entryPrice,
        targetPrice: t.targetPrice,
        stopPrice: t.stopPrice,
        ltp: num(ltp),
        pnlAbs,
        pnlPct,
        notes: t.notes,
      };
    });

    const realizedToday = closedToday
      .filter((x) => String(x.userId) === uid)
      .reduce((s, r) => s + (Number(r.pnlAbs) || 0), 0);
    const unrealizedPnlAbs = open.reduce((s, r) => s + (Number(r.pnlAbs) || 0), 0);

    results.push({
      userId: uid,
      open,
      totals: {
        unrealizedPnlAbs,
        unrealizedPctAvg: open.length
          ? open.reduce((s, r) => s + (Number(r.pnlPct) || 0), 0) / open.length
          : 0,
        realizedToday,
        netToday: realizedToday + unrealizedPnlAbs,
      },
    });
  }

  return { ok: true, results };
}

module.exports = {
  autoEnterOnSignal,
  checkOpenTradesAndUpdate,
  getLivePnLSnapshot,
};
