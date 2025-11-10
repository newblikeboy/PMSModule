"use strict";

const axios = require("axios");
const User = require("../models/User");

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
    return { ok: true, availableMargin };
  } catch (err) {
    console.error("[angel.trade] getFunds error", err?.response?.data || err.message);
    return { ok: false, availableMargin: 0 };
  }
}

async function placeMarketOrder({ userId, symbol, symboltoken, qty, side }) {
  try {
    const { creds } = await getUserCreds(userId);
    const headers = buildHeaders(creds.apiKey, creds.accessToken);

    const body = {
      exchange: "NSE",
      tradingsymbol: symbol,
      symboltoken: symboltoken,
      transactiontype: side === "SELL" ? "SELL" : "BUY",
      variety: "NORMAL",
      ordertype: "MARKET",
      producttype: "INTRADAY",
      duration: "DAY",
      quantity: Number(qty) || 1,
    };

    const { data } = await axios.post(ORDER_URL, body, { headers, timeout: 15000 });
    return { ok: true, raw: data };
  } catch (err) {
    const resp = err?.response?.data;
    console.error("[angel.trade] placeOrder error", resp || err.message);
    const message =
      resp?.message ||
      resp?.info ||
      err?.message ||
      "Angel order placement failed";
    return { ok: false, error: message };
  }
}

module.exports = {
  getFunds,
  placeMarketOrder,
};

