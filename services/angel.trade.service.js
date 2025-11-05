// services/angel.trade.service.js
"use strict";

/**
 * Angel One Publisher trading (multi-user).
 * Reads the user's saved Publisher JWT from user.broker.creds.accessToken.
 *
 * Exposes:
 *   - getFunds(userId) -> { availableMargin }
 *   - placeMarketOrder({ userId, symbol, symboltoken, qty, side }) -> { ok, orderId, raw }
 */

const axios = require("axios");
const User = require("../models/User");

const CFG = {
  BASE: process.env.ANGEL_BASE || "https://apiconnect.angelbroking.com",
  EXCHANGE: process.env.ANGEL_DEFAULT_EXCHANGE || "NSE",
  PRODUCT: process.env.ANGEL_DEFAULT_PRODUCT || "INTRADAY",
  VARIETY: process.env.ANGEL_DEFAULT_VARIETY || "NORMAL",
};

function headersFor(user) {
  const apiKey = user?.broker?.creds?.apiKey;
  const at = user?.broker?.creds?.accessToken;
  if (!apiKey || !at) throw new Error("Angel auth missing for user (apiKey/accessToken)");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": apiKey,
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "AA-BB-CC-11-22-33",
    Authorization: `Bearer ${at}`,
  };
}

function toTs(symbol) {
  // accepts "NSE:SBIN-EQ" or "SBIN-EQ"
  let s = String(symbol || "").trim().toUpperCase();
  s = s.replace(/^NSE:/, "");
  return s; // e.g., "SBIN-EQ"
}

// ------- Funds -------
async function getFunds(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("user not found");
  const url = `${CFG.BASE}/rest/secure/angelbroking/user/v1/getRMS`;
  const resp = await axios.get(url, { headers: headersFor(user), timeout: 9000 });
  const data = resp?.data?.data || resp?.data || {};
  const available =
    Number(data.availablecash) ||
    Number(data.net) ||
    Number(data.available_margin) ||
    Number(data.cash) ||
    0;
  return { availableMargin: available };
}

// ------- Place MARKET Order -------
async function placeMarketOrder({ userId, symbol, symboltoken, qty, side }) {
  const user = await User.findById(userId);
  if (!user) throw new Error("user not found");
  const ts = toTs(symbol);
  if (!symboltoken) throw new Error("symboltoken required for Angel order");
  if (!qty || qty < 1) throw new Error("qty must be >= 1");
  const txn = String(side || "BUY").toUpperCase(); // BUY/SELL

  const body = {
    variety: CFG.VARIETY,           // "NORMAL"
    tradingsymbol: ts,              // "SBIN-EQ"
    symboltoken,                    // e.g., "3045"
    transactiontype: txn,           // "BUY" | "SELL"
    exchange: CFG.EXCHANGE,         // "NSE"
    ordertype: "MARKET",
    producttype: CFG.PRODUCT,       // "INTRADAY"
    duration: "DAY",
    price: "0",
    squareoff: "0",
    stoploss: "0",
    quantity: String(qty),
  };

  const url = `${CFG.BASE}/rest/secure/angelbroking/order/v1/placeOrder`;
  const resp = await axios.post(url, body, { headers: headersFor(user), timeout: 12000 });

  const orderId =
    resp?.data?.data?.orderid ||
    resp?.data?.data?.uniqueorderid ||
    resp?.data?.orderid ||
    resp?.data?.uniqueorderid ||
    null;

  return { ok: !!orderId, orderId, raw: resp?.data };
}

module.exports = {
  getFunds,
  placeMarketOrder,
};
