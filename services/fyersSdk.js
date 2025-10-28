// services/fyersSdk.js
"use strict";

/**
 * fyersSdk.js
 * - Uses official fyers-api-v3 library for history and socket (preferred)
 * - Uses getAccessToken() / getSocketToken() from services/fyersAuth
 * - Exposes getHistory/getHistorical used by M1 engine
 */

const { fyersModel, fyersDataSocket } = require("fyers-api-v3");
const { getAccessToken, getSocketToken } = require("./fyersAuth");
const axios = require("axios");
const { DateTime } = require("luxon");

const FYERS_API_BASE = process.env.FYERS_API_BASE || "https://api.fyers.in/api/v3";
const FYERS_DATA_BASE = process.env.FYERS_DATA_BASE || "https://api.fyers.in/data";

// ---------------- helpers ----------------
function toFyersSymbol(sym) {
  if (!sym) return sym;
  const s = String(sym).trim();
  if (/^NSE:/i.test(s)) return s;
  const cleaned = s.replace(/-EQ$/i, "").replace(/\.\w+$/i, "");
  return `NSE:${cleaned}-EQ`;
}

// create a new fyersModel client and set the current access token.
// We create a new instance per call to avoid stale token inside the library.
async function buildFyersClient() {
  const token = await getAccessToken();
  const client = new fyersModel();
  // appId + redirect not strictly required for getHistory but harmless to set
  if (process.env.FYERS_APP_ID) client.setAppId(process.env.FYERS_APP_ID);
  if (process.env.FYERS_REDIRECT_URI) client.setRedirectUrl(process.env.FYERS_REDIRECT_URI);
  client.setAccessToken(token);
  return client;
}

// ---------------- history via fyersModel (official lib) ----------------
// We wrap getHistory with retries (small) to handle transient network/5xx.
const MAX_HISTORY_RETRIES = 3;
const HISTORY_RETRY_WAIT_MS = 700;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Normalizes input dates to epoch seconds (IST start/end) and returns
 * a params object matching the Fyers library sample.
 */
function historyParamsForRange(symbol, resolution, range_from, range_to) {
  const fySym = toFyersSymbol(symbol);

  // prefer ISO -> IST start/end-of-day conversion
  const fromDt = DateTime.fromISO(String(range_from), { zone: "Asia/Kolkata" });
  const toDt = DateTime.fromISO(String(range_to), { zone: "Asia/Kolkata" });

  let fEpoch, tEpoch;
  if (fromDt.isValid && toDt.isValid) {
    fEpoch = Math.floor(fromDt.startOf("day").toSeconds());
    tEpoch = Math.floor(toDt.endOf("day").toSeconds());
  } else {
    const fNum = Number(range_from);
    const tNum = Number(range_to);
    if (!isNaN(fNum) && !isNaN(tNum)) {
      fEpoch = Math.floor(fNum);
      tEpoch = Math.floor(tNum);
    } else {
      // last attempt: parse individually with DateTime
      const fTry = DateTime.fromISO(String(range_from), { zone: "Asia/Kolkata" });
      const tTry = DateTime.fromISO(String(range_to), { zone: "Asia/Kolkata" });
      if (fTry.isValid && tTry.isValid) {
        fEpoch = Math.floor(fTry.startOf("day").toSeconds());
        tEpoch = Math.floor(tTry.endOf("day").toSeconds());
      } else {
        throw new Error(`Cannot interpret range_from/range_to (${range_from}, ${range_to})`);
      }
    }
  }

  return {
    symbol: fySym,
    resolution: resolution || "D",
    date_format: "0", // epoch seconds
    range_from: String(fEpoch),
    range_to: String(tEpoch),
    cont_flag: "1"
  };
}

/**
 * Uses the official fyersModel.getHistory to fetch candle data.
 * Retries a few times on transient errors.
 */
