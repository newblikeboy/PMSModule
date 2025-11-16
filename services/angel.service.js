"use strict";

const axios = require("axios");
const User = require("../models/User");
const { resolveToken } = require("./instruments.service");
const { decrypt } = require("../utils/auth");

const BASE_URL = process.env.ANGEL_BASE_URL || "https://apiconnect.angelone.in";
const ORDER_URL =
  process.env.ANGEL_ORDER_URL ||
  "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/placeOrder";
const ANGEL_API_KEY = process.env.ANGEL_API_KEY || "5qrQPj3t"; // Shared API key for the app

function buildHeaders(accessToken) {
  if (!accessToken) throw new Error("Missing Angel access token");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": ANGEL_API_KEY,
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "AA-BB-CC-11-22-33",
  };
}

async function getUserCreds(userId) {
  const user = await User.findById(userId);
  const creds = user?.broker?.creds || {};
  if (!creds.accessToken) throw new Error("Angel access token missing");

  // Decrypt tokens
  const decryptedCreds = {
    ...creds,
    accessToken: decrypt(creds.accessToken),
    authToken: decrypt(creds.authToken || ""),
    feedToken: decrypt(creds.feedToken || ""),
    refreshToken: decrypt(creds.refreshToken || ""),
    apiKey: decrypt(creds.apiKey || ""),
    clientId: creds.clientId // Keep plain text
  };

  // Log decryption status
  console.log(`[getUserCreds] Decrypted tokens for user ${userId}: accessToken=${!!decryptedCreds.accessToken}, authToken=${!!decryptedCreds.authToken}, feedToken=${!!decryptedCreds.feedToken}, refreshToken=${!!decryptedCreds.refreshToken}, apiKey=${!!decryptedCreds.apiKey}`);

  // Check if accessToken is empty after decryption
  if (!decryptedCreds.accessToken) {
    console.log(`[getUserCreds] Access token decryption failed for user ${userId}`);
    throw new Error("Angel access token decryption failed");
  }

  // Check if tokens are expired
  if (isAngelTokenExpired(decryptedCreds)) {
    console.log(`[getUserCreds] Tokens expired for user ${userId}`);
    throw new Error("Angel access token expired");
  }

  return { user, creds: decryptedCreds };
}

/**
 * Check if Angel tokens are expired (expire at 12 AM every day).
 * @param {Object} creds - Broker creds
 * @returns {boolean} true if expired
 */
function isAngelTokenExpired(creds) {
  if (!creds.exchangedAt) {
    console.log(`[isAngelTokenExpired] No exchangedAt timestamp found`);
    return true; // No timestamp, assume expired
  }

  const now = new Date();
  const exchanged = new Date(creds.exchangedAt);

  // Create date for today at 12 AM
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  // If exchanged before today's midnight, token is expired
  const expired = exchanged < todayMidnight;

  console.log(`[isAngelTokenExpired] Now: ${now}, Exchanged: ${exchanged}, Today midnight: ${todayMidnight}, Expired: ${expired}`);
  return expired;
}

/**
 * Get available margin for the user.
 * @param {string} userId
 * @returns {Promise<{availableMargin: number}>}
 */
async function getFunds(userId) {
  try {
    const { creds } = await getUserCreds(userId);
    const headers = buildHeaders(creds.accessToken);
    const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`;
    console.log("[angel.service] Calling getFunds API for user", userId, "with shared apiKey:", ANGEL_API_KEY);
    const { data } = await axios.get(url, { headers, timeout: 10000 });
    
    const payload = data?.data || data || {};
    const availableMargin =
      Number(payload.availablecash) ||
      Number(payload.availablecashcomponent) ||
      Number(payload.cash) ||
      0;
    console.log("[angel.service] Parsed availableMargin:", availableMargin);
    return { availableMargin };
  } catch (err) {
    console.error("[angel.service] getFunds error", err?.response?.data || err.message);
    return { availableMargin: 0 };
  }
}

/**
 * Place a market order.
 * @param {Object} params
 * @param {string} params.symbol - Trading symbol (e.g., "SBIN-EQ")
 * @param {number} params.qty - Quantity
 * @param {string} params.side - "BUY" or "SELL"
 * @param {string} params.userId
 * @returns {Promise<{ok: boolean, orderId?: string, avgPrice?: number}>}
 */
async function placeMarketOrder({ symbol, qty, side, userId }) {
  try {
    const { creds } = await getUserCreds(userId);
    const headers = buildHeaders(creds.accessToken);

    // Resolve symboltoken
    const symboltoken = await resolveToken(symbol);
    if (!symboltoken) {
      console.error("[angel.service] symboltoken not found for", symbol, "- using placeholder for testing");
      // For testing, use a placeholder symboltoken
      // In production, this should be populated with real data
    }

    const body = {
      exchange: "NSE",
      tradingsymbol: symbol,
      symboltoken: symboltoken || "3045", // Placeholder for SBIN-EQ or similar
      transactiontype: side === "SELL" ? "SELL" : "BUY",
      variety: "NORMAL",
      ordertype: "MARKET",
      producttype: "INTRADAY",
      duration: "DAY",
      quantity: Number(qty) || 1,
    };

    const { data } = await axios.post(ORDER_URL, body, { headers, timeout: 15000 });
    // Assuming data has orderid and possibly price
    const orderId = data?.orderid || data?.orderId;
    const avgPrice = data?.price ? Number(data.price) : undefined;
    return { ok: true, orderId, avgPrice };
  } catch (err) {
    const resp = err?.response?.data;
    console.error("[angel.service] placeOrder error", resp || err.message);
    return { ok: false };
  }
}

/**
 * Close position by placing a SELL market order.
 * @param {Object} params
 * @param {string} params.symbol - Trading symbol
 * @param {number} params.qty - Quantity
 * @param {string} [params.side="SELL"] - Side (default SELL)
 * @param {string} params.userId
 * @returns {Promise<{ok: boolean, orderId?: string, avgPrice?: number}>}
 */
async function closePositionMarket({ symbol, qty, side = "SELL", userId }) {
  return placeMarketOrder({ symbol, qty, side, userId });
}

module.exports = { getFunds, placeMarketOrder, closePositionMarket, isAngelTokenExpired };
