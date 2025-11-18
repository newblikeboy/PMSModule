"use strict";

/**
 * fyersSdk.js - Simplified SDK for quotes and data socket
 */

const { fyersModel, fyersDataSocket } = require("fyers-api-v3");
const { getAccessToken, getSocketToken } = require("./fyersAuth");

// ---------------- Symbol Helpers ----------------
function toFyersSymbol(sym) {
  if (!sym) return sym;
  const s = String(sym).trim();
  if (/^NSE:/i.test(s)) return s;
  return `NSE:${s.replace(/-EQ$/i, "").replace(/\.\w+$/i, "")}-EQ`;
}

// ---------------- Prepare Fyers Client ----------------
async function buildFyersClient() {
  const token = await getAccessToken();
  const client = new fyersModel();
  if (process.env.FYERS_APP_ID) client.setAppId(process.env.FYERS_APP_ID);
  if (process.env.FYERS_REDIRECT_URI) client.setRedirectUrl(process.env.FYERS_REDIRECT_URI);
  client.setAccessToken(token);
  return client;
}

// ---------------- Get Quotes ----------------
async function getQuotes(symbols = []) {
  if (!Array.isArray(symbols)) symbols = [symbols];
  const fySymbols = symbols.map(toFyersSymbol);

  const client = await buildFyersClient();
  const response = await client.getQuotes(fySymbols);

  // Check for API errors
  if (response && response.Error) {
    const err = response.Error;
    throw new Error(`Fyers API Error: ${err.message || 'Unknown error'} (code: ${err.code})`);
  }

  // Handle both direct array response and wrapped response {d: [...], s: "ok"}
  const dataArray = Array.isArray(response) ? response : (response.d || response.data || []);

  if (!dataArray || !Array.isArray(dataArray)) {
    throw new Error(`Invalid response from getQuotes: ${JSON.stringify(response)}`);
  }

  return dataArray.map(r => {
    const data = r.v || {};
    return {
      symbol: r.n || "",
      ltp: data.lp ?? data.ltp ?? data.c ?? data.price ?? null,
      changePercent: data.chp ?? data.chgPct ?? data.pChange ?? 0,
      prevClose: data.prev_close_price ?? data.prevClose ?? null,
      raw: r
    };
  });
}

// ---------------- Data Socket ----------------
function createDataSocket(socketToken, opts = {}) {
  return new fyersDataSocket(socketToken, opts.basePath || "./");
}

// Connect and setup data socket with event handlers
function connectDataSocket(socketToken, symbols = [], onMessage, onConnect, onError, onClose) {
  const socket = new fyersDataSocket(socketToken);

  // Set up event listeners
  if (onMessage) socket.on("message", onMessage);
  if (onConnect) {
    socket.on("connect", () => {
      console.log("[DataSocket] Connected");
      // Subscribe to symbols
      if (Array.isArray(symbols) && symbols.length > 0) {
        socket.subscribe(symbols);
      }
      // Set lite mode
      if (socket.LiteMode) {
        socket.mode(socket.LiteMode);
      }
      // Enable autoreconnect
      if (typeof socket.autoreconnect === "function") {
        socket.autoreconnect();
      }
      // Call user onConnect
      onConnect();
    });
  }
  if (onError) socket.on("error", onError);
  if (onClose) socket.on("close", onClose);

  // Connect the socket
  socket.connect();

  return socket;
}

// ---------------- Exports ----------------
module.exports = {
  toFyersSymbol,
  buildFyersClient,
  getQuotes,
  createDataSocket,
  connectDataSocket
};