async function getHistorical(symbol, resolution = "D", range_from, range_to) {
  const params = historyParamsForRange(symbol, resolution, range_from, range_to);
  console.log("[fyersSdk] getHistorical params:", params);

  let attempt = 0;
  let lastErr = null;

  while (attempt < MAX_HISTORY_RETRIES) {
    attempt++;
    try {
      const client = await buildFyersClient();
      // fyersModel.getHistory expects an input object (same shape as your sample)
      const resp = await client.getHistory(params);
      // resp typically has .candles
      if (resp && Array.isArray(resp.candles) && resp.candles.length) {
        return resp;
      }
      // handle server-side auth/err messages in resp
      if (resp && resp.code && resp.code < 0) {
        // propagate authentication errors immediately
        if (String(resp.message || "").toLowerCase().includes("authenticate") || resp.code === -16) {
          const e = new Error(`getHistorical auth error: ${JSON.stringify(resp)}`);
          e.response = resp;
          throw e;
        }
        // else treat empty as retryable once or twice
        console.warn(`[fyersSdk] getHistorical attempt ${attempt} -> empty/no-candles, resp:`, JSON.stringify(resp));
      } else {
        console.warn(`[fyersSdk] getHistorical attempt ${attempt} -> no candles (resp shape unexpected)`, JSON.stringify(resp));
      }
      // if not returned, sleep and retry
      if (attempt < MAX_HISTORY_RETRIES) {
        await sleep(HISTORY_RETRY_WAIT_MS * attempt);
        continue;
      } else {
        const e = new Error("no historical candles");
        e.response = resp;
        throw e;
      }
    } catch (err) {
      lastErr = err;
      // if auth error, bubble up
      const body = err.response || err.body || null;
      if (String(err.message || "").toLowerCase().includes("authenticate") || (body && String(body.message || "").toLowerCase().includes("authenticate"))) {
        throw err;
      }
      // retry on network / server errors
      console.warn(`[fyersSdk] getHistorical attempt ${attempt} failed: ${err.message}. retrying if attempts left`);
      if (attempt < MAX_HISTORY_RETRIES) {
        await sleep(HISTORY_RETRY_WAIT_MS * attempt);
        continue;
      }
      // otherwise rethrow last error
      throw lastErr;
    }
  }

  throw new Error("getHistorical failed unexpectedly");
}

// Backwards-compatible alias
async function getHistory({ symbol, resolution, range_from, range_to }) {
  return getHistorical(symbol, resolution, range_from, range_to);
}

// ---------------- quotes / profile / funds / orders ----------------
// The official library does not always include high-level wrappers
// for every data endpoint in the same way; we can use axios for those
// while still ensuring token is set from services/fyersAuth.

async function apiGet(path, params = {}) {
  const token = await getAccessToken();
  const resp = await axios.get(`${FYERS_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 15000
  });
  return resp.data;
}

async function dataGet(path, params = {}) {
  const token = await getAccessToken();
  const resp = await axios.get(`${FYERS_DATA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 15000
  });
  return resp.data;
}

async function getProfile() {
  return apiGet("/profile");
}
async function getFunds() {
  return apiGet("/funds");
}

async function getQuotes(symbolList = []) {
  if (!Array.isArray(symbolList)) symbolList = [symbolList];
  const fySymbols = symbolList.map(toFyersSymbol);
  const params = { symbols: fySymbols.join(",") };
  const data = await dataGet("/quotes", params);
  const raw = data?.d || data?.data || data || [];
  return (Array.isArray(raw) ? raw : []).map(r => {
    const symbolPlain = (r.symbol || "").replace(/^NSE:/i, "").replace(/-EQ$/i, "");
    return { symbol: symbolPlain, ltp: r.ltp ?? r.c ?? r.price ?? null, changePercent: r.chgPct ?? r.pChange ?? 0, raw: r };
  });
}

// Place order (paper default)
async function placeOrder(order, { paperMode = true } = {}) {
  if (paperMode) {
    return { ok: true, mode: "paper", orderId: "PAPER-" + Date.now(), order };
  }
  // map to API payload
  const payload = {
    symbol: toFyersSymbol(order.symbol),
    qty: order.qty,
    type: order.type === "MARKET" ? 2 : 1,
    side: order.side === "BUY" ? 1 : -1,
    productType: order.productType || "INTRADAY",
    limitPrice: order.limitPrice || 0
  };
  const resp = await apiPost("/orders", payload);
  return { ok: true, raw: resp };
}

async function apiPost(path, body = {}) {
  const token = await getAccessToken();
  const resp = await axios.post(`${FYERS_API_BASE}${path}`, body, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: 15000
  });
  return resp.data;
}

// ---------------- socket helper (uses official library) ----------------
function createDataSocket(socketToken, opts = {}) {
  // socketToken must be "APPID:ACCESSTOKEN" format returned by getSocketToken()
  return new fyersDataSocket(socketToken, opts.basePath || "./");
}

// ---------------- exports ----------------
module.exports = {
  getProfile,
  getFunds,
  getQuotes,
  getHistorical,
  getHistory,
  placeOrder,
  toFyersSymbol,
  // socket helper — engine still uses getSocketToken() and fyersDataSocket directly
  createDataSocket
};
