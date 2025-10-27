"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const TOKENS_FILE = path.join(__dirname, "../data/tokens_fyers.json");

function loadTokensFromDisk() {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { access_token: null, refresh_token: null, access_created_at: 0, access_expires_in: 0 };
  }
}

function saveTokensToDisk(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
}

let state = loadTokensFromDisk();

function getLoginUrl() {
  const appId = process.env.FYERS_APP_ID;
  const redirectUri = process.env.FYERS_REDIRECT_URI;
  return (
    "https://api-t1.fyers.in/api/v3/generate-authcode" +
    "?client_id=" + encodeURIComponent(appId) +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&response_type=code&state=quantpulse"
  );
}

async function exchangeAuthCode(authCode) {
  const appId = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_APP_SECRET;
  const redirectUri = process.env.FYERS_REDIRECT_URI;
  const appIdHash = Buffer.from(`${appId}:${secret}`).toString("base64");

  const resp = await axios.post(
    "https://api-t1.fyers.in/api/v3/token",
    { grant_type: "authorization_code", appIdHash, code: authCode, redirect_uri: redirectUri },
    { headers: { "Content-Type": "application/json" } }
  );

  const data = resp.data || {};
  state = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_created_at: Date.now(),
    access_expires_in: data.expires_in || 3600
  };
  saveTokensToDisk(state);
  return { ok: true, ...state };
}

async function refreshAccessToken() {
  if (!state.refresh_token) throw new Error("No refresh_token saved");
  const appId = process.env.FYERS_APP_ID;
  const secret = process.env.FYERS_APP_SECRET;
  const appIdHash = Buffer.from(`${appId}:${secret}`).toString("base64");

  const resp = await axios.post(
    "https://api-t1.fyers.in/api/v3/token",
    { grant_type: "refresh_token", appIdHash, refresh_token: state.refresh_token },
    { headers: { "Content-Type": "application/json" } }
  );

  const data = resp.data || {};
  state = {
    ...state,
    access_token: data.access_token,
    refresh_token: data.refresh_token || state.refresh_token,
    access_created_at: Date.now(),
    access_expires_in: data.expires_in || 3600
  };
  saveTokensToDisk(state);
  return state.access_token;
}

function isExpired() {
  if (!state.access_token) return true;
  const age = Date.now() - state.access_created_at;
  const ttl = (state.access_expires_in || 0) * 1000;
  return age > (ttl - 60_000);
}

async function getAccessToken() {
  if (isExpired()) await refreshAccessToken();
  return state.access_token;
}

/**
 * 🔥 getSocketToken()
 * - Needed for WebSocket streaming.
 * - Fyers requires format: APP_ID:ACCESS_TOKEN
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
