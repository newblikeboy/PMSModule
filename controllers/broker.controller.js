// controllers/broker.controller.js
"use strict";

const User = require("../models/User");

/**
 * POST /user/broker/connect
 * Body: { brokerName, apiKey, clientId, accessToken, refreshToken }
 *
 * Marks broker as connected, stores credentials.
 */
exports.connectBroker = async (req, res, next) => {
  try {
    const {
      brokerName,
      apiKey,
      clientId,
      accessToken,
      refreshToken
    } = req.body;

    // Validate brokerName
    const allowed = ["ZERODHA", "ANGEL", "FYERS"];
    if (!allowed.includes(brokerName)) {
      return res.status(400).json({ ok: false, error: "Invalid broker" });
    }

    // NOTE: In production you'd validate these creds by pinging broker APIs.
    // For now we trust user input.

    req.user.broker.connected = true;
    req.user.broker.brokerName = brokerName;
    req.user.broker.creds.apiKey = apiKey || "";
    req.user.broker.creds.clientId = clientId || "";
    req.user.broker.creds.accessToken = accessToken || "";
    req.user.broker.creds.refreshToken = refreshToken || "";
    req.user.broker.creds.note = "Added via dashboard";

    await req.user.save();

    res.json({
      ok: true,
      broker: {
        connected: req.user.broker.connected,
        brokerName: req.user.broker.brokerName
      },
      message: "Broker connected (paper mode). Live trading is still OFF."
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /user/broker/automation
 * Body: { enable: boolean }
 *
 * Lets user toggle whether they want the engine to auto-place live trades.
 * We won't actually fire live trades yet, but UI needs this switch.
 */
exports.setAutomation = async (req, res, next) => {
  try {
    const { enable } = req.body;

    // Safety rule:
    // Can only enable automation if broker is connected.
    if (enable && !req.user.broker.connected) {
      return res.status(400).json({
        ok: false,
        error: "Connect broker first"
      });
    }

    req.user.autoTradingEnabled = !!enable;
    await req.user.save();

    res.json({
      ok: true,
      autoTradingEnabled: req.user.autoTradingEnabled
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /user/broker/status
 * Returns broker + automation info for dashboard.
 */
exports.getStatus = async (req, res, next) => {
  try {
    const u = req.user;
    res.json({
      ok: true,
      broker: {
        connected: u.broker.connected,
        brokerName: u.broker.brokerName,
      },
      autoTradingEnabled: u.autoTradingEnabled
    });
  } catch (err) {
    next(err);
  }
};
