"use strict";

const User = require("../models/User");

/**
 * Build simple Angel Publisher Login URL
 * Example output:
 *   https://smartapi.angelbroking.com/publisher-login/?api_key=sn8cos7Z
 */
function buildLoginUrlForUserId(userId) {
  if (!userId) throw new Error("userId is required");

  const PUBLISHER_BASE =
    process.env.ANGEL_PUBLISHER_LOGIN ||
    "https://smartapi.angelbroking.com/publisher-login/";

  const PUBLISHER_API_KEY =
    process.env.ANGEL_API_KEY || process.env.ANGEL_PUBLISHER_KEY;

  if (!PUBLISHER_API_KEY) {
    throw new Error("Missing publisher API key (set ANGEL_API_KEY)");
  }

  const url = new URL(PUBLISHER_BASE);
  url.searchParams.set("api_key", PUBLISHER_API_KEY);

  // Optional redirect (only if you’ve registered this URL in Angel dashboard)
  if (process.env.ANGEL_REDIRECT_URL) {
    url.searchParams.set("redirect_url", process.env.ANGEL_REDIRECT_URL);
  }

  return url.toString();
}

/**
 * Start Login Redirect (for logged-in users)
 */
async function startLogin(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).send("Not logged in");

    const url = buildLoginUrlForUserId(userId);
    return res.redirect(url);
  } catch (err) {
    console.error("[Angel Login Error]", err);
    return res.status(500).send("Unable to start Angel login");
  }
}

/**
 * Angel Callback Handler
 * This runs when Angel redirects back with auth_token/feed_token.
 */
async function handleCallback(req, res) {
  try {
    const { auth_token, feed_token, refresh_token } = req.query;

    if (!auth_token || !feed_token) {
      return res.redirect("/app.html?angel=failed&reason=missing_tokens");
    }

    const userId = req.user?._id;
    if (!userId) {
      // fallback: no session
      return res.redirect("/app.html?angel=failed&reason=no_session");
    }

    await User.findByIdAndUpdate(userId, {
      "broker.brokerName": "ANGEL",
      "broker.connected": true,
      "broker.creds.authToken": auth_token,
      "broker.creds.accessToken": auth_token,
      "broker.creds.feedToken": feed_token,
      "broker.creds.refreshToken": refresh_token || "",
      "broker.creds.exchangedAt": new Date(),
      "broker.creds.note": "Linked via Angel Publisher",
    });

    return res.redirect("/app.html?angel=connected");
  } catch (err) {
    console.error("[Angel Callback Error]", err);
    return res.redirect("/app.html?angel=failed&reason=server_error");
  }
}

module.exports = {
  startLogin,
  handleCallback,
  buildLoginUrlForUserId,
};
