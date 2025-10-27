// routes/fyers.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const adminRequired  = require("../middlewares/adminRequired");

const {
  getLoginUrl,
  exchangeAuthCode,
  _debugDump
} = require("../services/fyersAuth");

// GET /fyers/login-url
router.get("/login-url", adminRequired, (req, res) => {
  try {
    const url = getLoginUrl();
    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /fyers/exchange  { auth_code }
router.post("/exchange", adminRequired, async (req, res) => {
  try {
    console.log("---- /fyers/exchange called ----");

    // log raw body
    console.log("req.body =", req.body);

    const { auth_code } = req.body || {};
    if (!auth_code) {
      console.log("auth_code missing in body");
      return res.status(400).json({ ok: false, error: "auth_code required" });
    }

    console.log("auth_code received =", auth_code);

    const result = await exchangeAuthCode(auth_code);

    console.log("exchangeAuthCode() success, result =", result);
    console.log("Tokens should now be stored in data/tokens_fyers.json");

    return res.json({ ok: true, tokens: result });

  } catch (err) {
    console.error("ERROR in /fyers/exchange:", err);
    // send the error message back so frontend can show it instead of just "exchange failed"
    return res.status(500).json({ ok: false, error: err.message || "internal error" });
  }
});


// GET /fyers/status
router.get("/status", adminRequired, (req, res) => {
  try {
    const dump = _debugDump();
    res.json({
      ok: true,
      hasAccess: !!dump.access_token,
      hasRefresh: !!dump.refresh_token,
      tokenCreatedAt: dump.access_created_at || null,
      expiresInSec: dump.access_expires_in || null
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
