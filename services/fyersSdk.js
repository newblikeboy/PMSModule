"use strict";
const axios = require("axios");
const { getAccessToken } = require("./fyersAuth");

const FYERS_BASE = "https://api-t1.fyers.in/api/v3";

function toFyersSymbol(sym) {
  if (sym.startsWith("NSE:")) return sym;
  return `${sym}`;
}

async function fyersGet(path, params = {}) {
  const token = await getAccessToken();
  const resp = await axios.get(`${FYERS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return resp.data;
}

async function fyersPost(path, body = {}) {
  const token = await getAccessToken();
  const resp = await axios.post(`${FYERS_BASE}${path}`, body, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  });
  return resp.data;
}

// --- PROFILE / FUNDS ---
async function getProfile() { return fyersGet("/profile"); }
async function getFunds() { return fyersGet("/funds"); }

// --- QUOTES ---
async function getQuotes(symbolList) {
  const fySymbols = symbolList.map(toFyersSymbol);
  const data = await fyersGet("/quotes", { symbols: fySymbols.join(",") });
  const raw = data.d || data.data || [];
  return raw.map(r => {
    let s = (r.symbol || "").replace("NSE:", "").replace("-EQ", "");
    return { symbol: s, ltp: r.ltp || r.c || r.price, changePercent: r.chgPct || r.pChange || 0 };
  });
}

// --- HISTORICAL DATA ---
async function getHistorical(symbol, resolution, fromDate, toDate) {
  const fySym = toFyersSymbol(symbol);
  const data = await fyersGet("/history", {
    symbol: fySym,
    resolution,
    range_from: fromDate,
    range_to: toDate
  });
  return data;
}

// Backward compatible alias
async function getHistory({ symbol, resolution, range_from, range_to }) {
  return getHistorical(symbol, resolution, range_from, range_to);
}

// --- ORDER (Paper + Live) ---
async function placeOrder(order, { paperMode = true } = {}) {
  if (paperMode)
    return { ok: true, mode: "paper", orderId: "PAPER-" + Date.now(), order };
  const fyPayload = {
    symbol: toFyersSymbol(order.symbol),
    qty: order.qty,
    type: order.type === "MARKET" ? 2 : 1,
    side: order.side === "BUY" ? 1 : -1,
    productType: order.productType || "INTRADAY",
    limitPrice: order.limitPrice || 0
  };
  const resp = await fyersPost("/orders", fyPayload);
  return { ok: true, mode: "live", raw: resp };
}

module.exports = {
  getProfile,
  getFunds,
  getQuotes,
  getHistorical,
  getHistory,
  placeOrder,
  toFyersSymbol
};
