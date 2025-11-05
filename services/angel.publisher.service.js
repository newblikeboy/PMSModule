// services/angel.publisher.service.js
"use strict";

/**
 * Angel One Publisher OAuth-like flow (multi-user):
 * - GET /auth/angel/login      -> redirect user to Angel publisher-login
 * - GET /auth/angel/callback   -> Angel redirects back with request_token (+ state)
 *   We exchange request_token -> accessToken (JWT) and store it on the user.
 *
 * Tokens are saved into User.broker.* so your existing UI stays compatible:
 *   user.broker = {
 *     brokerName: "ANGEL",
 *     connected: true,
 *     creds: {
 *       apiKey: ANGEL_API_KEY,
 *       accessToken: <JWT>,
 *       refreshToken: <optional>
 *     }
 *   }
 *
 * ENV required:
 *   ANGEL_API_KEY=your_publisher_app_key
 *   ANGEL_REDIRECT_URL=https://your.domain/auth/angel/callback
 *   ANGEL_BASE=https://apiconnect.angelbroking.com
 *   ANGEL_PUBLISHER_LOGIN=https://smartapi.angelone.in/publisher-login
 */

const axios = require("axios");
const User = require("../models/User");

const CFG = {
  API_KEY: process.env.ANGEL_API_KEY,
  REDIRECT: process.env.ANGEL_REDIRECT_URL,
  PUBLISHER_LOGIN:
    process.env.ANGEL_PUBLISHER_LOGIN || "https://smartapi.angelone.in/publisher-login",
  BASE: process.env.ANGEL_BASE || "https://apiconnect.angelbroking.com",
};

function assertEnv() {
  const miss = [];
  if (!CFG.API_KEY) miss.push("ANGEL_API_KEY");
  if (!CFG.REDIRECT) miss.push("ANGEL_REDIRECT_URL");
  if (miss.length) throw new Error(`[angel.publisher] Missing env: ${miss.join(", ")}`);
}

function baseHeaders(apiKey, accessToken) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": apiKey,
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "AA-BB-CC-11-22-33",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

/**
 * Start Publisher login.
 * If you mount this behind authRequired, it will use req.user._id automatically.
 * Fallback: accepts ?userId=... for admin-initiated flows.
 */
async function buildLoginUrlForUserId(userId) {
  assertEnv();

  const id = String(userId || "").trim();
  if (!id) {
    throw new Error("userId required");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new Error("user not found");
  }

  const url = new URL(CFG.PUBLISHER_LOGIN);
  url.searchParams.set("api_key", CFG.API_KEY);
  url.searchParams.set("redirect_url", CFG.REDIRECT);
  url.searchParams.set("state", id);

  return url.toString();
}

async function startLogin(req, res) {
  try {
    assertEnv();

    // must be authenticated due to route middleware; fallback to query if admin is initiating
    const authedUserId = req.user?._id?.toString?.();
    const userId = String(req.query.userId || authedUserId || "").trim();
    if (!userId) return res.status(400).send("userId required (or pass Authorization Bearer)");

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("user not found");

    const url = new URL(CFG.PUBLISHER_LOGIN);
    url.searchParams.set("api_key", CFG.API_KEY);
    url.searchParams.set("redirect_url", CFG.REDIRECT);

    // We send both state and uid because some environments drop state.
    url.searchParams.set("state", userId);
    url.searchParams.set("uid", userId);

    return res.redirect(url.toString());
  } catch (e) {
    console.error("[angel.publisher] startLogin error:", e?.message || e);
    res.status(500).send("startLogin error");
  }
}

/**
 * Callback from Angel with ?request_token=&state=
 * Exchanges request_token -> JWT, stores on the user record.
 */
// services/angel.publisher.service.js
async function handleCallback(req, res) {
  try {
    assertEnv();

    // Publisher sends ?auth_token=... (&feed_token=...)  OR older flow ?request_token=...
    const { auth_token, feed_token, request_token, state, uid } = req.query;

    // Identify user: prefer state -> uid -> req.user (route is authProtected)
    const userId =
      String(state || uid || req.user?._id || "").trim();

    if (!userId) return res.status(400).send("cannot identify user (no state/uid and not authenticated)");

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("user not found");

    let accessToken = null;
    let refreshToken = null;

    if (auth_token) {
      accessToken = String(auth_token);
    } else if (request_token) {
      const url = `${CFG.BASE}/rest/auth/angelbroking/jwt/v1/generateTokens`;
      const resp = await axios.post(
        url,
        { apiKey: CFG.API_KEY, requestToken: request_token },
        { headers: baseHeaders(CFG.API_KEY, null), timeout: 12000 }
      );
      const data = resp?.data?.data || resp?.data || {};
      accessToken = data?.jwtToken || data?.access_token || data?.token || null;
      refreshToken = data?.refreshToken || data?.refresh_token || null;
      if (!accessToken) {
        console.error("[angel.publisher] token exchange failed:", resp?.data);
        return res.status(500).send("Token exchange failed");
      }
    } else {
      return res.status(400).send("missing auth_token/request_token");
    }

    // Persist to user.broker
    user.broker = user.broker || {};
    user.broker.brokerName = "ANGEL";
    user.broker.connected = true;
    user.broker.creds = user.broker.creds || {};
    user.broker.creds.apiKey = CFG.API_KEY;
    user.broker.creds.accessToken = accessToken;
    if (refreshToken) user.broker.creds.refreshToken = refreshToken;
    if (feed_token) user.broker.creds.feedToken = String(feed_token);

    await user.save();

    return res.send(
      `<html><body><script>
        try{window.opener && window.opener.postMessage({ok:true,provider:"angel"}, "*");}catch(e){}
        window.close && window.close();
      </script>
      <p>Angel login successful. You may close this window.</p></body></html>`
    );
  } catch (e) {
    console.error("[angel.publisher] callback error:", e?.response?.data || e?.message || e);
    res.status(500).send("Callback error");
  }
}

module.exports = {
  startLogin,
  handleCallback,
  buildLoginUrlForUserId,
};
