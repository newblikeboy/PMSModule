"use strict";

/**
 * Angel One Publisher OAuth bridge (multi-user).
 *
 * Responsibilities:
 *   1. Generate SmartAPI login URLs for a specific user.
 *   2. Render a callback page that forwards tokens to the opener via postMessage.
 *   3. Expose an authenticated API handler to exchange & persist tokens for the user.
 *
 * The callback no longer attempts to identify the user (Angel drops custom state params).
 * Instead, the popup posts the raw tokens back to the main app, which then calls the
 * authenticated /user/angel/complete endpoint so we know which user to save for.
 */

const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");

// Temporary storage for tokens when postMessage fails
const tempTokens = new Map();
const pendingAngelFlows = new Map();
const FLOW_TTL_MS = 15 * 60 * 1000;

const CFG = {
  API_KEY: process.env.ANGEL_API_KEY,
  API_SECRET: process.env.ANGEL_API_SECRET,
  REDIRECT: process.env.ANGEL_REDIRECT_URL,
  PUBLISHER_LOGIN:
    process.env.ANGEL_PUBLISHER_LOGIN || "https://smartapi.angelone.in/publisher-login",
  BASE: process.env.ANGEL_BASE || "https://apiconnect.angelbroking.com",
};

function ensureConfig() {
  const missing = [];
  if (!CFG.API_KEY) missing.push("ANGEL_API_KEY");
  if (!CFG.API_SECRET) missing.push("ANGEL_API_SECRET");
  if (!CFG.REDIRECT) missing.push("ANGEL_REDIRECT_URL");
  if (missing.length) {
    throw new Error(`[angel.publisher] Missing env: ${missing.join(", ")}`);
  }
}

async function buildLoginUrlForUserId(userId) {
  ensureConfig();

  const id = String(userId || "").trim();
  if (!id) throw new Error("userId required");

  const user = await User.findById(id);
  if (!user) throw new Error("user not found");

  const flowId = registerFlow(id);

  const loginUrl = new URL(CFG.PUBLISHER_LOGIN);
  loginUrl.searchParams.set("api_key", CFG.API_KEY);
  loginUrl.searchParams.set("state", flowId);

  const redirectUrl = new URL(CFG.REDIRECT);
  redirectUrl.searchParams.set("flow", flowId);
  loginUrl.searchParams.set("redirect_url", redirectUrl.toString());
  return loginUrl.toString();
}

async function startLogin(req, res) {
  try {
    ensureConfig();
    const authedUserId = req.user?._id?.toString?.();
    const targetUserId = String(req.query.userId || authedUserId || "").trim();
    if (!targetUserId) {
      return res.status(400).send("userId required (or pass Authorization Bearer)");
    }

    const url = await buildLoginUrlForUserId(targetUserId);
    return res.redirect(url);
  } catch (err) {
    console.error("[angel.publisher] startLogin error", {
      message: err?.message,
      stack: err?.stack,
    });
    res.status(500).send("startLogin error");
  }
}

