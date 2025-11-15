// services/angel.publisher.service.js
"use strict";

const axios = require("axios");
const User = require("../models/User");
const url = require("url");
const qs = require("querystring");

/**
 * Build Angel Publisher login URL (Publisher flow)
 */
function buildLoginUrlForUserId(userId) {
  if (!userId) throw new Error("userId is required");

  const PUBLISHER_BASE =
    process.env.ANGEL_PUBLISHER_LOGIN ||
    "https://smartapi.angelbroking.com/publisher-login/";

  const API_KEY =
    process.env.ANGEL_API_KEY || process.env.ANGEL_PUBLISHER_KEY;

  if (!API_KEY) {
    throw new Error("Missing publisher API key (set ANGEL_API_KEY)");
  }

  // Angel ignores custom params in redirect_url; user tracking is done via session
  const redirectBase =
    process.env.ANGEL_REDIRECT_URL ||
    `${process.env.APP_HOST}/auth/angel/callback`;

  const finalUrl = new URL(PUBLISHER_BASE);
  finalUrl.searchParams.set("api_key", API_KEY);
  finalUrl.searchParams.set("redirect_url", redirectBase);

  console.log("🔗 [Angel] Building Publisher login URL");
  console.log("   API Key     :", API_KEY);
  console.log("   Redirect URL:", redirectBase);
  console.log("   Final URL   :", finalUrl.toString());

  return finalUrl.toString();
}

/**
 * Step 1 → Start Angel login redirect
 */
async function startLogin(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      console.log("❌ [Angel Login] No user session found");
      return res.status(401).send("Not logged in");
    }

    // Save to session for callback correlation
    if (req.session) {
      req.session.pendingBrokerConnect = {
        provider: "ANGEL",
        userId: userId.toString(),
        createdAt: Date.now(),
      };
      console.log("💾 [Angel Login] Stored userId in session:", userId);
    } else {
      console.warn("⚠️ [Angel Login] No session available — fallback will use req.user");
    }

    const loginUrl = buildLoginUrlForUserId(userId);
    console.log(`✅ [Angel Login] Redirecting user ${userId} → ${loginUrl}`);

    return res.redirect(loginUrl);
  } catch (err) {
    console.error("💥 [Angel Login Error]", err);
    return res.status(500).send("Unable to start Angel login");
  }
}

/**
 * Parse messy query string from Angel callback
 */
function parseMessyQuery(originalUrl) {
  const parsed = url.parse(originalUrl);
  const rawQuery = parsed.query || "";
  const params = qs.parse(rawQuery);

  const pick = (val) => (Array.isArray(val) ? val.find(Boolean) || val[0] : val);

  const cleaned = {
    auth_token: pick(params.auth_token),
    feed_token: pick(params.feed_token),
    refresh_token: pick(params.refresh_token),
  };

  console.log("🧩 [Angel Callback] Parsed tokens:", {
    auth_token: !!cleaned.auth_token,
    feed_token: !!cleaned.feed_token,
    refresh_token: !!cleaned.refresh_token,
  });

  return cleaned;
}

/**
 * Step 2 + 3 → Handle Angel callback
 * - Parses tokens
 * - Exchanges refresh → JWT
 * - Maps callback → correct user via session
 * - Saves tokens to DB
 */
async function handleCallback(req, res) {
  console.log("⚡ [Angel Callback] Received callback from Angel...");

  try {
    const { auth_token, feed_token, refresh_token } = parseMessyQuery(req.originalUrl);

    if (!auth_token || !feed_token) {
      console.log("❌ [Angel Callback] Missing tokens in redirect URL");
      return res.redirect("/app.html?angel=failed&reason=missing_tokens");
    }

    // Identify the user
    const userId =
      req.session?.pendingBrokerConnect?.userId || req.user?._id;
    if (!userId) {
      console.log("❌ [Angel Callback] Could not identify user (no uid/session/user)");
      console.log("🔍 [Angel Callback] Session contents:", req.session);
      return res.redirect("/app.html?angel=failed&reason=no_userid");
    }

    console.log("👤 [Angel Callback] Identified user:", userId);

    // Try exchanging refresh token
    let jwtToken = auth_token;
    let newRefreshToken = refresh_token || "";
    let newFeedToken = feed_token || "";

    if (refresh_token) {
      console.log("🔄 [Angel Callback] Exchanging refresh_token → jwtToken...");
      try {
        const resp = await axios.post(
          "https://apiconnect.angelone.in/rest/auth/angelbroking/jwt/v1/generateTokens",
          { refreshToken: refresh_token },
          {
            headers: {
              Authorization: `Bearer ${auth_token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-UserType": "USER",
              "X-SourceID": "WEB",
              "X-ClientLocalIP": process.env.CLIENT_LOCAL_IP || "127.0.0.1",
              "X-ClientPublicIP": process.env.CLIENT_PUBLIC_IP || "0.0.0.0",
              "X-MACAddress": process.env.CLIENT_MAC || "00:00:00:00:00:00",
              "X-PrivateKey": process.env.ANGEL_API_KEY,
            },
            timeout: 15000,
          }
        );

        console.log("✅ [Angel Callback] Token exchange response:", resp.data);

        const data = resp.data?.data;
        if (data) {
          jwtToken = data.jwtToken || auth_token;
          newRefreshToken = data.refreshToken || refresh_token;
          newFeedToken = data.feedToken || feed_token;
        }
      } catch (err) {
        console.error("💥 [Angel Callback] Token exchange failed:", err.message);
        if (err.response?.data) console.error("↪ Response:", err.response.data);
      }
    } else {
      console.log("ℹ️ [Angel Callback] No refresh_token found, skipping exchange.");
    }

    // Update MongoDB
    console.log("💾 [Angel Callback] Updating user in DB:", userId);
    await User.findByIdAndUpdate(userId, {
      "broker.brokerName": "ANGEL",
      "broker.connected": true,
      "broker.creds.authToken": auth_token,
      "broker.creds.accessToken": jwtToken || auth_token,
      "broker.creds.feedToken": newFeedToken || feed_token,
      "broker.creds.refreshToken": newRefreshToken || "",
      "broker.creds.exchangedAt": new Date(),
      "broker.creds.note": "Linked via Angel Publisher",
    });

    if (req.session?.pendingBrokerConnect) {
      delete req.session.pendingBrokerConnect;
      console.log("🧹 [Angel Callback] Cleared session.pendingBrokerConnect");
    }

    console.log("✅ [Angel Callback] User updated successfully → redirecting to app");
    return res.redirect("/app.html?angel=connected");
  } catch (err) {
    console.error("💥 [Angel Callback Error]", err.response?.data || err);
    return res.redirect("/app.html?angel=failed&reason=server_error");
  }
}

module.exports = {
  startLogin,
  handleCallback,
  buildLoginUrlForUserId,
};
