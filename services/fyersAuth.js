// services/fyersAuth.js
"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

// ------------------------------------------------------------------
// FILE STORAGE
// ------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "../data");
const TOKENS_FILE = path.join(DATA_DIR, "./tokens_fyers.json");

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error("[fyersAuth] Failed to ensure data dir:", e);
  }
}

function loadTokensFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("[fyersAuth] loadTokensFromDisk error:", e);
  }

  return {
    access_token: null,
    refresh_token: null,
    access_created_at: 0,
    access_expires_in: 3600,
    last_auto_refresh_at: 0,
    last_manual_refresh_at: 0
  };
}

function saveTokensToDisk(tokens) {
  ensureDataDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
}

let state = loadTokensFromDisk();

// ------------------------------------------------------------------
// LOGIN URL (STEP 1)
// ------------------------------------------------------------------
function getLoginUrl() {
  const appId = process.env.FYERS_APP_ID;
  const redirectUri = process.env.FYERS_REDIRECT_URI;

  return (
    "https://api-t1.fyers.in/api/v3/generate-authcode" +
    "?client_id=" + encodeURIComponent(appId || "") +
    "&redirect_uri=" + encodeURIComponent(redirectUri || "") +
    "&response_type=code&state=quantpulse"
  );
}

// ------------------------------------------------------------------
// EXCHANGE AUTH CODE (STEP 2)
// ------------------------------------------------------------------
async function exchangeAuthCode(authCode) {
  const appId = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_APP_SECRET;

  const appIdHash = crypto.createHash("sha256").update(`${appId}:${secret}`).digest("hex");

  const resp = await axios.post(
    "https://api-t1.fyers.in/api/v3/validate-authcode",
    { grant_type: "authorization_code", appIdHash, code: authCode },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );

  const data = resp.data;
  const now = Date.now();

  state.access_token = data.access_token;
  state.refresh_token = data.refresh_token;
  state.access_created_at = now;
  state.access_expires_in = data.expires_in || 3600;
  state.last_manual_refresh_at = now;

  saveTokensToDisk(state);

  return {
    ok: true,
    access_token: state.access_token,
    refresh_token: state.refresh_token
  };
}

// ------------------------------------------------------------------
// REFRESH TOKEN (AUTO + MANUAL)
// ------------------------------------------------------------------
let refreshLock = false;

async function refreshAccessToken() {
  if (refreshLock) {
    return state.access_token; // Prevent parallel refresh
  }

  refreshLock = true;

  try {
    const appId = process.env.FYERS_APP_ID;
    const secret = process.env.FYERS_APP_SECRET;
    const pinId = process.env.FYERS_PIN;

    const appIdHash = crypto.createHash("sha256").update(`${appId}:${secret}`).digest("hex");

    const resp = await axios.post(
      "https://api-t1.fyers.in/api/v3/validate-refresh-token",
      {
        grant_type: "refresh_token",
        appIdHash,
        refresh_token: state.refresh_token,
        pin: pinId
      },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    const data = resp.data;
    const now = Date.now();

    state.access_token = data.access_token;
    state.refresh_token = data.refresh_token;
    state.access_created_at = now;
    state.access_expires_in = data.expires_in || 3600;
    state.last_auto_refresh_at = now;

    saveTokensToDisk(state);

    console.log("[fyersAuth] Auto-refresh OK");

    return state.access_token;
  } catch (err) {
    console.error("[fyersAuth] Auto-refresh FAILED:", err.response?.data || err.message);
    throw err;
  } finally {
    refreshLock = false;
  }
}

// ------------------------------------------------------------------
// AUTO REFRESH CHECKER (BUILT-IN DAEMON)
// ------------------------------------------------------------------
function startAutoRefreshDaemon() {
  console.log("[fyersAuth] Auto-refresh daemon started (1 min cycle)");

  setInterval(async () => {
    try {
      const now = Date.now();
      const age = now - state.access_created_at;
      const ttl = state.access_expires_in * 1000;

      // Expiring in next 60 seconds?
      if (age > ttl - 60000) {
        console.log("[fyersAuth] Token near expiry → Auto refreshing…");
        await refreshAccessToken();
      }
    } catch (err) {
      console.error("[fyersAuth] Auto-refresh error:", err.message);
    }
  }, 60 * 1000); // CHECK EVERY 1 MINUTE
}

// Start daemon immediately
startAutoRefreshDaemon();

// ------------------------------------------------------------------
// PUBLIC EXPORTS
// ------------------------------------------------------------------
function isExpired() {
  const age = Date.now() - state.access_created_at;
  const ttl = (state.access_expires_in || 0) * 1000;
  return age > ttl - 60000;
}

async function getAccessToken() {
  if (isExpired()) {
    await refreshAccessToken();
  }
  return state.access_token;
}

async function forceRefreshNow() {
  const out = await refreshAccessToken();
  state.last_manual_refresh_at = Date.now();
  saveTokensToDisk(state);

  return { ok: true, access_token: state.access_token, refresh_token: state.refresh_token };
}

function getSocketToken() {
  return `${process.env.FYERS_APP_ID}:${state.access_token}`;
}

function getAuthMeta() {
  return {
    access_token_present: !!state.access_token,
    refresh_token_present: !!state.refresh_token,
    created_at: state.access_created_at,
    expires_in: state.access_expires_in,
    last_auto_refresh_at: state.last_auto_refresh_at,
    last_manual_refresh_at: state.last_manual_refresh_at
  };
}

module.exports = {
  getLoginUrl,
  exchangeAuthCode,
  getAccessToken,
  refreshAccessToken,
  forceRefreshNow,
  getSocketToken,
  getAuthMeta,
  _debugDump: () => state
};
