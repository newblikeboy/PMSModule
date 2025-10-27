// routes/fyers.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const adminRequired = require("../middlewares/adminRequired");

const {
  getLoginUrl,
  exchangeAuthCode,
  forceRefreshNow,
  getAuthMeta
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

// GET /fyers/status
router.get("/status", adminRequired, (req, res) => {
  try {
    const meta = getAuthMeta();
    return res.json({
      ok: true,
      ...meta
    });
  } catch (err) {
    console.error("[/fyers/status] ERROR", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /fyers/force-refresh  (admin-requested refresh)
router.post("/force-refresh", adminRequired, async (req, res) => {
  try {
    const out = await forceRefreshNow();
    return res.json({ ok: true, tokens: out });
  } catch (err) {
    console.error("ERROR in /fyers/force-refresh:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Could not refresh"
    });
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
