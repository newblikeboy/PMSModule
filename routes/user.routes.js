// routes/user.routes.js
const express = require("express");
const router = express.Router();
const authRequired = require("../middlewares/authRequired");

const m2Service = require("../services/m2.service");
const tradeEngine = require("../services/tradeEngine.service");
const reportService = require("../services/report.service");

const brokerCtrl = require("../controllers/broker.controller");
const subCtrl = require("../controllers/subscription.controller");


// ---- PROFILE / PLAN / DASHBOARD DATA ----

// Who am I / profile info
router.get("/profile", authRequired, async (req, res) => {
  const u = req.user;
  res.json({
    ok: true,
    user: {
      id: u._id,
      name: u.name,
      email: u.email,
      plan: u.plan,
      broker: {
        connected: u.broker.connected,
        brokerName: u.broker.brokerName
      },
      autoTradingEnabled: u.autoTradingEnabled
    }
  });
});

// Current plan status
router.get("/plan/status", authRequired, subCtrl.getStatus);

// Create upgrade intent (start upgrade flow)
router.post("/plan/upgrade-intent", authRequired, subCtrl.createUpgradeIntent);

// Confirm upgrade (finish upgrade flow -> becomes Paid)
router.post("/plan/confirm", authRequired, subCtrl.confirmUpgrade);


// ---- CORE DASHBOARD DATA ----

// RSI pullback signals (opportunities)
router.get("/signals", authRequired, async (req, res, next) => {
  try {
    const result = await m2Service.getLatestSignalsFromDB();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Your trades (paper)
router.get("/trades", authRequired, async (req, res, next) => {
  try {
    const result = await tradeEngine.getAllTrades();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Today's performance (PnL summary)
router.get("/report-today", authRequired, async (req, res, next) => {
  try {
    const result = await reportService.buildDailyReport();
    res.json(result);
  } catch (err) {
    next(err);
  }
});


// ---- BROKER CONNECT FLOW ----

// status (broker + automation)
router.get("/broker/status", authRequired, brokerCtrl.getStatus);

// connect/update broker creds
router.post("/broker/connect", authRequired, brokerCtrl.connectBroker);

// toggle automation
router.post("/broker/automation", authRequired, brokerCtrl.setAutomation);


module.exports = router;
