  "use strict";

  const axios = require("axios");
  const crypto = require("crypto");
  const User = require("../models/User");

const tempTokens = new Map(); // tokenId -> payload from callback
const TEMP_TTL_MS = 5 * 60 * 1000;

const CFG = {
    API_KEY: process.env.ANGEL_API_KEY,
    API_SECRET: process.env.ANGEL_API_SECRET,
    REDIRECT: process.env.ANGEL_REDIRECT_URL,
    BASE_URL: process.env.ANGEL_BASE_URL || "https://apiconnect.angelbroking.com",
    ORDER_URL:
      process.env.ANGEL_ORDER_URL ||
      "https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/placeOrder",
    PUBLISHER_LOGIN:
      process.env.ANGEL_PUBLISHER_LOGIN || "https://smartapi.angelone.in/publisher-login",
  };

  function ensureConfig() {
    const missing = [];
    if (!CFG.API_KEY) missing.push("ANGEL_API_KEY");
    if (!CFG.API_SECRET) missing.push("ANGEL_API_SECRET");
    if (!CFG.REDIRECT) missing.push("ANGEL_REDIRECT_URL");
    if (missing.length) {
      throw new Error(`Missing Angel env vars: ${missing.join(", ")}`);
    }
  }

function signState(userId) {
  const ts = Date.now();
  const payload = `${userId}:${ts}`;
  const sig = crypto.createHmac("sha256", CFG.API_SECRET || "angel-secret").update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyState(token) {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId, ts, sig] = decoded.split(":");
    if (!userId || !ts || !sig) return null;
    const expected = crypto
      .createHmac("sha256", CFG.API_SECRET || "angel-secret")
      .update(`${userId}:${ts}`)
      .digest("hex");
    if (sig !== expected) return null;
    return userId;
  } catch (err) {
    return null;
  }
}

