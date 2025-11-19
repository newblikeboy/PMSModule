// services/m2.service.js
"use strict";

/**
 * M2 Engine - RSI monitor (1m)
 * - seeds minute series from fy.getHistory()
 * - subscribes to live ticks from marketSocket
 * - updates local minute series and recalculates RSI(14)
 * - writes M2Signal when RSI in [40,50]
 */

const fy = require("./fyersSdk");
const marketSocket = require("./marketSocket.service");
const { calcRSI14FromCandles } = require("../utils/indicators");
const M2Signal = require("../models/M2Signal");
const M1Mover = require("../models/M1Mover");
const { DateTime } = require("luxon");

const CONFIG = {
  RSI_LOWER: 40,
  RSI_UPPER: 50,
  MAX_MIN_CANDLES: 300,
  HISTORY_LOOKBACK_MINUTES: 240,
  HISTORY_FETCH_DELAY_MS: 120,
  RSI_DEBOUNCE_MIN_DIFF: 0.2, // don't write small rsi noise
};

let minuteSeries = new Map(); // symbol -> [[ts,o,h,l,c,v], ...]
let lastRSI = new Map();
let moversList = [];
let tickHandler = null;

/* ---------- Utils ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bucket = (ts) => Math.floor(ts / 60000) * 60000;

/* normalize history candle (our getHistory returns {ts,o,h,l,c,v}) */
function normalizeHistory(historyCandles = []) {
  return historyCandles
    .map((c) => {
      const ts = bucket(c.ts);
      return [ts, Number(c.o), Number(c.h), Number(c.l), Number(c.c), Number(c.v || 0)];
    })
    .filter((r) => Number.isFinite(r[0]) && Number.isFinite(r[4]));
}

function updateMinuteSeries(symbol, price, ts) {
  if (!symbol || !Number.isFinite(Number(price))) return;
  ts = bucket(ts);
  let arr = minuteSeries.get(symbol);
  if (!arr) {
    arr = [];
    minuteSeries.set(symbol, arr);
  }
  let last = arr[arr.length - 1];
  if (!last || last[0] !== ts) {
    arr.push([ts, price, price, price, price, 1]);
    if (arr.length > CONFIG.MAX_MIN_CANDLES) arr.splice(0, arr.length - CONFIG.MAX_MIN_CANDLES);
  } else {
    last[2] = Math.max(last[2], price);
    last[3] = Math.min(last[3], price);
    last[4] = price;
    last[5] = (last[5] || 0) + 1;
  }
}

async function seedHistoryForSymbol(symbol) {
  try {
    // Use today's date (date_format: "1")
    const today = DateTime.now().toISODate();
    const data = await fy.getHistory({
      symbol,
      resolution: "1",
      date_format: "1",
      range_from: today,
      range_to: today,
      cont_flag: "1",
    });

    // our fy.getHistory returns normalized array of {ts,o,h,l,c,v}
    const normalized = Array.isArray(data) ? data : [];
    const arr = normalizeHistory(normalized);
    // set into series (should be ascending by ts)
    minuteSeries.set(symbol, arr);
    return arr;
  } catch (err) {
    console.warn("[M2] seedHistory failed for", symbol, err?.message || err);
    return [];
  }
}

async function initHistoryForMovers(movers) {
  for (const m of movers) {
    await seedHistoryForSymbol(m.symbol);
    // small delay to avoid API burst
    await sleep(CONFIG.HISTORY_FETCH_DELAY_MS);
  }
}

