"use strict";

const { DateTime } = require("luxon");
const fy = require("./fyersSdk"); // we already have this for history()
const { calcRSI14FromCandles } = require("../utils/indicators");
const { IST } = require("../utils/time");
const M2Signal = require("../models/M2Signal");
const m1Service = require("./m1.service"); // we'll reuse its getMovers()

// Tunable concurrency (safe defaults)
const SCAN_CONCURRENCY = 6;
const DB_UPSERT_CONCURRENCY = 6;

/**
 * small concurrency pool: runs workerFn(item) for each item, at most `concurrency` in flight.
 */
async function asyncPool(items, workerFn, concurrency = 5) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const p = (async () => workerFn(item))();
    results.push(p);
    executing.add(p);

    const cleanup = () => executing.delete(p);
    p.then(cleanup, cleanup);

    if (executing.size >= concurrency) {
      // wait for any to finish
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Normalize candle shapes to a consistent array format:
 * preferred output candle: [timestamp, open, high, low, close, volume]
 *
 * Accepts:
 *  - arrays like [ts, o, h, l, c, v]
 *  - objects like { t, o, h, l, c, v } or { time, open, high, low, close, volume }
 */
function normalizeCandles(rawCandles) {
  if (!Array.isArray(rawCandles)) return [];

  return rawCandles.map((c) => {
    if (Array.isArray(c)) {
      // assume already in [ts, o, h, l, c, v] form (or similar)
      // ensure length >= 5 and pad volume if missing
      const ts = c[0];
      const o = c[1];
      const h = c[2];
      const l = c[3];
      const cl = c[4];
      const v = c.length >= 6 ? c[5] : 0;
      return [ts, o, h, l, cl, v];
    } else if (c && typeof c === "object") {
      // object shapes: try common keys
      const ts = c.t ?? c.time ?? c.timestamp ?? c[0] ?? null;
      const o = c.o ?? c.open ?? c.openPrice ?? c[1] ?? null;
      const h = c.h ?? c.high ?? c[2] ?? null;
      const l = c.l ?? c.low ?? c[3] ?? null;
      const cl = c.c ?? c.close ?? c.closePrice ?? c[4] ?? null;
      const v = c.v ?? c.volume ?? 0;
      return [ts, o, h, l, cl, v];
    } else {
      // unknown format: return a placeholder that will be filtered later
      return [null, null, null, null, null, 0];
    }
  }).filter(c => Number.isFinite(Number(c[4]))); // keep only candles with valid close
}

/**
 * Fetch last N minutes candles (for RSI)
 * Pulls last ~2 days of 5m candles (safe for RSI(14))
 */
async function fetchRecent5MinCandles(symbol) {
  try {
    const nowIst = DateTime.now().setZone(IST);
    const to = nowIst.toISODate(); // yyyy-MM-dd
    const from = nowIst.minus({ days: 2 }).toISODate();

    const resp = await fy.getHistory({
      symbol,
      resolution: "5",
      range_from: from,
      range_to: to
    });

    const raw = resp?.candles ?? resp?.data ?? [];
    const candles = normalizeCandles(raw);
    return candles;
  } catch (err) {
    // bubble up / caller handles errors - but log for visibility
    console.error("[M2] fetchRecent5MinCandles error for", symbol, err?.message || err);
    throw err;
  }
}

/**
 * Core logic:
 * 1. Get movers from M1 (5%+ up)
 * 2. For each mover, compute RSI(14) on 5m data
 * 3. Save to DB (M2Signal)
 * 4. Return structured result
 */
async function scanRSIEntryZone() {
  // get movers from m1
  const m1Result = await m1Service.getMovers();
  if (!m1Result || !m1Result.ok || !Array.isArray(m1Result.data) || m1Result.data.length === 0) {
    return { ok: true, data: [] };
  }

  const movers = m1Result.data;

  const out = [];

  // worker processes one mover
  async function worker(stock) {
    const symbol = stock.symbol;
    try {
      const candles = await fetchRecent5MinCandles(symbol);
      // require at least 20 (or some minimum) 5m candles for RSI14 (14 + some buffer)
      if (!Array.isArray(candles) || candles.length < 16) {
        // not enough candles — skip
        return null;
      }

      // calcRSI14FromCandles might expect an array of candles (close at index 4).
      // We pass normalized candles (array form). If your helper expects a different format,
      // adjust it there; this normalized shape is standard.
      const rsi = await calcRSI14FromCandles(candles);

      // if the indicator lib returns undefined/null or NaN, skip
      if (rsi == null || !Number.isFinite(Number(rsi))) {
        return null;
      }

      const numericRsi = Number(rsi);
      const inZone = numericRsi >= 40 && numericRsi <= 50;

      // upsert in DB (we'll return and also persist later)
      const doc = {
        symbol,
        rsi: numericRsi,
        timeframe: "5m",
        inEntryZone: inZone,
        updatedAt: new Date()
      };

      return {
        doc,
        payload: {
          symbol,
          rsi: numericRsi,
          inEntryZone: inZone,
          ltp: stock.ltp,
          changePct: stock.changePct
        }
      };
    } catch (err) {
      // If FYERS fails or calc fails, just skip symbol but log error
      console.error("[M2] RSI calc error for", symbol, err?.message || err);
      return null;
    }
  }

  // process movers with controlled concurrency
  const processed = await asyncPool(movers, worker, SCAN_CONCURRENCY);

  // filter out nulls and build DB upsert tasks
  const upserts = [];
  for (const p of processed) {
    if (!p) continue;
    upserts.push(p);
    out.push(p.payload);
  }

  // Persist results to DB with controlled concurrency
  await asyncPool(
    upserts,
    async (item) => {
      try {
        await M2Signal.findOneAndUpdate(
          { symbol: item.doc.symbol },
          item.doc,
          { upsert: true }
        );
      } catch (err) {
        console.warn("[M2] DB upsert failed for", item.doc.symbol, err?.message || err);
      }
    },
    DB_UPSERT_CONCURRENCY
  );

  // sort: best candidates first
  out.sort((a, b) => {
    // priority 1: inEntryZone true first
    if (a.inEntryZone && !b.inEntryZone) return -1;
    if (!a.inEntryZone && b.inEntryZone) return 1;
    // priority 2: lower RSI first (closer to oversold pullback)
    return a.rsi - b.rsi;
  });

  return { ok: true, data: out };
}

/**
 * Get last saved signals from DB (without recomputing)
 */
async function getLatestSignalsFromDB() {
  const docs = await M2Signal.find().sort({ updatedAt: -1 }).limit(200).lean();
  return { ok: true, data: docs };
}

module.exports = {
  scanRSIEntryZone,
  getLatestSignalsFromDB
};
