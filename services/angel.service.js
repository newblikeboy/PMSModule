"use strict";

const axios = require("axios");
const User = require("../models/User");
const { resolveToken } = require("./instruments.service");

const BASE_URL = process.env.ANGEL_BASE_URL || "https://apiconnect.angelbroking.com";
const ORDER_URL =
  process.env.ANGEL_ORDER_URL ||
  "https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/placeOrder";

function buildHeaders(apiKey, accessToken) {
  if (!apiKey || !accessToken) throw new Error("Missing Angel credentials");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": apiKey,
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "AA-BB-CC-11-22-33",
  };
}

async function getUserCreds(userId) {
  const user = await User.findById(userId).select("broker");
  const creds = user?.broker?.creds || {};
  if (!creds.accessToken) throw new Error("Angel access token missing");
  return { user, creds };
}

/**
 * Get available margin for the user.
 * @param {string} userId
 * @returns {Promise<{availableMargin: number}>}
 */
async function getFunds(userId) {
  try {
    const { creds } = await getUserCreds(userId);
    const headers = buildHeaders(creds.apiKey, creds.accessToken);
    const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/getFunds`;
    const { data } = await axios.post(url, {}, { headers, timeout: 10000 });
    const payload = data?.data || data || {};
    const availableMargin =
      Number(payload.availablecash) ||
      Number(payload.availablecashcomponent) ||
      Number(payload.cash) ||
      0;
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
    const headers = buildHeaders(creds.apiKey, creds.accessToken);

    // Resolve symboltoken
    const symboltoken = await resolveToken(symbol);
    if (!symboltoken) {
      console.error("[angel.service] symboltoken not found for", symbol);
      return { ok: false };
    }

    const body = {
      exchange: "NSE",
      tradingsymbol: symbol,
      symboltoken,
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

module.exports = { getFunds, placeMarketOrder, closePositionMarket };
