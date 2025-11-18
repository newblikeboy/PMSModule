"use strict";

const dotenv = require("dotenv")
const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const url = require("url");
const qs = require("querystring");

dotenv.config()


/**
 * Step 1 → Build Angel Publisher Login URL
 */
function buildLoginUrl() {
  const PUBLISHER_BASE =
    process.env.ANGEL_PUBLISHER_LOGIN ||
    "https://smartapi.angelbroking.com/publisher-login/";

  const API_KEY = process.env.ANGEL_API_KEY

  if (!API_KEY) throw new Error("Missing ANGEL_API_KEY");

  const redirectUrl =
    process.env.ANGEL_REDIRECT_URL ||
    `${process.env.APP_HOST}/auth/angel/callback`;

  const finalUrl = new URL(PUBLISHER_BASE);
  finalUrl.searchParams.set("api_key", API_KEY);
  finalUrl.searchParams.set("redirect_url", redirectUrl);

  console.log("🔗 [Angel] Publisher login URL built:", finalUrl.toString());
  return finalUrl.toString();
}

/**
 * Step 2 → Redirect user to Angel login page
 */
async function startLogin(req, res) {
  try {
    const url = buildLoginUrl();
    console.log("✅ [Angel Login] Redirecting to:", url);
    return res.redirect(url);
  } catch (err) {
    console.error("💥 [Angel Login Error]", err);
    return res.status(500).send("Unable to start Angel login");
  }
}

/**
 * Parse messy callback URL safely
 */
function parseMessyQuery(originalUrl) {
  const parsed = url.parse(originalUrl);
  const raw = parsed.query || "";
  const params = qs.parse(raw);

  const pick = (v) => (Array.isArray(v) ? v.find(Boolean) || v[0] : v);

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
 * Step 3 → Handle Angel callback
 * Flow:
 *   - Parse auth_token, refresh_token, feed_token
 *   - Exchange refresh_token → jwtToken
 *   - Decode jwtToken → extract clientId (username)
 *   - Find user by broker.creds.clientId
 *   - Update tokens in DB
 */
async function handleCallback(req, res) {
  console.log("⚡ [Angel Callback] Received callback from Angel...");

  try {
    const { auth_token, feed_token, refresh_token } = parseMessyQuery(
      req.originalUrl
    );

    if (!auth_token || !refresh_token) {
      console.log("❌ [Angel Callback] Missing tokens in callback URL");
      return res.redirect("/app.html?angel=failed&reason=missing_tokens");
    }

    // --- Exchange refresh → jwtToken ---
    console.log("🔄 [Angel Callback] Exchanging refresh_token → jwtToken...");
    let jwtToken = null;
    let newFeedToken = feed_token || "";
    let newRefreshToken = refresh_token;

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

      const data = resp.data?.data;
      if (data) {
        jwtToken = data.jwtToken;
        newFeedToken = data.feedToken || feed_token;
        newRefreshToken = data.refreshToken || refresh_token;
      }

      console.log("✅ [Angel Callback] Token exchange successful");
    } catch (err) {
      console.error("💥 [Angel Callback] Token exchange failed:", err.message);
      if (err.response?.data) console.error("↪ Response:", err.response.data);
      return res.redirect("/app.html?angel=failed&reason=exchange_failed");
    }

    // --- Decode JWT ---
    let clientId = null;
    try {
      const decoded = jwt.decode(jwtToken);
      clientId = decoded?.username;
      console.log("🧩 [Angel Callback] Decoded JWT:", decoded);
      console.log("👤 [Angel Callback] Extracted clientId:", clientId);
    } catch (e) {
      console.error("💥 [Angel Callback] Failed to decode JWT:", e.message);
      return res.redirect("/app.html?angel=failed&reason=decode_failed");
    }

    if (!clientId) {
      console.log("❌ [Angel Callback] Missing clientId in JWT");
      return res.redirect("/app.html?angel=failed&reason=no_clientid");
    }

    // --- Find user by clientId ---
    const user = await User.findOne({ "broker.creds.clientId": clientId });
    if (!user) {
      console.log("❌ [Angel Callback] No user linked with clientId:", clientId);
      return res.redirect(
        `/app.html?angel=failed&reason=client_not_linked&clientId=${clientId}`
      );
    }

    // --- Update user tokens ---



    await User.findByIdAndUpdate(user._id, {
      $set: {
        "broker.brokerName": "ANGEL",
        "broker.connected": true,
        "broker.creds.apiKey": process.env.API_KEY, // Save the shared API key
        "broker.creds.authToken": auth_token,
        "broker.creds.accessToken": jwtToken,
        "broker.creds.feedToken": newFeedToken,
        "broker.creds.refreshToken": newRefreshToken,
        "broker.creds.clientId": clientId, // Keep clientId plain text
        "broker.creds.exchangedAt": new Date(),
        "broker.creds.note": "Linked via Angel Publisher (JWT verified)",
      }
    });

    console.log(
      `✅ [Angel Callback] Tokens updated successfully for clientId ${clientId} (userId ${user._id})`
    );

    return res.redirect("/app.html?angel=connected");
  } catch (err) {
    console.error("💥 [Angel Callback Fatal Error]", err);
    return res.redirect("/app.html?angel=failed&reason=server_error");
  }
}

module.exports = {
  startLogin,
  handleCallback,
  buildLoginUrl,
};