async function buildLoginUrlForUserId(userId) {
  ensureConfig();
  const user = await User.findById(userId).select("_id email");
  if (!user) throw new Error("user not found");

  const stateToken = signState(user._id);
  const loginUrl = new URL(CFG.PUBLISHER_LOGIN);
  loginUrl.searchParams.set("api_key", CFG.API_KEY);
  loginUrl.searchParams.set("state", stateToken);
  loginUrl.searchParams.set("redirect_url", CFG.REDIRECT);

  return loginUrl.toString();
}

  async function startLogin(req, res) {
    try {
      const authedUser = req.user?._id;
      const targetUser = String(req.query.userId || authedUser || "").trim();
      if (!targetUser) {
        return res.status(400).send("userId required");
      }
      const url = await buildLoginUrlForUserId(targetUser);
      return res.redirect(url);
    } catch (err) {
      console.error("[angel.startLogin] error", err);
      res.status(500).send("Unable to start Angel login");
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
    const displayMsg =
      message || (ok ? "Angel login successful. You may close this window." : "Angel login error.");

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
      <p class="status" id="callbackStatus">${displayMsg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <script>
        (function(){
          const payload = ${payloadJson};
          const canNotify = !!(window.opener && !window.opener.closed);
          try {
            if (canNotify && typeof window.opener.postMessage === "function") {
              window.opener.postMessage(payload, "*");
            }
          } catch (err) {
            console.error("Angel callback postMessage error", err);
          }
          if (canNotify) {
            setTimeout(function(){ try { window.close(); } catch (_) {} }, 1500);
          } else {
            var el = document.getElementById("callbackStatus");
            if (el) {
              el.textContent = payload.message || "Angel login complete. You may close this tab.";
            }
            if (payload.tokens && payload.tokens.tokenId) {
              try {
                localStorage.setItem("qp_angel_pending_token", payload.tokens.tokenId);
              } catch (err) {
                console.warn("Unable to persist Angel tokenId locally:", err);
              }
              setTimeout(function(){
                window.location.replace("/app.html");
              }, 800);
            }
          }
        })();
      </script>
    </body>
  </html>`);
  }

async function handleCallback(req, res) {
  ensureConfig();
  const { auth_token, request_token, feed_token, refresh_token, state, flow } = req.query || {};
  if (!auth_token && !request_token) {
    return renderCallbackPage(res, {
      ok: false,
      message: "Angel did not return a token. Please retry.",
      });
    }

    const decoded = decodeJwt(auth_token);
    const extractedRequestToken = decoded?.token ? String(decoded.token) : request_token;
  const stateToken = flow || state || null;
  const userIdFromState = verifyState(stateToken);

  if (userIdFromState) {
    try {
      await finalizeAngelTokens({
        userId: userIdFromState,
        authToken: auth_token,
        requestToken: extractedRequestToken,
        feedToken: feed_token,
        refreshToken: refresh_token,
      });
      return renderCallbackPage(res, {
        ok: true,
        message: "Angel account linked successfully.",
        tokens: { completed: true },
      });
    } catch (err) {
      console.error("[angel.callback] finalize failed", err?.message || err);
    }
  }

    const tokenId = crypto.randomUUID();
    tempTokens.set(tokenId, {
      authToken: auth_token,
      requestToken: extractedRequestToken,
      feedToken: feed_token,
      refreshToken: refresh_token,
      clientCode: decoded?.username || null,
      createdAt: Date.now(),
    });
    setTimeout(() => tempTokens.delete(tokenId), TEMP_TTL_MS).unref?.();

    return renderCallbackPage(res, {
      ok: true,
      message: "Angel login successful. Completing setup…",
      tokens: {
        tokenId,
        authToken: auth_token,
        requestToken: extractedRequestToken,
        feedToken: feed_token,
        refreshToken: refresh_token,
        clientCode: decoded?.username || null,
      },
    });
  }

  function decodeJwt(token) {
    if (!token) return null;
    try {
      const [, payload] = String(token).split(".");
      if (!payload) return null;
      return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    } catch (err) {
      return null;
    }
  }

  async function exchangeAngelToken({ token, isAuthToken }) {
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
      attempts.push({
        url: `${CFG.BASE_URL}/rest/auth/angelbroking/v2/token`,
        body: { apiKey: CFG.API_KEY, authToken: token },
      });
    }

    const checksum = buildChecksum(token);
    attempts.push({
      url: `${CFG.BASE_URL}/rest/auth/angelbroking/jwt/v1/generateTokens`,
      body: { apiKey: CFG.API_KEY, requestToken: token, checksum },
    });

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const resp = await axios.post(attempt.url, attempt.body, { headers, timeout: 15000 });
        const data = resp?.data?.data || resp?.data || {};
        const accessToken = data.jwtToken || data.access_token || data.token;
        if (!accessToken) throw new Error("Angel response missing access token");
        return {
          accessToken,
          refreshToken: data.refreshToken || data.refresh_token || null,
          raw: resp.data,
        };
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Angel token exchange failed");
  }

  function buildChecksum(token) {
    if (!token) return null;
    try {
      return crypto.createHash("sha256").update(`${CFG.API_KEY}${token}${CFG.API_SECRET}`).digest("hex");
    } catch (err) {
      return null;
    }
  }

async function finalizeAngelTokens({ userId, authToken, requestToken, feedToken, refreshToken }) {
    const token = authToken || requestToken;
    if (!token) throw new Error("authToken or requestToken required");

    const exchange = await exchangeAngelToken({
      token,
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

  async function completeFromClient(req, res) {
    try {
      ensureConfig();
      const userId = req.user?._id;
      if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

      const { authToken, requestToken, feedToken, refreshToken, tokenId } = req.body || {};
      let tokens = { authToken, requestToken, feedToken, refreshToken };

      if (!tokens.authToken && !tokens.requestToken && tokenId && tempTokens.has(tokenId)) {
        tokens = tempTokens.get(tokenId);
        tempTokens.delete(tokenId);
      }

      const result = await finalizeAngelTokens({
        userId,
        authToken: tokens.authToken,
        requestToken: tokens.requestToken,
        feedToken: tokens.feedToken,
        refreshToken: tokens.refreshToken,
      });

      return res.json({ ok: true, angel: result.angel });
    } catch (err) {
      console.error("[angel.complete] error", err?.response?.data || err);
      res.status(500).json({ ok: false, error: err?.message || "Angel token exchange failed" });
    }
  }

  async function getStoredTokens(req, res) {
    try {
      const tokenId = req.params?.tokenId || req.query?.tokenId;
      if (!tokenId || !tempTokens.has(tokenId)) {
        return res.status(404).json({ ok: false, error: "Token not found or expired" });
      }
      const tokens = tempTokens.get(tokenId);
      tempTokens.delete(tokenId);
      res.json({ ok: true, tokens });
    } catch (err) {
      res.status(500).json({ ok: false, error: "Failed to retrieve tokens" });
    }
  }

  async function welcome(_req, res) {
    res.json({ ok: true, message: "Angel Publisher ready" });
  }

  module.exports = {
    buildLoginUrlForUserId,
    startLogin,
    handleCallback,
    completeFromClient,
    getStoredTokens,
    finalizeAngelTokens,
    welcome,
  };
