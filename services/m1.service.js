// services/m1.service.js – PRODUCTION GRADE M1 ENGINE
"use strict";

const fs = require("fs").promises;
const path = require("path");
const { DateTime } = require("luxon");
const mongoose = require("mongoose");
const fy = require("./fyersSdk");
const LiveQuote = require("../models/LiveQuote");
const M1Mover = require("../models/M1Mover");

// ---------------- CONFIG ----------------
const CONFIG = Object.freeze({
  QUOTE_BATCH_SIZE: 40,
  QUOTE_BATCH_DELAY_MS: 700,
  ALERT_THRESHOLD_PCT: 5,
  UNIVERSE_CACHE_MS: 5 * 60 * 1000,
});

// ---------------- INTERNAL GLOBALS ----------------
let universeCache = null;
let universeCacheTS = 0;
let m1Running = false;  // HARD LOCK

// ---------------- UTILS ----------------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const IST = "Asia/Kolkata";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pctChange(prev, ltp) {
  if (!prev || !ltp) return null;
  return ((ltp - prev) / prev) * 100;
}

// ---------------- Load Universe (cached 5 mins) ----------------
async function loadUniverse() {
  const now = Date.now();
  if (universeCache && now - universeCacheTS < CONFIG.UNIVERSE_CACHE_MS)
    return universeCache;

  try {
    const filePath = path.join(__dirname, "../nse_universe.json");
    const raw = await fs.readFile(filePath, "utf8");
    const arr = JSON.parse(raw || "[]");

    universeCache = arr
      .map((s) => fy.toFyersSymbol(s))
      .filter(Boolean);
    universeCacheTS = now;

    console.log(`[M1] Universe loaded: ${universeCache.length}`);
    return universeCache;
  } catch (err) {
    console.error("[M1] Error reading universe:", err.message);
    return [];
  }
}

// ---------------- Extractors ----------------
function extractPrevClose(q) {
  const v = q.raw?.v || q.raw || {};

  const candidates = [
    v.prev_close_price, v.prevPrice, v.pc,
    q.prevClose, q.prev_close_price
  ];

  for (const c of candidates) {
    const n = safeNum(c);
    if (n) return n;
  }
  return null;
}

function extractLTP(q) {
  const v = q.raw?.v || q.raw || {};
  const candidates = [v.lp, v.ltp, v.price, q.ltp, q.c];

  for (const c of candidates) {
    const n = safeNum(c);
    if (n) return n;
  }
  return null;
}

function normalizeQuote(q) {
  if (!q) return null;
  const prevClose = extractPrevClose(q);
  const ltp = extractLTP(q);

  if (!prevClose || !ltp) return null;

  return {
    symbol: q.symbol,
    raw: q,
    prevClose,
    ltp,
  };
}

// ---------------- Fetch Quotes in Batches ----------------
async function fetchQuoteSnapshots(symbols) {
  if (!symbols.length) return [];

  const out = [];

  for (let i = 0; i < symbols.length; i += CONFIG.QUOTE_BATCH_SIZE) {
    const batch = symbols.slice(i, i + CONFIG.QUOTE_BATCH_SIZE);

    let result = [];
    try {
      result = await fy.getQuotes(batch);
    } catch (err) {
      console.error("[M1] getQuotes API error:", err.message);
      continue;
    }

    for (const q of result) {
      const snap = normalizeQuote(q);
      if (snap) out.push(snap);
    }

    if (i + CONFIG.QUOTE_BATCH_SIZE < symbols.length) {
      await sleep(CONFIG.QUOTE_BATCH_DELAY_MS);
    }
  }

  return out;
}

// ---------------- DB Writes ----------------
async function storeQuotes(snapshots) {
  if (!snapshots.length) return;

  const bulk = [];

  for (const s of snapshots) {
    const changePct = pctChange(s.prevClose, s.ltp);
    const changeAmt = s.ltp - s.prevClose;
    const cleanName = s.symbol.replace("NSE:", "").replace("-EQ", "");

    bulk.push({
      updateOne: {
        filter: { symbol: s.symbol },
        update: {
          $set: {
            symbol: s.symbol,
            name: cleanName,
            ltp: s.ltp,
            prevClose: s.prevClose,
            changePct: Number(changePct.toFixed(2)),
            changeAmt: Number(changeAmt.toFixed(2)),
            fetchedAt: new Date(),
            source: "m1",
            isActive: true,
          }
        },
        upsert: true,
      }
    });

    if (bulk.length >= 500) {
      await LiveQuote.bulkWrite(bulk, { ordered: false });
      bulk.length = 0;
    }
  }

  if (bulk.length) {
    await LiveQuote.bulkWrite(bulk, { ordered: false });
  }

  console.log(`[M1] Stored ${snapshots.length} LiveQuote rows.`);
}

async function saveMovers(movers) {
  const today = DateTime.now().setZone(IST).toISODate();

  console.log(`[M1] Saving movers for ${today}...`);

  // Safe method: replace in single transaction-like behavior
  await M1Mover.deleteMany({ moverDate: today });

  for (const m of movers) {
    await M1Mover.updateOne(
      { symbol: m.symbol, moverDate: today },
      {
        $set: {
          symbol: m.symbol,
          prevClose: m.prevClose,
          ltp: m.ltp,
          changePct: Number(m.changePct.toFixed(2)),
          moverDate: today,
          capturedAt: new Date(),
        }
      },
      { upsert: true }
    );
  }

  console.log(`[M1] Movers saved (${movers.length})`);
}

// ---------------- MAIN ENGINE ----------------
async function startEngine() {
  if (m1Running) {
    console.log("[M1] Already running → skipping");
    return { ok: false, retry: false, error: "M1 locked" };
  }

  m1Running = true;
  console.log("[M1] Phase-1 Engine STARTING...");

  try {
    // Ensure DB connected
    if (mongoose.connection.readyState === 0) {
      console.warn("[M1] Mongo not ready → retry later");
      return { ok: false, retry: true, error: "DB not connected" };
    }

    const universe = await loadUniverse();
    if (!universe.length) {
      return { ok: false, retry: false, error: "Universe empty" };
    }

    const snapshots = await fetchQuoteSnapshots(universe);
    console.log(`[M1] Retrieved ${snapshots.length} snapshots`);

    await storeQuotes(snapshots);

    // Filter movers
    const movers = snapshots.filter(s => {
      const cp = pctChange(s.prevClose, s.ltp);
      return cp !== null && cp >= CONFIG.ALERT_THRESHOLD_PCT;
    }).sort((a, b) => b.changePct - a.changePct);

    await saveMovers(movers);

    console.log("[M1] COMPLETED successfully.");
    return { ok: true, movers };
  } catch (err) {
    console.error("[M1] Fatal error:", err.message);
    return { ok: false, retry: true, error: err.message };
  } finally {
    m1Running = false;
  }
}

module.exports = {
  startEngine,
  loadUniverse,
  fetchQuoteSnapshots,
};
