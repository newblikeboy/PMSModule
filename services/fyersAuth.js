// services/fyersAuth.js
"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const TOKENS_FILE = path.join(__dirname, "../data/tokens_fyers.json");

// load from disk if exists
function loadTokensFromDisk() {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return {
      access_token: null,
      refresh_token: null,
      access_created_at: 0,
      access_expires_in: 0
    };
  }
}

// save to disk
function saveTokensToDisk(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
}

// in-memory cache
let state = loadTokensFromDisk();

/**
 * getLoginUrl()
 * - You open this in browser manually (one-time)
 * - You login to Fyers and approve
 * - Fyers redirects back to redirect_uri with "auth_code"
 * - Then you call exchangeAuthCode(auth_code) below
 *
 * NOTE: depends on Fyers v3 login pattern.
 */
function getLoginUrl() {
  const appId = process.env.FYERS_APP_ID;
  const redirectUri = process.env.FYERS_REDIRECT_URI;

  // Fyers docs v3 format (example style):
  // https://api-t1.fyers.in/api/v3/generate-authcode?client_id=<app_id>&redirect_uri=<uri>&response_type=code&state=xyz
  const url =
    "https://api-t1.fyers.in/api/v3/generate-authcode"
    + "?client_id=" + encodeURIComponent(appId)
    + "&redirect_uri=" + encodeURIComponent(redirectUri)
    + "&response_type=code"
    + "&state=quantpulse";

  return url;
}

/**
 * exchangeAuthCode(auth_code)
 * - After you login once manually and grab ?auth_code=XXXXX
 * - We call this to get first access_token + refresh_token
 */
async function exchangeAuthCode(authCode) {
  const appId = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_APP_SECRET;
  const redirectUri = process.env.FYERS_REDIRECT_URI;

  // Fyers token endpoint v3
  // POST https://api-t1.fyers.in/api/v3/token
  // body:
  // {
  //   "grant_type": "authorization_code",
  //   "appIdHash": "<appId:secret base64 or hashed per fyers doc>",
  //   "code": "<auth_code>",
  //   "redirect_uri": "<redirectUri>"
  // }

  // ⚠ IMPORTANT:
  // Fyers v3 requires appIdHash = base64(app_id:app_secret)
  const appIdHash = Buffer.from(`${appId}:${secret}`).toString("base64");

  const resp = await axios.post(
    "https://api-t1.fyers.in/api/v3/token",
    {
      grant_type: "authorization_code",
      appIdHash: appIdHash,
      code: authCode,
      redirect_uri: redirectUri
    },
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  // Response generally contains:
  // {
  //   "access_token": "...",
  //   "refresh_token": "...",
  //   "expires_in": 3600,
  //   ...
  // }

  const data = resp.data || {};

  state.access_token = data.access_token;
  state.refresh_token = data.refresh_token;
  state.access_created_at = Date.now();
  state.access_expires_in = data.expires_in || 3600;

  saveTokensToDisk(state);

  return {
    ok: true,
    access_token: state.access_token,
    refresh_token: state.refresh_token
  };
}

/**
 * refreshAccessToken()
 * - When access token expires, use refresh_token to get a new one
 */
async function refreshAccessToken() {
  if (!state.refresh_token) {
    throw new Error("No refresh_token saved. Do initial login first.");
  }

  const appId = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_APP_SECRET;
  const appIdHash = Buffer.from(`${appId}:${secret}`).toString("base64");

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
      }
    }
  );

  const data = resp.data || {};

  state.access_token = data.access_token;
  state.refresh_token = data.refresh_token || state.refresh_token;
  state.access_created_at = Date.now();
  state.access_expires_in = data.expires_in || 3600;

  saveTokensToDisk(state);

  return state.access_token;
}

/**
 * isExpired()
 * Checks if our in-memory access token is expired or near expiry.
 * We'll refresh a little early to be safe.
 */
function isExpired() {
  if (!state.access_token) return true;
  const ageMs = Date.now() - (state.access_created_at || 0);
  const ttlMs = (state.access_expires_in || 0) * 1000;
  // refresh 60s early
  return ageMs > (ttlMs - 60_000);
}

/**
 * getAccessToken()
 * This is what everyone else in the code should call.
 * It guarantees a valid access token.
 */
async function getAccessToken() {
  if (isExpired()) {
    await refreshAccessToken();
  }
  return state.access_token;
}

module.exports = {
  getLoginUrl,
  exchangeAuthCode,
  getAccessToken,
  refreshAccessToken,
  // exposed mostly for debugging:
  _debugDump: () => state
};