function renderCallbackPage(res, { ok, message, tokens }) {
  const payload = {
    ok,
    provider: "angel",
    message: message || "",
    tokens: tokens || {},
  };

  const payloadJson = JSON.stringify(payload);
  const displayMsg = message || (ok ? "Angel login successful. You may close this window." : "Angel login error.");

  res
    .status(ok ? 200 : 400)
    .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Angel One Connect</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 32px; text-align: center; }
      .status { font-size: 18px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h2>Angel One</h2>
    <p class="status">${displayMsg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    <script>
      (function(){
        const payload = ${payloadJson};
        try {
          if (window.opener && typeof window.opener.postMessage === "function") {
            window.opener.postMessage(payload, "*");
          }
        } catch (err) {
          console.error("Angel callback postMessage error", err);
        }
        setTimeout(function(){ window.close && window.close(); }, 1500);
      })();
    </script>
  </body>
</html>`);
}

function registerFlow(userId) {
  const flowId = crypto.randomUUID();
  pendingAngelFlows.set(flowId, { userId: String(userId), createdAt: Date.now() });
  setTimeout(() => pendingAngelFlows.delete(flowId), FLOW_TTL_MS).unref?.();
  return flowId;
}

function consumeFlow(flowId) {
  if (!flowId) return null;
  const entry = pendingAngelFlows.get(flowId);
  if (entry) pendingAngelFlows.delete(flowId);
  return entry;
}

async function handleCallback(req, res) {
  console.info("[angel.publisher] callback hit", { query: req.query });
  ensureConfig();

  const authToken = req.query.auth_token ? String(req.query.auth_token) : null;
  const requestToken = req.query.request_token ? String(req.query.request_token) : null;
  const feedToken = req.query.feed_token ? String(req.query.feed_token) : null;
  const refreshToken = req.query.refresh_token ? String(req.query.refresh_token) : null;
  const state = req.query.state ? String(req.query.state) : null; // userId if preserved

  if (!authToken && !requestToken) {
    console.error("[angel.publisher] callback missing tokens", { query: req.query });
    return renderCallbackPage(res, {
      ok: false,
      message: "Angel did not return a token. Please retry.",
    });
  }

  const decoded = decodeJwt(authToken);
  const extractedRequestToken = decoded?.token ? String(decoded.token) : requestToken;
  const flowId = String(req.query.flow || req.query.state || "");
  const flowEntry = consumeFlow(flowId);

  if (flowEntry) {
    try {
      await finalizeAngelTokens({
        userId: flowEntry.userId,
        authToken,
        requestToken: extractedRequestToken,
        feedToken,
        refreshToken,
      });

      return renderCallbackPage(res, {
        ok: true,
        message: "Angel account linked successfully. You can close this window.",
        tokens: { completed: true, flowId },
      });
    } catch (err) {
      console.error("[angel.callback] Flow finalization failed:", err?.message || err);
      // Fall through to postMessage fallback
    }
  }

  // If state (userId) is present, try to save directly for that user
  if (state) {
    try {
      const user = await User.findById(state);
      if (user) {
        console.log(`[angel.callback] Saving tokens directly for user ${state}`);

        const exchange = await exchangeAngelToken({
          token: authToken || extractedRequestToken,
          isAuthToken: Boolean(authToken),
        });

        user.broker = user.broker || {};
        user.broker.brokerName = "ANGEL";
        user.broker.connected = true;
        user.broker.creds = {
          ...(user.broker.creds || {}),
          apiKey: CFG.API_KEY,
          accessToken: exchange.accessToken,
          refreshToken: exchange.refreshToken || refreshToken || null,
          authToken: authToken || null,
          feedToken: feedToken || null,
          clientCode: decoded?.username || null,
          exchangedAt: new Date().toISOString(),
          exchangeMeta: exchange.raw || null,
        };

        await user.save();

        console.log(`[angel.callback] Tokens saved successfully for user ${state}`);

        return renderCallbackPage(res, {
          ok: true,
          message: "Angel account linked successfully. You can close this window.",
          tokens: {}, // no need to send back
        });
      } else {
        console.warn(`[angel.callback] User not found for state ${state}`);
      }
    } catch (err) {
      console.error("[angel.callback] Direct save failed:", err?.message || err);
      // Fall back to postMessage flow
    }
  }

  // Fallback: postMessage flow for popup
  // Store tokens temporarily in case postMessage fails
  const tokenId = crypto.randomUUID();
  tempTokens.set(tokenId, {
    authToken,
    requestToken: extractedRequestToken,
    feedToken,
    refreshToken,
    clientCode: decoded?.username || null,
    timestamp: Date.now(),
  });

  // Clean up old tokens after 5 minutes
  setTimeout(() => tempTokens.delete(tokenId), 5 * 60 * 1000);

  return renderCallbackPage(res, {
    ok: true,
    message: "Angel login successful. Completing setup…",
    tokens: {
      authToken,
      requestToken: extractedRequestToken,
      feedToken,
      refreshToken,
      clientCode: decoded?.username || null,
      tokenId, // Include tokenId for fallback retrieval
    },
  });
}

function buildChecksum(token) {
  if (!token) return null;
  try {
    return crypto
      .createHash("sha256")
      .update(`${CFG.API_KEY}${token}${CFG.API_SECRET}`)
      .digest("hex");
  } catch (_err) {
    return null;
  }
}

async function exchangeAngelToken({ token, isAuthToken }) {
  const checksum = buildChecksum(token);
  const basePayload = { apiKey: CFG.API_KEY };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": CFG.API_KEY,
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "AA-BB-CC-11-22-33",
  };

  const attempts = [];
  if (isAuthToken) {
    // For authToken, do not include checksum
    attempts.push({
      url: `${CFG.BASE}/rest/auth/angelbroking/v2/token`,
      body: { ...basePayload, authToken: token },
    });
  }
  // Always try requestToken endpoint, with checksum if available
  const requestPayload = { ...basePayload };
  if (checksum) requestPayload.checksum = checksum;
  attempts.push({
    url: `${CFG.BASE}/rest/auth/angelbroking/jwt/v1/generateTokens`,
    body: { ...requestPayload, requestToken: token },
  });

  let lastError = null;
  for (const attempt of attempts) {
    try {
      console.log(`[angel.exchange] Attempting ${attempt.url}`, { bodyKeys: Object.keys(attempt.body) });
      const resp = await axios.post(attempt.url, attempt.body, { headers, timeout: 15000 });
      const payload = resp?.data?.data || resp?.data || {};
      const accessToken =
        payload?.jwtToken || payload?.access_token || payload?.token || null;
      const refreshToken =
        payload?.refreshToken || payload?.refresh_token || null;
      if (accessToken) {
        console.log(`[angel.exchange] Success with ${attempt.url}`);
        return {
          accessToken,
          refreshToken,
          raw: resp?.data,
        };
      }
      lastError = new Error("Angel exchange response missing access token");
    } catch (err) {
      console.error(`[angel.exchange] Failed ${attempt.url}`, err?.response?.data || err.message);
      lastError = err;
    }
  }
  throw lastError || new Error("Angel token exchange failed");
}

function decodeJwt(jwt) {
  if (!jwt) return null;
  try {
    const parts = String(jwt).split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload);
  } catch (_err) {
    return null;
  }
}

async function completeFromClient(req, res) {
  try {
    ensureConfig();
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const { authToken, requestToken, feedToken, refreshToken, tokenId } = req.body || {};

    let tokens = { authToken, requestToken, feedToken, refreshToken };

    // If postMessage failed and tokenId is provided, retrieve from temp storage
    if (tokenId && tempTokens.has(tokenId)) {
      tokens = tempTokens.get(tokenId);
      tempTokens.delete(tokenId); // Remove after use
    }

    const result = await finalizeAngelTokens({
      userId,
      authToken: tokens.authToken,
      requestToken: tokens.requestToken,
      feedToken: tokens.feedToken,
      refreshToken: tokens.refreshToken,
    });

    return res.json({
      ok: true,
      angel: result.angel,
    });
  } catch (err) {
    console.error("[angel.publisher] complete error", {
      message: err?.message,
      response: err?.response?.data,
      stack: err?.stack,
    });
    return res.status(500).json({ ok: false, error: "Angel token exchange failed" });
  }
}

async function finalizeAngelTokens({ userId, authToken, requestToken, feedToken, refreshToken }) {
  const tokenForExchange = authToken || requestToken;
  if (!tokenForExchange) {
    throw new Error("authToken or requestToken required");
  }

  console.log(
    `[angel.finalize] Exchanging tokens for user ${userId}, hasAuth=${!!authToken}, hasRequest=${!!requestToken}`
  );

  const exchange = await exchangeAngelToken({
    token: tokenForExchange,
    isAuthToken: Boolean(authToken),
  });

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const decoded = decodeJwt(authToken);
  const clientCode = decoded?.username || user.broker?.creds?.clientCode || null;

  user.broker = user.broker || {};
  user.broker.brokerName = "ANGEL";
  user.broker.connected = true;
  user.broker.creds = {
    ...(user.broker.creds || {}),
    apiKey: CFG.API_KEY,
    accessToken: exchange.accessToken,
    refreshToken: exchange.refreshToken || refreshToken || null,
    authToken: authToken || null,
    feedToken: feedToken || null,
    clientCode,
    exchangedAt: new Date().toISOString(),
    exchangeMeta: exchange.raw || null,
  };

  await user.save();
  console.log(`[angel.finalize] User ${userId} updated with Angel tokens (clientCode: ${clientCode || "n/a"})`);

  return {
    clientCode,
    angel: {
      brokerConnected: true,
      brokerName: "ANGEL",
      clientCode,
      allowedMarginPercent:
        typeof user.angelAllowedMarginPct === "number"
          ? Math.round(user.angelAllowedMarginPct * 100)
          : null,
      liveEnabled: !!user.angelLiveEnabled,
    },
  };
}

async function getStoredTokens(req, res) {
  try {
    const tokenId = req.params?.tokenId || req.query?.tokenId;
    if (!tokenId || !tempTokens.has(tokenId)) {
      return res.status(404).json({ ok: false, error: "Token not found or expired" });
    }

    const tokens = tempTokens.get(tokenId);
    tempTokens.delete(tokenId); // Remove after retrieval

    res.json({ ok: true, tokens });
  } catch (err) {
    console.error("[angel.getStoredTokens] error", err);
    res.status(500).json({ ok: false, error: "Failed to retrieve tokens" });
  }
}

async function welcome(req, res) {
  console.log(`[angel.welcome] Request: ${req.method} ${req.path}`);
  res.json({ message: "Welcome to Angel Publisher Service!" });
}

module.exports = {
  startLogin,
  handleCallback,
  buildLoginUrlForUserId,
  finalizeAngelTokens,
  completeFromClient,
  getStoredTokens,
  welcome,
};
