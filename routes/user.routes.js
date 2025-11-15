// routes/user.routes.js
const express = require("express");
const router = express.Router();
const authRequired = require("../middlewares/authRequired");
const PaperTrade = require("../models/PaperTrade");

const m2Service = require("../services/m2.service");
const tradeEngine = require("../services/tradeEngine.service");
const reportService = require("../services/report.service");

const brokerCtrl = require("../controllers/broker.controller");
const subCtrl = require("../controllers/subscription.controller");
const angelPublisher = require("../services/angel.publisher.service");


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
      phone: u.phone,
      plan: u.plan,
      planTier: u.planTier,
      broker: {
        connected: u.broker.connected,
        brokerName: u.broker.brokerName
      },
      autoTradingEnabled: u.autoTradingEnabled,
      angel: {
        allowedMarginPct: u.angelAllowedMarginPct,
        allowedMarginPercent: Math.round((u.angelAllowedMarginPct ?? 0) * 100),
        liveEnabled: u.angelLiveEnabled,
        brokerConnected: u.broker.connected && u.broker.brokerName === "ANGEL"
      }
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
    const userId = String(req.user?._id || "");
    const trades = await PaperTrade.find({ userId }).sort({ entryTime: -1 }).lean();
    res.json({ ok: true, trades });
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

// angel specific settings
router.get("/angel/settings", authRequired, brokerCtrl.getAngelSettings);
router.post("/angel/settings", authRequired, brokerCtrl.updateAngelSettings);
router.get("/angel/login-link", authRequired, async (req, res) => {
  try {
    // Stateless version: no userId needed anymore
    const url = angelPublisher.buildLoginUrl();
    res.json({ ok: true, url });
  } catch (err) {
    console.error("💥 [Angel Login Link Error]", err);
    const msg = err?.message || "Unable to build login link";
    const status = msg.includes("Missing") ? 400 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});



module.exports = router;
