// routes/m2.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/m2.controller");

// Hit this to run fresh RSI scan on current movers
router.post("/scan", ctrl.runScan);

// Hit this to just read last known signals from DB
router.get("/signals", ctrl.getSignals);

module.exports = router;
