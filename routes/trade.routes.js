// routes/trade.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const authRequired = require("../middlewares/authRequired");
const tradeCtrl = require("../controllers/trade.controller");

// Auto-enter based on RSI signal
// - Uses authenticated user by default (req.user)
// - Admins may pass ?userId=... or { userId } in body for targeted runs
router.post("/trade/enter-auto", authRequired, tradeCtrl.enterAuto);

// Check exits (TARGET/STOPLOSS) for open trades
// - With ?userId -> single user
// - Without -> all users who have OPEN trades
router.post("/trade/check-exit", authRequired, tradeCtrl.checkExit);

// List trades (scoped to current user by default; admin may pass ?userId=...)
router.get("/trade/all", authRequired, tradeCtrl.getAll);

// Manually close a trade (owner or admin)
router.post("/trade/close/:id", authRequired, tradeCtrl.closeManual);

// Live PnL snapshot (unrealized + today's realized)
// - Scoped to current user by default; admin may pass ?userId=...
router.get("/trade/live-pnl", authRequired, tradeCtrl.livePnL);

module.exports = router;
