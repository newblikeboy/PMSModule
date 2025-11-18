// controllers/broker.controller.js
"use strict";

const User = require("../models/User");
const { isAngelTokenExpired } = require("../services/angel.service");


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
    req.user.broker.creds.apiKey = apiKey;
    req.user.broker.creds.clientId = clientId ; // Keep clientId plain text
    req.user.broker.creds.accessToken = accessToken;
    req.user.broker.creds.refreshToken = refreshToken;
    req.user.broker.creds.exchangedAt = new Date();
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
 * GET /user/angel/settings
 * Returns angel margin + live flags for the authenticated user.
 */
exports.getAngelSettings = async (req, res, next) => {
  try {
    const allowed = Number(req.user.angelAllowedMarginPct ?? 0.5);
    const isConnected = await validateAngelConnection(req.user);
    res.json({
      ok: true,
      angel: {
        allowedMarginPct: allowed,
        allowedMarginPercent: Math.round(allowed * 100),
        liveEnabled: !!req.user.angelLiveEnabled,
        brokerConnected: isConnected
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /user/angel/settings
 * Body: { allowedMarginPct?, allowedMarginPercent?, liveEnabled? }
 */
exports.updateAngelSettings = async (req, res, next) => {
  try {
    let { allowedMarginPct, allowedMarginPercent, liveEnabled } = req.body || {};

    if (allowedMarginPercent !== undefined && allowedMarginPct === undefined) {
      allowedMarginPct = Number(allowedMarginPercent) / 100;
    }

    if (allowedMarginPct !== undefined) {
      const pct = Number(allowedMarginPct);
      if (Number.isNaN(pct) || !Number.isFinite(pct)) {
        return res.status(400).json({ ok: false, error: "Invalid margin value" });
      }
      if (pct < 0 || pct > 1) {
        return res.status(400).json({ ok: false, error: "Margin must be between 0 and 1" });
      }
      req.user.angelAllowedMarginPct = pct;
    }

    if (liveEnabled !== undefined) {
      const boolVal = liveEnabled === true || liveEnabled === "true" || liveEnabled === 1 || liveEnabled === "1";
      const brokerOk = await validateAngelConnection(req.user);
      if (boolVal && !brokerOk) {
        return res.status(400).json({
          ok: false,
          error: "Connect Angel broker first"
        });
      }
      req.user.angelLiveEnabled = boolVal;
    }

    await req.user.save();

    res.json({
      ok: true,
      angel: {
        allowedMarginPct: req.user.angelAllowedMarginPct,
        allowedMarginPercent: Math.round((req.user.angelAllowedMarginPct ?? 0) * 100),
        liveEnabled: !!req.user.angelLiveEnabled
      }
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
    const brokerOk = await validateAngelConnection(req.user);
    if (enable && !brokerOk) {
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
 * POST /user/broker/client-id
 * Body: { clientId: string }
 * Updates the Angel Client ID in the broker creds.
 */
exports.updateAngelClientId = async (req, res, next) => {
  try {
    const { clientId } = req.body;
    if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Valid Client ID required" });
    }

    req.user.broker.creds.clientId = clientId.trim(); // Keep clientId plain text
    await req.user.save();

    res.json({
      ok: true,
      clientId: req.user.broker.creds.clientId
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Validate Angel connection and update if expired.
 * @param {Object} user - User object
 * @returns {boolean} true if connected and valid
 */
async function validateAngelConnection(user) {
  if (!user.broker.connected || user.broker.brokerName !== "ANGEL") {
    console.log(`[validateAngelConnection] User ${user._id}: Not connected or not ANGEL`);
    return false;
  }

  const expired = isAngelTokenExpired(user.broker.creds);
  console.log(`[validateAngelConnection] User ${user._id}: Token expired check = ${expired}, exchangedAt = ${user.broker.creds.exchangedAt}`);

  if (expired) {
    // Tokens expired, disconnect
    console.log(`[validateAngelConnection] User ${user._id}: Disconnecting due to expired tokens`);
    user.broker.connected = false;
    await user.save();
    return false;
  }

  console.log(`[validateAngelConnection] User ${user._id}: Connection valid`);
  return true;
}

exports.validateAngelConnection = validateAngelConnection;

/**
 * GET /user/broker/status
 * Returns broker + automation info for dashboard.
 */
exports.getStatus = async (req, res, next) => {
  try {
    const u = req.user;
    const isConnected = await validateAngelConnection(u);
    res.json({
      ok: true,
      broker: {
        connected: isConnected,
        brokerName: u.broker.brokerName,
      },
      autoTradingEnabled: u.autoTradingEnabled
    });
  } catch (err) {
    next(err);
  }
};
