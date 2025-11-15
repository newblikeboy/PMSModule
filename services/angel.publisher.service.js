// services/angel.publisher.service.js
"use strict";

const axios = require("axios");
const User = require("../models/User");
const url = require("url");
const qs = require("querystring");

/**
 * Utility → Build Angel Publisher login URL
 * Adds ?uid=<userId> to redirect_url so callback knows which user.
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

  const redirectBase =
    process.env.ANGEL_REDIRECT_URL ||
    `${process.env.APP_HOST}/auth/angel/callback`;

  const redirectUrl = `${redirectBase}?uid=${encodeURIComponent(userId)}`;
  const finalUrl = new URL(PUBLISHER_BASE);
  finalUrl.searchParams.set("api_key", API_KEY);
  finalUrl.searchParams.set("redirect_url", redirectUrl);

  console.log("🔗 [Angel] Building Publisher login URL:");
  console.log("    API Key     :", API_KEY);
  console.log("    Redirect URL:", redirectUrl);
  console.log("    Final URL   :", finalUrl.toString());

  return finalUrl.toString();
}

/**
 * Step 1 → Start Angel Login Flow
 * Redirect logged-in user to Angel’s publisher login
 */
async function startLogin(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      console.log("❌ [Angel Login] No user session found");
      return res.status(401).send("Not logged in");
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
 * Utility → Parse messy query string from Angel callback
 * Handles duplicated params like auth_token=...auth_token=...
 */
function parseMessyQuery(originalUrl) {
  const parsed = url.parse(originalUrl);
  const rawQuery = parsed.query || "";
  const params = qs.parse(rawQuery);

  function pick(val) {
    if (Array.isArray(val)) return val.find(Boolean) || val[0];
    return val;
  }

  const cleaned = {
    auth_token: pick(params.auth_token),
    feed_token: pick(params.feed_token),
    refresh_token: pick(params.refresh_token),
    uid: pick(params.uid),
  };

  console.log("🧩 [Angel Callback] Parsed tokens from URL:", {
    auth_token: !!cleaned.auth_token,
    feed_token: !!cleaned.feed_token,
    refresh_token: !!cleaned.refresh_token,
    uid: cleaned.uid,
  });

  return cleaned;
}

/**
 * Step 2 & 3 → Handle Angel redirect callback
 * - Parse tokens safely
 * - Exchange refresh token for JWT
 * - Identify correct user (via ?uid or session fallback)
 * - Save to DB
 */
async function handleCallback(req, res) {
  console.log("⚡ [Angel Callback] Received callback from Angel...");

  try {
    // --- 1️⃣ Parse query string ---
    const { auth_token, feed_token, refresh_token, uid } = parseMessyQuery(
      req.originalUrl
    );

    if (!auth_token || !feed_token) {
      console.log("❌ [Angel Callback] Missing tokens in redirect URL");
      return res.redirect("/app.html?angel=failed&reason=missing_tokens");
    }

    // --- 2️⃣ Identify user ---
    let userId = uid || req.session?.pendingBrokerConnect?.userId || req.user?._id;
    if (!userId) {
      console.log("❌ [Angel Callback] Could not identify user");
      return res.redirect("/app.html?angel=failed&reason=no_userid");
    }

    console.log("👤 [Angel Callback] Identified user:", userId);

    // --- 3️⃣ Try exchanging refresh_token for JWT ---
    let jwtToken = null;
    let newRefreshToken = refresh_token || null;
    let newFeedToken = feed_token || null;

    if (refresh_token) {
      console.log("🔄 [Angel Callback] Exchanging refresh_token for new JWT...");
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
        } else {
          console.warn("⚠️ [Angel Callback] No data in generateTokens response");
          jwtToken = auth_token;
        }
      } catch (ex) {
        console.error("💥 [Angel Callback] Token exchange failed:", ex.message);
        if (ex.response?.data) console.error("↪ Response:", ex.response.data);
        jwtToken = auth_token; // fallback
      }
    } else {
      console.log("ℹ️ [Angel Callback] No refresh_token found, skipping exchange.");
      jwtToken = auth_token;
    }

    // --- 4️⃣ Update MongoDB ---
    console.log("💾 [Angel Callback] Updating DB for user:", userId);
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
    }

    console.log("✅ [Angel Callback] User updated successfully → redirecting...");
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