async function computeAndMaybeStoreRSI(symbol) {
  const arr = minuteSeries.get(symbol) || [];
  if (!arr || arr.length < 20) return;
  try {
    const rsi = await calcRSI14FromCandles(arr);
    if (!Number.isFinite(rsi)) return;

    const prev = lastRSI.get(symbol);
    if (prev && Math.abs(prev - rsi) < CONFIG.RSI_DEBOUNCE_MIN_DIFF) return;
    lastRSI.set(symbol, rsi);

    const inZone = rsi >= CONFIG.RSI_LOWER && rsi <= CONFIG.RSI_UPPER;
    if (inZone) {
      await M2Signal.findOneAndUpdate(
        { symbol },
        {
          symbol,
          rsi: Number(rsi.toFixed(2)),
          timeframe: "1m",
          inEntryZone: true,
          updatedAt: new Date(),
        },
        { upsert: true }
      );
      console.log(`[M2] SIGNAL ${symbol} — RSI ${rsi.toFixed(2)} (40-50)`);
    } else {
      // Optionally mark not in zone (keep doc but set flag false)
      await M2Signal.findOneAndUpdate(
        { symbol },
        {
          symbol,
          rsi: Number(rsi.toFixed(2)),
          timeframe: "1m",
          inEntryZone: false,
          updatedAt: new Date(),
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn("[M2] computeRSI error", symbol, err?.message || err);
  }
}

/* ---------- MarketSocket tick handler ---------- */
function onTick(tick) {
  const sym = tick.symbol;
  const price = Number(tick.ltp);
  const ts = Number(tick.ts);
  if (!sym || !Number.isFinite(price)) return;
  updateMinuteSeries(sym, price, ts);
  computeAndMaybeStoreRSI(sym).catch((e) => console.warn("[M2] RSI compute err", e?.message || e));
}

/* ---------- Start / Stop / Public API ---------- */
async function startM2Engine() {
  console.log("[M2] starting engine...");

  // load today's movers from M1Mover
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  moversList = await M1Mover.find({ capturedAt: { $gte: todayStart } }).lean();

  if (!Array.isArray(moversList) || moversList.length === 0) {
    console.log("[M2] no movers found for today");
    return { ok: false, message: "no movers" };
  }

  console.log(`[M2] loaded ${moversList.length} movers`);

  // seed history for movers
  await initHistoryForMovers(moversList);

  // subscribe via marketSocket
  const symbols = moversList.map((m) => m.symbol).filter(Boolean);
  await marketSocket.subscribe(symbols, "m2");

  // attach tick handler
  tickHandler = onTick;
  marketSocket.on("tick", tickHandler);

  return { ok: true, moverCount: symbols.length };
}

async function stopM2Engine() {
  try {
    if (tickHandler) {
      marketSocket.off("tick", tickHandler);
      tickHandler = null;
    }
    const symbols = moversList.map((m) => m.symbol).filter(Boolean);
    if (symbols.length) await marketSocket.unsubscribe(symbols, "m2");
    minuteSeries.clear();
    lastRSI.clear();
    moversList = [];
    console.log("[M2] stopped");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ---------- API to get signals enriched for UI ---------- */
async function getLatestSignalsFromDB() {
  try {
    const signals = await M2Signal.find().lean();
    if (!signals || !signals.length) return { ok: true, data: [], count: 0 };

    // fetch LTPs in batch using marketSocket cache first then fallback to fy.getQuotes
    const enriched = [];
    const needRest = [];
    for (const s of signals) {
      const last = marketSocket.getLastTick(s.symbol);
      if (last && Number.isFinite(Number(last.ltp))) {
        enriched.push({
          symbol: s.symbol,
          rsi: s.rsi,
          inEntryZone: s.inEntryZone,
          ltp: last.ltp,
          updatedAt: s.updatedAt,
        });
      } else {
        needRest.push(s.symbol);
      }
    }

    if (needRest.length) {
      try {
        const quotes = await fy.getQuotes(needRest);
        const qmap = new Map();
        for (const q of quotes) qmap.set(q.symbol, q);
        for (const s of signals.filter(x => needRest.includes(x.symbol))) {
          const q = qmap.get(s.symbol);
          enriched.push({
            symbol: s.symbol,
            rsi: s.rsi,
            inEntryZone: s.inEntryZone,
            ltp: q?.ltp ?? null,
            updatedAt: s.updatedAt,
          });
        }
      } catch (err) {
        console.warn("[M2] getQuotes fallback failed", err?.message || err);
      }
    }

    return { ok: true, data: enriched, count: enriched.length };
  } catch (err) {
    console.error("[M2] getLatestSignalsFromDB error", err?.message || err);
    return { ok: false, error: err?.message || err, data: [] };
  }
}

module.exports = {
  startM2Engine,
  stopM2Engine,
  getLatestSignalsFromDB,
};
