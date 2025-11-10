"use strict";

const { DateTime } = require("luxon");
const fy = require("./fyersSdk"); // history()
const { calcRSI14FromCandles } = require("../utils/indicators");
const { IST } = require("../utils/time");
const M2Signal = require("../models/M2Signal");
const m1Service = require("./m1.service"); // reuse getMovers()

/* ======================= Config ======================= */
const CONFIG = Object.freeze({
  SCAN_CONCURRENCY: Number(process.env.M2_SCAN_CONCURRENCY) || 6,
  DB_BULK_CHUNK: Number(process.env.M2_DB_BULK_CHUNK) || 500, // safety chunk if list is huge
  RSI_MIN_CANDLES: Number(process.env.M2_RSI_MIN_CANDLES) || 16, // 14 + buffer
  RSI_LOWER: Number(process.env.M2_RSI_LOWER) || 40,
  RSI_UPPER: Number(process.env.M2_RSI_UPPER) || 50,
  MOVERS_TOP_N: Number(process.env.M2_MOVERS_TOP_N) || 0, // 0 = all movers
  HISTORY_LOOKBACK_MINUTES: Number(process.env.M2_HISTORY_LOOKBACK_MINUTES) || 240, // 4 hours fallback
  RSI_LOCAL_LIMIT: Number(process.env.M2_RSI_LOCAL_LIMIT) || 90,
});

/* ======================= Small utils ======================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stable concurrency pool with predictable parallelism */
async function asyncPool(items, workerFn, concurrency = 5) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (concurrency < 1) concurrency = 1;

  const ret = new Array(items.length);
  let i = 0;
  const executing = new Set();

  async function enqueue() {
    if (i >= items.length) return;
    const idx = i++;
    const p = Promise.resolve()
      .then(() => workerFn(items[idx], idx))
      .then((v) => (ret[idx] = v))
      .catch(() => (ret[idx] = undefined))
      .finally(() => executing.delete(p));

    executing.add(p);
    if (executing.size >= concurrency) await Promise.race(executing);
    return enqueue();
  }

  const starters = Array.from({ length: Math.min(concurrency, items.length) }, enqueue);
  await Promise.all(starters);
  await Promise.all(executing);

  return ret;
}

/** Coerce a value to finite number or null */
function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/** Normalize heterogeneous candle shapes to [ts, o, h, l, c, v] with numbers */
function normalizeCandles(rawCandles) {
  if (!Array.isArray(rawCandles)) return [];

  const out = [];
  for (const c of rawCandles) {
    let ts, o, h, l, cl, v;
    if (Array.isArray(c)) {
      ts = num(c[0]); o = num(c[1]); h = num(c[2]); l = num(c[3]); cl = num(c[4]); v = num(c[5] ?? 0) ?? 0;
    } else if (c && typeof c === "object") {
      ts = num(c.t ?? c.time ?? c.timestamp ?? c[0]);
      o = num(c.o ?? c.open ?? c.openPrice ?? c[1]);
      h = num(c.h ?? c.high ?? c[2]);
      l = num(c.l ?? c.low ?? c[3]);
      cl = num(c.c ?? c.close ?? c.closePrice ?? c[4]);
      v = num(c.v ?? c.volume) ?? 0;
    }

    if (cl == null || ts == null) continue; // need at least ts & close
    out.push([ts, o ?? 0, h ?? 0, l ?? 0, cl, v]);
  }

  // sort by timestamp asc if not already
  if (out.length > 1 && out[0][0] > out[out.length - 1][0]) {
    out.sort((a, b) => a[0] - b[0]);
  }
  return out;
}

/* ======================= Data fetch ======================= */
async function fetchMinuteCandlesFromHistory(symbol) {
  const nowIst = DateTime.now().setZone(IST);
  const from = nowIst.minus({ minutes: CONFIG.HISTORY_LOOKBACK_MINUTES }).toISODate();
  const to = nowIst.toISODate();

  const resp = await fy.getHistory({
    symbol,
    resolution: "1",
    range_from: from,
    range_to: to
  });
  const raw = resp?.candles ?? resp?.data ?? [];
  return normalizeCandles(raw);
}

