// controllers/admin.controller.js
"use strict";

const User = require("../models/User");
const reportService = require("../services/report.service");
const tradeEngine = require("../services/tradeEngine.service");

// 1. Strategy performance snapshot
// GET /admin/overview
exports.getOverview = async (req, res, next) => {
  try {
    // We'll leverage your reportService for daily summary:
    const daily = await reportService.buildDailyReport();

    // Also show: total open trades in system (paper)
    const allTrades = await tradeEngine.getAllTrades();
    const openTrades = (allTrades.trades || []).filter(t => t.status === "OPEN");

    // Count how many users have enabled automation (potential live risk)
    const autoUsers = await User.countDocuments({ autoTradingEnabled: true });

    res.json({
      ok: true,
      dailySummary: daily.summary || {},
      openTradesCount: openTrades.length,
      autoUsersCount: autoUsers
    });
  } catch (err) {
    next(err);
  }
};

// 2. User list
// GET /admin/users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}, {
      name: 1,
      email: 1,
      plan: 1,
      "broker.connected": 1,
      "broker.brokerName": 1,
      autoTradingEnabled: 1,
      angelAllowedMarginPct: 1,
      angelLiveEnabled: 1,
      createdAt: 1
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      ok: true,
      users
    });
  } catch (err) {
    next(err);
  }
};

// 3. Update user plan (trial/paid/admin)
// POST /admin/user/plan
// body: { userId, plan }
exports.setUserPlan = async (req, res, next) => {
  try {
    const { userId, plan } = req.body;

    if (!userId || !plan) {
      return res.status(400).json({ ok:false, error:"userId & plan required" });
    }

    if (!["trial","paid","admin"].includes(plan)) {
      return res.status(400).json({ ok:false, error:"invalid plan" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok:false, error:"user not found" });

    user.plan = plan;
    await user.save();

    res.json({ ok:true, message:"Plan updated", plan:user.plan });
  } catch (err) {
    next(err);
  }
};

// 4. Toggle automation for a user
// POST /admin/user/automation
// body: { userId, enable }
exports.setUserAutomation = async (req, res, next) => {
  try {
    const { userId, enable } = req.body;

    if (!userId) {
      return res.status(400).json({ ok:false, error:"userId required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok:false, error:"user not found" });

    user.autoTradingEnabled = !!enable;
    await user.save();

    res.json({
      ok:true,
      message:"Automation flag updated",
      autoTradingEnabled: user.autoTradingEnabled
    });
  } catch (err) {
    next(err);
  }
};

// 5. Update Angel settings (margin / live flag)
// POST /admin/user/angel
// body: { userId, allowedMarginPct?, allowedMarginPercent?, liveEnabled? }
exports.setUserAngelConfig = async (req, res, next) => {
  try {
    const { userId, allowedMarginPct, allowedMarginPercent, liveEnabled } = req.body || {};
    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, error: "user not found" });

    let margin = allowedMarginPct;
    if (margin === undefined && allowedMarginPercent !== undefined) {
      margin = Number(allowedMarginPercent) / 100;
    }
    if (margin !== undefined) {
      const pct = Number(margin);
      if (Number.isNaN(pct) || !Number.isFinite(pct)) {
        return res.status(400).json({ ok: false, error: "Invalid margin value" });
      }
      if (pct < 0 || pct > 1) {
        return res.status(400).json({ ok: false, error: "Margin must be between 0 and 1" });
      }
      user.angelAllowedMarginPct = pct;
    }

    if (liveEnabled !== undefined) {
      const boolVal = liveEnabled === true || liveEnabled === "true" || liveEnabled === 1 || liveEnabled === "1";
      const brokerOk = user.broker?.connected && user.broker?.brokerName === "ANGEL";
      if (boolVal && !brokerOk) {
        return res.status(400).json({ ok: false, error: "Connect Angel broker first" });
      }
      user.angelLiveEnabled = boolVal;
    }

    await user.save();

    res.json({
      ok: true,
      angel: {
        allowedMarginPct: user.angelAllowedMarginPct,
        allowedMarginPercent: Math.round((user.angelAllowedMarginPct ?? 0) * 100),
        liveEnabled: user.angelLiveEnabled
      }
    });
  } catch (err) {
    next(err);
  }
};
const settingsService = require("../services/settings.service");

// 6. Get system settings
// GET /admin/system
exports.getSystemSettings = async (req, res, next) => {
  try {
    const s = settingsService.getSettings();
    res.json({
      ok: true,
      settings: s
    });
  } catch (err) {
    next(err);
  }
};

// 7. Toggle system settings
// POST /admin/system
// body: { key: "isPaperTradingActive", value: true/false }
exports.updateSystemSetting = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ ok:false, error:"key required" });
    }
    const newState = settingsService.setSetting(key, value);
    res.json({
      ok: true,
      settings: newState
    });
  } catch (err) {
    next(err);
  }
};
