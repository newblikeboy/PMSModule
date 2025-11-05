"use strict";

/**
 * fyersSdk.js
 * - Uses fyers-api-v3 for history and socket
 * - Uses token helpers from fyersAuth
 * - Wraps historical, quotes, funds, and order API access
 */

const { fyersModel, fyersDataSocket } = require("fyers-api-v3");
const axios = require("axios");
const { DateTime } = require("luxon");
const { getAccessToken, getSocketToken } = require("./fyersAuth");

const FYERS_API_BASE = process.env.FYERS_API_BASE || "https://api.fyers.in/api/v3";
const FYERS_DATA_BASE = process.env.FYERS_DATA_BASE || "https://api.fyers.in/data";

// ---------------- Symbol Helpers ----------------
function toFyersSymbol(sym) {
  if (!sym) return sym;
  const s = String(sym).trim();
  if (/^NSE:/i.test(s)) return s;
  return `NSE:${s.replace(/-EQ$/i, "").replace(/\.\w+$/i, "")}-EQ`;
}

// ---------------- Fyers Client Builder ----------------
async function buildFyersClient() {
  const token = await getAccessToken();
  const client = new fyersModel();
  if (process.env.FYERS_APP_ID) client.setAppId(process.env.FYERS_APP_ID);
  if (process.env.FYERS_REDIRECT_URI) client.setRedirectUrl(process.env.FYERS_REDIRECT_URI);
  client.setAccessToken(token);
  return client;
}

// ---------------- History (with retry) ----------------
const MAX_HISTORY_RETRIES = 3;
const HISTORY_RETRY_WAIT_MS = 700;

function buildHistoryParams(symbol, resolution = "D", range_from, range_to) {
  const fySym = toFyersSymbol(symbol);
  const fromDt = DateTime.fromISO(String(range_from), { zone: "Asia/Kolkata" });
  const toDt = DateTime.fromISO(String(range_to), { zone: "Asia/Kolkata" });

  let fEpoch = fromDt.isValid ? fromDt.startOf("day").toSeconds() : Number(range_from);
  let tEpoch = toDt.isValid ? toDt.endOf("day").toSeconds() : Number(range_to);

  if (!fEpoch || !tEpoch) {
    throw new Error(`Invalid range inputs: ${range_from}, ${range_to}`);
  }

  return {
    symbol: fySym,
    resolution,
    date_format: "0",
    range_from: String(Math.floor(fEpoch)),
    range_to: String(Math.floor(tEpoch)),
    cont_flag: "1"
  };
}

async function getHistorical(symbol, resolution = "D", range_from, range_to) {
  const params = buildHistoryParams(symbol, resolution, range_from, range_to);
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_HISTORY_RETRIES; attempt++) {
    try {
      const client = await buildFyersClient();
      const resp = await client.getHistory(params);

      if (resp?.candles?.length) return resp;

      const msg = `[getHistorical] Attempt ${attempt} returned no candles`;
      console.warn(msg, JSON.stringify(resp));

      if (resp?.code === -16 || /authenticate/i.test(resp?.message || "")) {
        throw new Error(`Authentication error: ${JSON.stringify(resp)}`);
      }

    } catch (err) {
      lastErr = err;
      if (attempt < MAX_HISTORY_RETRIES) {
        await new Promise(res => setTimeout(res, HISTORY_RETRY_WAIT_MS * attempt));
      } else {
        throw lastErr;
      }
    }
  }
  throw new Error("getHistorical failed after retries");
}

const getHistory = ({ symbol, resolution, range_from, range_to }) =>
  getHistorical(symbol, resolution, range_from, range_to);

// ---------------- Quote, Funds, Profile ----------------
async function apiGet(path, params = {}) {
  const token = await getAccessToken();
  const res = await axios.get(`${FYERS_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 15000
  });
  return res.data;
}

async function dataGet(path, params = {}) {
  const token = await getAccessToken();
  const res = await axios.get(`${FYERS_DATA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 15000
  });
  return res.data;
}

async function getProfile() {
  return apiGet("/profile");
}

async function getFunds() {
  return apiGet("/funds");
}

async function getQuotes(symbols = []) {
  if (!Array.isArray(symbols)) symbols = [symbols];
  const fySymbols = symbols.map(toFyersSymbol);
  const res = await dataGet("/quotes", { symbols: fySymbols.join(",") });
  const raw = res?.d || res?.data || res || [];
  return (Array.isArray(raw) ? raw : []).map(r => ({
    symbol: (r.symbol || "").replace(/^NSE:/i, "").replace(/-EQ$/i, ""),
    ltp: r.ltp ?? r.c ?? r.price ?? null,
    changePercent: r.chgPct ?? r.pChange ?? 0,
    raw: r
  }));
}

// ---------------- Order Placement ----------------
async function apiPost(path, body = {}) {
  const token = await getAccessToken();
  const res = await axios.post(`${FYERS_API_BASE}${path}`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    timeout: 15000
  });
  return res.data;
}

async function placeOrder(order, { paperMode = true } = {}) {
  if (paperMode) {
    return { ok: true, mode: "paper", orderId: "PAPER-" + Date.now(), order };
  }

  const payload = {
    symbol: toFyersSymbol(order.symbol),
    qty: order.qty,
    type: order.type === "MARKET" ? 2 : 1,
    side: order.side === "BUY" ? 1 : -1,
    productType: order.productType || "INTRADAY",
    limitPrice: order.limitPrice || 0
  };

  const res = await apiPost("/orders", payload);
  return { ok: true, raw: res };
}

// ---------------- Socket Wrapper ----------------
function createDataSocket(socketToken, opts = {}) {
  return new fyersDataSocket(socketToken, opts.basePath || "./");
}

// ---------------- Exports ----------------
module.exports = {
  toFyersSymbol,
  getProfile,
  getFunds,
  getQuotes,
  getHistorical,
  getHistory,
  placeOrder,
  createDataSocket
};