function mapLocalMinuteSeries(series = []) {
  return series.map((c) => [
    c.ts,
    Number(c.o ?? c.open ?? c[1]) || 0,
    Number(c.h ?? c.high ?? c[2]) || 0,
    Number(c.l ?? c.low ?? c[3]) || 0,
    Number(c.c ?? c.close ?? c[4]) || 0,
    Number(c.v ?? c.volume ?? c[5]) || 0
  ]);
}

async function fetchRecent1MinCandles(symbol) {
  const localSeries = m1Service.getMinuteCandles
    ? m1Service.getMinuteCandles(symbol, CONFIG.RSI_LOCAL_LIMIT)
    : [];

  if (Array.isArray(localSeries) && localSeries.length >= CONFIG.RSI_MIN_CANDLES) {
    return mapLocalMinuteSeries(localSeries);
  }

  try {
    return await fetchMinuteCandlesFromHistory(symbol);
  } catch (err) {
    console.error("[M2] History fallback failed for", symbol, err?.message || err);
    return [];
  }
}

/* ======================= Core scan ======================= */
async function scanRSIEntryZone() {
  // 1) Pull movers from M1 (requires engine running)
  const m1Result = await m1Service.getMovers();
  if (!m1Result?.ok || !Array.isArray(m1Result.data) || m1Result.data.length === 0) {
    return { ok: true, data: [] };
  }

  // Optionally limit to top-N movers (heaviest % change first)
  const movers = CONFIG.MOVERS_TOP_N > 0
    ? m1Result.data.slice(0, CONFIG.MOVERS_TOP_N)
    : m1Result.data;

  // 2) Per mover: fetch 1m candles → RSI(14) → build payload + doc
  const processed = await asyncPool(
    movers,
    async (stock) => {
      const symbol = stock.symbol;
      try {
        const candles = await fetchRecent1MinCandles(symbol);
        if (!Array.isArray(candles) || candles.length < CONFIG.RSI_MIN_CANDLES) return null;

        // calcRSI14FromCandles expects [ts,o,h,l,c,v] arrays (close @ idx 4)
        const rsi = await calcRSI14FromCandles(candles);
        const r = num(rsi);
        if (r == null) return null;

        const inZone = r >= CONFIG.RSI_LOWER && r <= CONFIG.RSI_UPPER;

        return {
          doc: {
            symbol,
            rsi: r,
            timeframe: "1m",
            inEntryZone: inZone,
            updatedAt: new Date()
          },
          payload: {
            symbol,
            rsi: r,
            inEntryZone: inZone,
            ltp: stock.ltp,
            changePct: stock.changePct
          }
        };
      } catch (err) {
        console.error("[M2] RSI calc error for", symbol, err?.message || err);
        return null;
      }
    },
    CONFIG.SCAN_CONCURRENCY
  );

  // 3) Filter good results
  const good = processed.filter(Boolean);
  const out = good.map((g) => g.payload);

  // 4) Persist using bulkWrite (efficient & atomic-ish per batch)
  if (good.length) {
    const ops = good.map(({ doc }) => ({
      updateOne: {
        filter: { symbol: doc.symbol },
        update: { $set: doc },
        upsert: true
      }
    }));

    if (ops.length <= CONFIG.DB_BULK_CHUNK) {
      try { await M2Signal.bulkWrite(ops, { ordered: false }); }
      catch (e) { console.warn("[M2] bulkWrite failed:", e?.message || e); }
    } else {
      // safety chunking for extremely large lists
      for (let i = 0; i < ops.length; i += CONFIG.DB_BULK_CHUNK) {
        const chunk = ops.slice(i, i + CONFIG.DB_BULK_CHUNK);
        try { await M2Signal.bulkWrite(chunk, { ordered: false }); }
        catch (e) { console.warn("[M2] bulkWrite chunk failed:", e?.message || e); }
        await sleep(5); // tiny breather for event loop fairness
      }
    }
  }

  // 5) Sort — inZone first, then lower RSI first
  out.sort((a, b) => (b.inEntryZone - a.inEntryZone) || (a.rsi - b.rsi));
  return { ok: true, data: out };
}

/* ======================= Read latest (no recompute) ======================= */
async function getLatestSignalsFromDB() {
  const docs = await M2Signal.find().sort({ updatedAt: -1 }).limit(200).lean();
  return { ok: true, data: docs };
}

module.exports = {
  scanRSIEntryZone,
  getLatestSignalsFromDB
};
