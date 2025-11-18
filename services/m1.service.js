// services/m1.service.js - CLEAN PHASE-1 ENGINE ONLY
"use strict";

const fs = require("fs").promises;
const path = require("path");
const { DateTime } = require("luxon");
const fy = require("./fyersSdk");
const LiveQuote = require("../models/LiveQuote");
const M1Mover = require("../models/M1Mover");

// ---------------- CONFIG ----------------
const CONFIG = Object.freeze({
  QUOTE_BATCH_SIZE: 40,
  QUOTE_BATCH_DELAY_MS: 800,
  ALERT_THRESHOLD_PCT: 5,
});

// ---------------- UTILS ----------------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function percentChange(prevClose, ltp) {
  return ((ltp - prevClose) / prevClose) * 100;
}

// ---------------- Load Universe File ----------------
let cachedUniverse = null;
let cacheTimestamp = 0;
const UNIVERSE_CACHE_MS = 5 * 60 * 1000;

async function loadUniverse() {
  const now = Date.now();
  if (cachedUniverse && now - cacheTimestamp < UNIVERSE_CACHE_MS) {
    return cachedUniverse;
  }

  try {
    const p = path.join(__dirname, "../nse_universe.json");
    const raw = await fs.readFile(p, "utf8");
    const arr = JSON.parse(raw || "[]");

    const clean = arr
      .map((s) => fy.toFyersSymbol(s))
      .filter(Boolean);

    cachedUniverse = clean;
    cacheTimestamp = now;
    return clean;
  } catch (err) {
    console.error("[M1] loadUniverse error:", err.message);
    return [];
  }
}

// ---------------- Extractors ----------------
function extractPrevClose(quote) {
  const v = quote.raw?.v || quote.raw || {};
  const candidates = [
    v.prev_close_price, v.prevPrice, v.pc,
    quote.prevClose, quote.prev_close_price
  ];

  for (const c of candidates) {
    const n = toNumber(c);
    if (n) return n;
  }
  return null;
}

function extractLtp(quote) {
  const v = quote.raw?.v || quote.raw || {};
  const candidates = [
    v.lp, v.ltp, v.price, quote.ltp, quote.c
  ];
  for (const c of candidates) {
    const n = toNumber(c);
    if (n) return n;
  }
  return null;
}

function normalizeQuote(quote) {
  if (!quote) return null;

  return {
    symbol: quote.symbol,
    raw: quote,
    prevClose: extractPrevClose(quote),
    ltp: extractLtp(quote)
  };
}

// ---------------- Batch Quotes Fetching ----------------
async function fetchQuoteSnapshots(symbols) {
  if (!symbols.length) return [];

  const snapshots = [];

  for (let i = 0; i < symbols.length; i += CONFIG.QUOTE_BATCH_SIZE) {
    const batch = symbols.slice(i, i + CONFIG.QUOTE_BATCH_SIZE);

    let quotes = [];
    try {
      quotes = await fy.getQuotes(batch);
    } catch (err) {
      console.error("[M1] getQuotes error:", err.message);
      continue;
    }

    for (const q of quotes) {
      const snap = normalizeQuote(q);
      if (snap && snap.prevClose && snap.ltp) snapshots.push(snap);
    }

    if (i + CONFIG.QUOTE_BATCH_SIZE < symbols.length) {
      await sleep(CONFIG.QUOTE_BATCH_DELAY_MS);
    }
  }

  return snapshots;
}

// ---------------- Save Quotes to LiveQuote Table ----------------
async function storeQuotesInDatabase(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return 0;

  const bulkOps = [];

  for (const snap of snapshots) {
    const changeAmt = snap.ltp - snap.prevClose;
    const changePct = percentChange(snap.prevClose, snap.ltp);
    const name = snap.symbol.replace("NSE:", "").replace("-EQ", "");

    bulkOps.push({
      updateOne: {
        filter: { symbol: snap.symbol },
        update: {
          $set: {
            symbol: snap.symbol,
            name,
            ltp: snap.ltp,
            prevClose: snap.prevClose,
            changePct: Number(changePct.toFixed(2)),
            changeAmt: Number(changeAmt.toFixed(2)),
            fetchedAt: new Date(),
            source: "m1_phase1",
            isActive: true
          },
        },
        upsert: true,
      },
    });

    if (bulkOps.length >= 500) {
      await LiveQuote.bulkWrite(bulkOps, { ordered: false });
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await LiveQuote.bulkWrite(bulkOps, { ordered: false });
  }

  console.log(`[M1] Stored ${snapshots.length} quotes.`);
  return snapshots.length;
}

// ---------------- Save Movers to M1Mover Table ----------------
async function persistMovers(movers = []) {
  if (!movers.length) return;

  for (const m of movers) {
    await M1Mover.findOneAndUpdate(
      { symbol: m.symbol },
      { ...m, capturedAt: new Date() },
      { upsert: true }
    );
  }

  console.log(`[M1] Saved ${movers.length} movers.`);
}

// ---------------- MAIN ENGINE (PHASE–1 ONLY) ----------------
async function startEngine() {
  console.log("[M1] Starting Phase-1 Scan Engine…");

  const universe = await loadUniverse();
  if (!universe.length) {
    return { ok: false, error: "Universe empty" };
  }

  console.log(`[M1] Universe loaded: ${universe.length} symbols`);
  const snapshots = await fetchQuoteSnapshots(universe);

  console.log(`[M1] Got ${snapshots.length} quote snapshots`);

  // Compute movers
  const movers = [];
  for (const s of snapshots) {
    const changePct = percentChange(s.prevClose, s.ltp);
    if (Math.abs(changePct) >= CONFIG.ALERT_THRESHOLD_PCT) {
      movers.push({
        symbol: s.symbol,
        prevClose: s.prevClose,
        ltp: s.ltp,
        changePct,
      });
    }
  }

  movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  // Save quotes + movers
  await storeQuotesInDatabase(snapshots);
  await persistMovers(movers);

  console.log(`[M1] Phase-1 scan complete. Movers = ${movers.length}`);
  return { ok: true, movers };
}

module.exports = {
  startEngine,
  loadUniverse,
  fetchQuoteSnapshots
};
