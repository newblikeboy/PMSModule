"use strict";

/**
 * fyersSdk.js - Simplified SDK for Quotes, History & DataSocket
 */

const { fyersModel, fyersDataSocket } = require("fyers-api-v3");
const { getAccessToken } = require("./fyersAuth");

/* ----------------------------------------------------------
   SYMBOL FORMATTER
----------------------------------------------------------- */
function toFyersSymbol(sym) {
  if (!sym) return sym;
  const s = String(sym).trim();
  if (/^NSE:/i.test(s)) return s;                     // Already correct
  return `NSE:${s.replace(/-EQ$/i, "").replace(/\.\w+$/i, "")}-EQ`;
}

/* ----------------------------------------------------------
   FYERS CLIENT BUILDER
----------------------------------------------------------- */
async function buildFyersClient() {
  const token = await getAccessToken();
  const client = new fyersModel();
  if (process.env.FYERS_APP_ID) client.setAppId(process.env.FYERS_APP_ID);
  if (process.env.FYERS_REDIRECT_URI) client.setRedirectUrl(process.env.FYERS_REDIRECT_URI);
  client.setAccessToken(token);
  return client;
}

/* ----------------------------------------------------------
   GET QUOTES
----------------------------------------------------------- */
async function getQuotes(symbols = []) {
  if (!Array.isArray(symbols)) symbols = [symbols];
  const fySymbols = symbols.map(toFyersSymbol);

  const client = await buildFyersClient();
  const response = await client.getQuotes(fySymbols);

  if (response && response.Error) {
    const err = response.Error;
    throw new Error(`Fyers API Error: ${err.message || "Unknown"} (code: ${err.code})`);
  }

  const dataArray = Array.isArray(response)
    ? response
    : (response.d || response.data || []);

  if (!Array.isArray(dataArray)) {
    throw new Error(`Invalid response from getQuotes: ${JSON.stringify(response)}`);
  }

  return dataArray.map((r) => {
    const data = r.v || {};
    return {
      symbol: r.n || "",
      ltp: data.lp ?? data.ltp ?? data.c ?? data.price ?? null,
      changePercent: data.chp ?? data.chgPct ?? data.pChange ?? 0,
      prevClose: data.prev_close_price ?? data.prevClose ?? null,
      raw: r,
    };
  });
}

/* ----------------------------------------------------------
   OFFICIAL FYERS HISTORY API
----------------------------------------------------------- */
async function getHistory({
  symbol,
  resolution = "D",
  date_format = "0",
  range_from,
  range_to,
  cont_flag = "1",
}) {
  if (!symbol) throw new Error("getHistory requires symbol");

  const fySymbol = toFyersSymbol(symbol);
  const client = await buildFyersClient();

  const payload = {
    symbol: fySymbol,
    resolution: String(resolution),
    date_format: String(date_format), // "0" → unix timestamps | "1" → YYYY-MM-DD
    range_from: String(range_from),
    range_to: String(range_to),
    cont_flag: String(cont_flag),
  };

  let resp;
  try {
    resp = await client.getHistory(payload);
  } catch (err) {
    throw new Error(`[getHistory] API error: ${err?.message || err}`);
  }

  if (!resp || resp.s !== "ok") {
    const msg = resp?.message || JSON.stringify(resp);
    throw new Error(`[getHistory] Failed: ${msg}`);
  }

  const raw = resp.candles || [];

  // Normalize candles → { ts, o, h, l, c, v }
  return raw.map((c) => ({
    ts: Number(c[0]) * 1000,   // Convert seconds → ms
    o: Number(c[1]),
    h: Number(c[2]),
    l: Number(c[3]),
    c: Number(c[4]),
    v: Number(c[5] ?? 0),
  }));
}

/* ----------------------------------------------------------
   DATA SOCKET
----------------------------------------------------------- */
function createDataSocket(socketToken, opts = {}) {
  return new fyersDataSocket(socketToken, opts.basePath || "./");
}

function connectDataSocket(
  socketToken,
  symbols = [],
  onMessage,
  onConnect,
  onError,
  onClose
) {
  const socket = new fyersDataSocket(socketToken);

  if (onMessage) socket.on("message", onMessage);

  if (onConnect) {
    socket.on("connect", () => {
      console.log("[DataSocket] Connected");

      if (symbols?.length) socket.subscribe(symbols);

      if (socket.LiteMode) socket.mode(socket.LiteMode);

      if (typeof socket.autoreconnect === "function") socket.autoreconnect();

      onConnect();
    });
  }

  if (onError) socket.on("error", onError);
  if (onClose) socket.on("close", onClose);

  socket.connect();
  return socket;
}

/* ----------------------------------------------------------
   EXPORTS
----------------------------------------------------------- */
module.exports = {
  toFyersSymbol,
  buildFyersClient,
  getQuotes,
  getHistory,       // ✔ Official Fyers History
  createDataSocket,
  connectDataSocket,
};
