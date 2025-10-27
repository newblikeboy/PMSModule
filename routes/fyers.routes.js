// routes/fyers.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const adminRequired = require("../middlewares/adminRequired");

const {
  getLoginUrl,
  exchangeAuthCode,
  _debugDump
} = require("../services/fyersAuth");

// DEBUG: add this log at require-time
console.log("[fyers.routes.js] loaded");

router.get("/login-url", adminRequired, (req, res) => {
  try {
    console.log("[/fyers/login-url] hit");
    const url = getLoginUrl();
    return res.json({ ok: true, url });
  } catch (err) {
    console.error("[/fyers/login-url] ERROR", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/status", adminRequired, (req, res) => {
  try {
    console.log("[/fyers/status] hit");
    const dump = _debugDump();
    return res.json({
      ok: true,
      hasAccess: !!dump.access_token,
      hasRefresh: !!dump.refresh_token,
      tokenCreatedAt: dump.access_created_at || null,
      expiresInSec: dump.access_expires_in || null
    });
  } catch (err) {
    console.error("[/fyers/status] ERROR", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/exchange", adminRequired, async (req, res) => {
  try {
    console.log("---- /fyers/exchange called ----");
    // console.log("req.body =", req.body);

    const { auth_code } = req.body || {};
    if (!auth_code) {
      console.log("auth_code missing in body");
      return res.status(400).json({ ok: false, error: "auth_code required" });
    }

    // console.log("auth_code received =", auth_code);

    const result = await exchangeAuthCode(auth_code);

    console.log("exchangeAuthCode() success, result =", result);
    console.log("Tokens should now be stored in data/tokens_fyers.json");

    return res.json({ ok: true, tokens: result });

  } catch (err) {
    console.error("ERROR in /fyers/exchange:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "internal error" });
  }
});

module.exports = router;
