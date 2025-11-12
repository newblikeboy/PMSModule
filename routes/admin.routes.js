"use strict";

const express = require("express");
const router = express.Router();

const adminRequired = require("../middlewares/adminRequired");
const adminCtrl = require("../controllers/admin.controller");
const angelPublisher = require("../services/angel.publisher.service");
const User = require("../models/User");

const {
  getEngineStatus,
  startScanEngine,
  stopScanEngine,
} = require("../controllers/engine.controller");

// ─────────────────────────────────────────────
// ✅ Admin Overview
// ─────────────────────────────────────────────
router.get("/overview", adminRequired, adminCtrl.getOverview);

// ─────────────────────────────────────────────
// ✅ Latest Signals
// ─────────────────────────────────────────────
router.get("/signals", adminRequired, async (req, res, next) => {
  try {
    const m2Service = require("../services/m2.service");
    const result = await m2Service.getLatestSignalsFromDB();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// ✅ Paper Trades List
// ─────────────────────────────────────────────
router.get("/trades", adminRequired, async (req, res, next) => {
  try {
    const tradeEngine = require("../services/tradeEngine.service");
    const result = await tradeEngine.getAllTrades();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// ✅ Users Management
// ─────────────────────────────────────────────
router.get("/users", adminRequired, adminCtrl.getUsers);
router.post("/user/plan", adminRequired, adminCtrl.setUserPlan);
router.post("/user/automation", adminRequired, adminCtrl.setUserAutomation);
router.post("/user/angel", adminRequired, adminCtrl.setUserAngelConfig);

// ─────────────────────────────────────────────
// ✅ Build Angel Login Link for a user (Admin Only)
// ─────────────────────────────────────────────
router.get("/angel/login-link", adminRequired, async (req, res) => {
  try {
    let { userId, email } = req.query;
    userId = userId?.trim();
    email = email?.trim()?.toLowerCase();

    if (!userId && email) {
      const user = await User.findOne({ email }).select("_id");
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found for email" });
      }
      userId = user._id.toString();
    }

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Provide userId or email" });
    }

    const url = await angelPublisher.buildLoginUrlForUserId(userId);
    return res.json({ ok: true, url });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});


// ─────────────────────────────────────────────
// ✅ System Settings
// ─────────────────────────────────────────────
router.get("/system", adminRequired, adminCtrl.getSystemSettings);
router.post("/system", adminRequired, adminCtrl.updateSystemSetting);

// ─────────────────────────────────────────────
// ✅ Engine Control (Live Scanner)
// ─────────────────────────────────────────────
router.get("/engine/status", adminRequired, getEngineStatus);
router.post("/engine/start", adminRequired, startScanEngine);
router.post("/engine/stop", adminRequired, stopScanEngine);

// ─────────────────────────────────────────────
module.exports = router;
