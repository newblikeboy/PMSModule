// services/angel.publisher.service.js
"use strict";

/**
 * Angel One Publisher login flow (multi-user) with robust user resolution:
 * - /auth/angel/login    -> sets a short-lived cookie (angel_uid) and redirects to publisher login
 * - /auth/angel/callback -> receives ?auth_token (&feed_token, &refresh_token)
 *                           identifies the user via state | uid | cookie, and saves tokens
 *
 * Requires ENV:
 *   ANGEL_API_KEY
 *   ANGEL_REDIRECT_URL         (exact URL registered in Angel dashboard)
 *   ANGEL_PUBLISHER_LOGIN      (defaults to https://smartapi.angelone.in/publisher-login)
 *   ANGEL_BASE                 (defaults to https://apiconnect.angelbroking.com)
 */

const axios = require("axios");
const User = require("../models/User");

const CFG = {
  API_KEY: process.env.ANGEL_API_KEY,
  REDIRECT: process.env.ANGEL_REDIRECT_URL,
  PUBLISHER_LOGIN: process.env.ANGEL_PUBLISHER_LOGIN || "https://smartapi.angelone.in/publisher-login",
  BASE: process.env.ANGEL_BASE || "https://apiconnect.angelbroking.com",
};

// ---------- helpers ----------
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

function setCookie(res, name, value, { maxAgeSec = 600, path = "/", httpOnly = true, sameSite = "Lax" } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSec}`,
    httpOnly ? "HttpOnly" : "",
    sameSite ? `SameSite=${sameSite}` : "",
  ].filter(Boolean);
  // allow multiple set-cookie headers
  const prev = res.getHeader("Set-Cookie");
  if (prev) {
    const arr = Array.isArray(prev) ? prev : [prev];
    arr.push(parts.join("; "));
    res.setHeader("Set-Cookie", arr);
  } else {
    res.setHeader("Set-Cookie", parts.join("; "));
  }
}

function getCookie(req, name) {
  const raw = req.headers?.cookie || "";
  if (!raw) return null;
  const parts = raw.split(/;\s*/);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return decodeURIComponent(rest.join("=") || "");
  }
  return null;
}

// ---------- routes ----------

/**
 * Start Publisher login:
 * - requires authenticated user (route should have authRequired)
 * - sets angel_uid cookie as fallback user identity
 * - redirects to Publisher login with state & uid
 */
async function startLogin(req, res) {
  try {
    assertEnv();

    const authedUserId = req.user?._id?.toString?.();
    const userId = String(req.query.userId || authedUserId || "").trim();
    if (!userId) return res.status(400).send("userId required (or pass Authorization Bearer)");

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("user not found");

    // set short-lived cookie in case Angel drops state/uid
    setCookie(res, "angel_uid", userId, { maxAgeSec: 600 });

    const url = new URL(CFG.PUBLISHER_LOGIN);
    url.searchParams.set("api_key", CFG.API_KEY);
    url.searchParams.set("redirect_url", CFG.REDIRECT);

    // send both; some environments drop state
    url.searchParams.set("state", userId);
    url.searchParams.set("uid", userId);

    return res.redirect(url.toString());
  } catch (e) {
    console.error("[angel.publisher] startLogin error:", e?.message || e);
    res.status(500).send("startLogin error");
  }
}

/**
 * Callback:
 * Accepts:
 *   ?auth_token=... (&feed_token=..., &refresh_token=...)
 * or legacy:
 *   ?request_token=... (&state=...)
 *
 * Identifies user by priority: state -> uid -> angel_uid cookie.
 * Saves tokens to user.broker.creds and renders an auto-close page.
 */
async function handleCallback(req, res) {
  try {
    assertEnv();

    const { auth_token, feed_token, refresh_token, request_token, state, uid } = req.query;

    // Identify user (no auth header in popup; rely on query or cookie)
    let userId = String(state || uid || "").trim();
    if (!userId) {
      const fromCookie = getCookie(req, "angel_uid");
      if (fromCookie) userId = String(fromCookie).trim();
    }
    if (!userId) return res.status(400).send("cannot identify user (missing state/uid/cookie)");

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("user not found");

    let accessToken = null;
    let refreshToken = null;

    if (auth_token) {
      // direct Publisher JWT
      accessToken = String(auth_token);
      if (refresh_token) refreshToken = String(refresh_token);
    } else if (request_token) {
      // exchange legacy request_token -> JWT
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

    // persist tokens
    user.broker = user.broker || {};
    user.broker.brokerName = "ANGEL";
    user.broker.connected = true;
    user.broker.creds = user.broker.creds || {};
    user.broker.creds.apiKey = CFG.API_KEY;
    user.broker.creds.accessToken = accessToken;
    if (refreshToken) user.broker.creds.refreshToken = refreshToken;
    if (feed_token) user.broker.creds.feedToken = String(feed_token);

    await user.save();

    // clear the temp cookie
    setCookie(res, "angel_uid", "", { maxAgeSec: 0 });

    // silent auto-close page (no redirect)
    return res.status(200).type("html").send(`<!doctype html>
<meta charset="utf-8">
<script>
try {
  window.opener && window.opener.postMessage({ ok:true, provider:"angel", tokenSaved:true }, window.location.origin);
} catch(e) {}
try { window.close(); } catch(e) {}
setTimeout(()=>{ document.body.textContent="Angel login successful. You can close this window."; }, 300);
</script>`);
  } catch (e) {
    console.error("[angel.publisher] callback error:", e?.response?.data || e?.message || e);
    res.status(500).send("Callback error");
  }
}

module.exports = {
  startLogin,
  handleCallback,
};
