// services/m2.service.js
"use strict";

const { DateTime } = require("luxon");
const fy = require("../fyersSdk"); // we already have this for history()
const { calcRSI14FromCandles } = require("../utils/indicators");
const { IST } = require("../utils/time");
const M2Signal = require("../models/M2Signal");
const m1Service = require("./m1.service"); // we'll reuse its getMovers()

/**
 * Fetch last N minutes candles (for RSI)
 * We'll pull, say, last ~2 hours of 5m candles so RSI(14) makes sense.
 */
async function fetchRecent5MinCandles(symbol) {
  const nowIst = DateTime.now().setZone(IST);
  const to = nowIst.toISODate(); // YYYY-MM-DD
  const from = nowIst.minus({ days: 2 }).toISODate(); // we take last 2 days just to be safe

  const resp = await fy.getHistory({
    symbol,
    resolution: "5",
    range_from: from,
    range_to: to
  });

  const candles = resp?.candles || resp?.data || [];
  return candles;
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
  if (!m1Result.ok || !m1Result.data || !m1Result.data.length) {
    return { ok: true, data: [] };
  }

  const out = [];
  for (const stock of m1Result.data) {
    const symbol = stock.symbol;

    try {
      const candles = await fetchRecent5MinCandles(symbol);
      const rsi = calcRSI14FromCandles(candles);
      if (rsi == null) {
        continue; // not enough data
      }

      const inZone = rsi >= 40 && rsi <= 50;

      // upsert in DB
      await M2Signal.findOneAndUpdate(
        { symbol },
        {
          symbol,
          rsi,
          timeframe: "5m",
          inEntryZone: inZone,
          updatedAt: new Date()
        },
        { upsert: true }
      );

      out.push({
        symbol,
        rsi,
        inEntryZone: inZone,
        ltp: stock.ltp,
        changePct: stock.changePct
      });
    } catch (err) {
      // If FYERS fails, just skip symbol
      console.error("[M2] RSI calc error for", symbol, err.message || err);
    }
  }

  // sort: best candidates first
  out.sort((a, b) => {
    // priority 1: inEntryZone true first
    if (a.inEntryZone && !b.inEntryZone) return -1;
    if (!a.inEntryZone && b.inEntryZone) return 1;
    // priority 2: lower RSI (closer to oversold pullback) first
    return a.rsi - b.rsi;
  });

  return { ok: true, data: out };
}

/**
 * Get last saved signals from DB (without recomputing)
 */
async function getLatestSignalsFromDB() {
  const docs = await M2Signal.find().sort({ updatedAt: -1 }).limit(200).lean();
  // we might want to join with latest price (% change) later, but for now just send rsi data
  return { ok: true, data: docs };
}

module.exports = {
  scanRSIEntryZone,
  getLatestSignalsFromDB
};
