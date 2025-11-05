// controllers/trade.controller.js
"use strict";

/**
 * Per-user aware trade controller.
 * - If request is authenticated (authRequired), we default to req.user._id
 * - Admins can run bulk actions by omitting userId
 * - Backward compatible with your existing routes
 */

const PaperTrade = require("../models/PaperTrade");
const engine = require("../services/tradeEngine.service");

// --------- helpers ---------
function pickUserId(req) {
  // Priority: explicit query/body (admin tools) -> auth user
  return (
    (req.query && req.query.userId) ||
    (req.body && req.body.userId) ||
    (req.user && req.user._id && String(req.user._id)) ||
    null
  );
}

function isAdmin(req) {
  return req.user && (req.user.plan === "admin" || req.user.isAdmin === true);
}

// --------- handlers ---------

// Auto-enter (RSI signal → paper/live depending on settings & user flags)
// - If userId is present -> single-user
// - Else -> bulk (eligible users, capped in service)
async function enterAuto(req, res) {
  try {
    const userId = pickUserId(req);
    const result = await engine.autoEnterOnSignal(userId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// Check exits for open trades
// - If userId present -> single-user
// - Else -> all users with OPEN trades
async function checkExit(req, res) {
  try {
    const userId = pickUserId(req);
    const result = await engine.checkOpenTradesAndUpdate(userId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// Get all trades (optionally scoped to the current user)
// Backward compatible with your existing route
async function getAll(req, res) {
  try {
    const userId = pickUserId(req);
    const q = userId ? { userId } : {};
    const trades = await PaperTrade.find(q).sort({ entryTime: -1 }).lean();
    res.json({ ok: true, trades });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// Close trade manually (force exit)
// Only owner or admin can close
async function closeManual(req, res) {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "id required" });

    const tr = await PaperTrade.findById(id);
    if (!tr) return res.status(404).json({ ok: false, error: "Trade not found" });

    const requesterId = (req.user && String(req.user._id)) || null;
    if (!isAdmin(req) && requesterId && String(tr.userId) !== requesterId) {
      return res.status(403).json({ ok: false, error: "Not allowed" });
    }

    // For manual close, recompute exit from entry if LTP missing (engine handles live PnL normally)
    const exitPx = tr.entryPrice; // safe fallback; UI may also call checkExit to realize proper LTP-based exit
    const pnlAbs = (exitPx - tr.entryPrice) * tr.qty;
    const pnlPct = ((exitPx - tr.entryPrice) / tr.entryPrice) * 100;

    tr.exitPrice = exitPx;
    tr.exitTime = new Date();
    tr.pnlAbs = pnlAbs;
    tr.pnlPct = pnlPct;
    tr.status = "CLOSED";
    tr.notes = "MANUAL";
    await tr.save();

    res.json({ ok: true, trade: tr });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// Live PnL snapshot (unrealized + today realized)
// - If userId present (from auth or query) -> per-user
// - Else -> combined view grouped by user
async function livePnL(req, res) {
  try {
    const userId = pickUserId(req);
    const result = await engine.getLivePnLSnapshot(userId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

module.exports = {
  enterAuto,
  checkExit,
  getAll,
  closeManual,
  livePnL,
};
