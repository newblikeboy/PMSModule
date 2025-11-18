// services/m2.service.js
"use strict";

const { fyersDataSocket } = require("fyers-api-v3");
const fy = require("./fyersSdk"); 
const { getSocketToken } = require("./fyersAuth");
const { calcRSI14FromCandles } = require("../utils/indicators");
const M2Signal = require("../models/M2Signal");
const M1Mover = require("../models/M1Mover");

const CONFIG = {
  RSI_LOWER: 40,
  RSI_UPPER: 50,
  HISTORY_LOOKBACK_MINUTES: 240,
  MAX_MIN_CANDLES: 200,
  SOCKET_RECONNECT_MS: 5000
};

// ---- IN-MEMORY STATE ----
let socket = null;
let movers = [];
let minuteSeriesMap = new Map();
let lastRSIValue = new Map();

// Utilities
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function minuteBucket(ts) {
  return Math.floor(ts / 60000) * 60000;
}

function updateMinuteSeries(symbol, price, ts) {
  const bucket = minuteBucket(ts);
  let series = minuteSeriesMap.get(symbol);
  if (!series) {
    series = [];
    minuteSeriesMap.set(symbol, series);
  }

  let last = series[series.length - 1];

  if (!last || last[0] !== bucket) {
    last = [bucket, price, price, price, price, 1];
    series.push(last);
    if (series.length > CONFIG.MAX_MIN_CANDLES) {
      series.splice(0, series.length - CONFIG.MAX_MIN_CANDLES);
    }
  } else {
    last[2] = Math.max(last[2], price);
    last[3] = Math.min(last[3], price);
    last[4] = price;
    last[5] += 1;
  }
}

async function fetchHistorySeries(symbol) {
  const now = Date.now();
  const fromDate = new Date(now - CONFIG.HISTORY_LOOKBACK_MINUTES * 60000)
    .toISOString().slice(0, 10);
  const toDate = new Date(now).toISOString().slice(0, 10);

  const resp = await fy.getHistory({
    symbol,
    resolution: "1",
    range_from: fromDate,
    range_to: toDate
  });

  const raw = resp?.candles || [];
  const arr = raw.map(c => [c[0] * 1000, c[1], c[2], c[3], c[4], c[5]]);

  const out = [];
  for (const x of arr) {
    const ts = minuteBucket(x[0]);
    out.push([ts, x[1], x[2], x[3], x[4], x[5]]);
  }
  return out;
}

async function initHistoryForMovers() {
  for (const m of movers) {
    try {
      const hist = await fetchHistorySeries(m.symbol);
      minuteSeriesMap.set(m.symbol, hist);
    } catch (err) {
      console.log("[M2] History fetch failed for", m.symbol, err.message);
    }
    await sleep(150);
  }
}

async function computeRSIAndStore(symbol, price) {
  const candles = minuteSeriesMap.get(symbol);
  if (!candles || candles.length < 20) return;

  const rsi = await calcRSI14FromCandles(candles);
  if (!Number.isFinite(rsi)) return;

  const last = lastRSIValue.get(symbol);
  if (last && Math.abs(last - rsi) < 0.05) return;

  lastRSIValue.set(symbol, rsi);

  const inZone = rsi >= CONFIG.RSI_LOWER && rsi <= CONFIG.RSI_UPPER;

  if (inZone) {
    await M2Signal.findOneAndUpdate(
      { symbol },
      {
        symbol,
        rsi: Number(rsi.toFixed(2)),
        timeframe: "1m",
        inEntryZone: true,
        updatedAt: new Date()
      },
      { upsert: true }
    );

    console.log(`[M2 SIGNAL] ${symbol} → RSI ${rsi.toFixed(2)} (40–50 zone)`);
  }
}

// ---- SOCKET HANDLING ----
async function connectSocket() {
  const token = await getSocketToken();
  socket = new fyersDataSocket(token);

  socket.on("connect", () => {
    console.log("[M2] WebSocket connected");
    const symbols = movers.map(m => m.symbol);
    socket.subscribe(symbols);
    if (socket.LiteMode) socket.mode(socket.LiteMode);
  });

  socket.on("message", async (msg) => {
    const data = Array.isArray(msg) ? msg : msg.d || msg.data || [msg];
    for (const t of data) {
      const sym = t.symbol || t.s;
      let price = t.ltp || t.lp || t.c || t.v?.lp;
      if (!sym || !Number.isFinite(Number(price))) continue;

      price = Number(price);
      const ts = (t.timestamp || Date.now()) * 1000;

      updateMinuteSeries(sym, price, ts);
      await computeRSIAndStore(sym, price);
    }
  });

  socket.on("close", () => {
    console.log("[M2] Socket closed. Reconnecting...");
    setTimeout(connectSocket, CONFIG.SOCKET_RECONNECT_MS);
  });

  socket.on("error", (e) => {
    console.log("[M2] Socket error:", e.message);
  });

  socket.connect();
}

// ---- MAIN ENTRY ----
async function startM2Engine() {
  console.log("========== M2 ENGINE STARTING ==========");

  movers = await M1Mover.find().lean();

  if (!movers.length) {
    console.log("[M2] No movers found in DB");
    return { ok: false, message: "No movers in database" };
  }

  console.log(`[M2] Loaded ${movers.length} movers from DB`);

  await initHistoryForMovers();

  await connectSocket();

  return {
    ok: true,
    message: "M2 Engine running live RSI monitoring",
    moverCount: movers.length
  };
}

module.exports = {
  startM2Engine
};
