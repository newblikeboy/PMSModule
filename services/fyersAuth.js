// services/fyersAuth.js
"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Where we persist tokens so refresh works forever
const DATA_DIR   = path.join(__dirname, "../data");
const TOKENS_FILE = path.join(DATA_DIR, "./tokens_fyers.json");

// Make sure /data exists so writeFileSync doesn't crash
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error("[fyersAuth] Failed to ensure data dir:", e);
  }
}

// Load tokens from disk into memory
function loadTokensFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(TOKENS_FILE)) {
      const raw = fs.readFileSync(TOKENS_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("[fyersAuth] loadTokensFromDisk error:", e);
  }

  // default empty structure
  return {
    access_token: null,
    refresh_token: null,
    access_created_at: 0,
    access_expires_in: 0
  };
}

// Save tokens back to disk
function saveTokensToDisk(tokens) {
  ensureDataDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
}

// in-memory cache of tokens
let state = loadTokensFromDisk();

/**
 * getLoginUrl()
 * Step 1 in onboarding.
 * You hit this URL in a browser, login to Fyers, approve.
 * Fyers redirects to FYERS_REDIRECT_URI?auth_code=XXXXX
 */
function getLoginUrl() {
  const appId = process.env.FYERS_APP_ID;
  const redirectUri = process.env.FYERS_REDIRECT_URI;

  if (!appId || !redirectUri) {
    console.error("[fyersAuth] Missing FYERS_APP_ID or FYERS_REDIRECT_URI in env");
  }

  // Fyers auth-code URL style
  return (
    "https://api-t1.fyers.in/api/v3/generate-authcode" +
    "?client_id=" + encodeURIComponent(appId || "") +
    "&redirect_uri=" + encodeURIComponent(redirectUri || "") +
    "&response_type=code" +
    "&state=quantpulse"
  );
}

const crypto = require("crypto");


/**
 * exchangeAuthCode(authCode)
 * Step 2: Turn short-lived auth_code -> long-lived access_token (+ maybe refresh_token)
 * using /validate-authcode as per Fyers v3 docs.
 */
async function exchangeAuthCode(authCode) {
  const appId  = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_APP_SECRET;

  if (!appId || !secret) {
    console.error("[fyersAuth] Missing FYERS_APP_ID / FYERS_APP_SECRET");
    throw new Error("Server env incomplete. Check broker config.");
  }

  if (!authCode) {
    throw new Error("No auth_code provided");
  }

  // Fyers doc: appIdHash = sha256(appId + appSecret) as hex
  const appIdHash = crypto
    .createHash("sha256")
    .update(`${appId}:${secret}`)
    .digest("hex");

  try {
    // Call Fyers documented endpoint:
    // POST https://api-t1.fyers.in/api/v3/validate-authcode
    // Body: { grant_type, appIdHash, code }
    const resp = await axios.post(
      "https://api-t1.fyers.in/api/v3/validate-authcode",
      {
        grant_type: "authorization_code",
        appIdHash: appIdHash,
        code: authCode
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10_000
      }
    );

    const data = resp.data || {};


    if (!data.access_token) {
      console.error("[fyersAuth] Unexpected validate-authcode response:", data);
      throw new Error("Broker did not return access_token");
    }

    // Save in-memory
    state.access_token      = data.access_token;
    state.refresh_token     = data.refresh_token || state.refresh_token || null;
    state.access_created_at = Date.now();
    // Fyers doesn't always return expires_in here. We'll assume 3600s default.
    state.access_expires_in = data.expires_in || state.access_expires_in || 3600;

    saveTokensToDisk(state);

    console.log("[fyersAuth] exchangeAuthCode SUCCESS via validate-authcode. Token saved.");
    return {
      ok: true,
      access_token: state.access_token,
      refresh_token: state.refresh_token || null
    };

  } catch (err) {
    if (err.response) {
      // Fyers sends 401 with { code: -16, message: "Could not authenticate the user", s:"error" }
      console.error(
        "[fyersAuth] exchangeAuthCode Fyers error:",
        err.response.status,
        err.response.data
      );

      throw new Error(
        "Fyers rejected auth_code: " +
        (
          err.response.data && err.response.data.message
            ? err.response.data.message
            : `status ${err.response.status}`
        )
      );
    } else {
      console.error("[fyersAuth] exchangeAuthCode ERROR:", err.message);
      throw new Error("exchangeAuthCode failed: " + err.message);
    }
  }
}


/**
 * refreshAccessToken()
 * Called automatically when access token is expired.
 */
async function refreshAccessToken() {
  const appId  = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_APP_SECRET;

  if (!appId || !secret) {
    const msg = "[fyersAuth] Missing FYERS_APP_ID / FYERS_APP_SECRET for refresh";
    console.error(msg);
    throw new Error("Server env incomplete for refresh.");
  }

  if (!state.refresh_token) {
    console.error("[fyersAuth] No refresh_token saved. You must run auth flow first.");
    throw new Error("No refresh_token saved");
  }

  const appIdHash = Buffer.from(`${appId}:${secret}`).toString("base64");

  try {
    const resp = await axios.post(
      "https://api-t1.fyers.in/api/v3/token",
      {
        grant_type: "refresh_token",
        appIdHash: appIdHash,
        refresh_token: state.refresh_token
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10_000
      }
    );

    const data = resp.data || {};
    if (!data.access_token) {
      console.error("[fyersAuth] Unexpected refresh response:", data);
      throw new Error("Broker did not return access_token on refresh");
    }

    state.access_token       = data.access_token;
    state.refresh_token      = data.refresh_token || state.refresh_token;
    state.access_created_at  = Date.now();
    state.access_expires_in  = data.expires_in || 3600;

    saveTokensToDisk(state);

    console.log("[fyersAuth] refreshAccessToken SUCCESS. New access_token saved.");
    return state.access_token;
  } catch (err) {
    if (err.response) {
      console.error("[fyersAuth] refreshAccessToken Fyers error:", err.response.status, err.response.data);
      throw new Error(
        "Refresh failed at broker: " +
        (err.response.data && err.response.data.message
          ? err.response.data.message
          : `status ${err.response.status}`)
      );
    } else {
      console.error("[fyersAuth] refreshAccessToken ERROR:", err.message);
      throw new Error("refreshAccessToken failed: " + err.message);
    }
  }
}

/**
 * isExpired()
 * Check if current access token is near expiry.
 */
function isExpired() {
  if (!state.access_token) return true;
  const ageMs = Date.now() - (state.access_created_at || 0);
  const ttlMs = (state.access_expires_in || 0) * 1000;
  // Refresh 60s early
  return ageMs > (ttlMs - 60_000);
}

/**
 * getAccessToken()
 * Public helper for SDK calls / socket calls.
 */
async function getAccessToken() {
  if (isExpired()) {
    await refreshAccessToken();
  }
  return state.access_token;
}

/**
 * getSocketToken()
 * For Fyers data socket auth.
 * Most libraries expect "APPID:ACCESSTOKEN"
 */
async function getSocketToken() {
  const appId = process.env.FYERS_APP_ID;
  const access = await getAccessToken();
  return `${appId}:${access}`;
}

module.exports = {
  getLoginUrl,
  exchangeAuthCode,
  getAccessToken,
  refreshAccessToken,
  getSocketToken,
  _debugDump: () => state
};
