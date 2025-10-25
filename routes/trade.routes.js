// routes/trade.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/trade.controller");

// 1. Check RSI signals and auto-create paper trades for new candidates
router.post("/enter", ctrl.scanAndEnter);

// 2. Check targets/SL for OPEN trades and close them if hit
router.post("/check-exit", ctrl.checkExits);

// 3. Get all trades (both OPEN and CLOSED)
router.get("/all", ctrl.listTrades);

// 4. Manually close a specific trade
router.post("/close/:id", ctrl.closeManual);

module.exports = router;
