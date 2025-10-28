"use strict";

const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
const { fyersDataSocket } = require("fyers-api-v3");

const fy = require("./fyersSdk"); // market data + history
const { getSocketToken } = require("./fyersAuth");
const { todayCutoffTs, isBeforeCutoff, IST } = require("../utils/time");
const M1Mover = require("../models/M1Mover");

// ---------------------------
// Internal engine state
// ---------------------------
let engineOn = false;
let socket = null;
let universeSymbols = [];
const BATCH_SIZE = 200;
let currentBatchIndex = 0;
const prevCloseMap = new Map();
const ltpMap = new Map();

let lastError = null;
let lastHeartbeatTs = null;
let lastSubscriptionRotateTs = null;

let rotationIntervalHandle = null;
let heartbeatIntervalHandle = null;
let autoStopTimeoutHandle = null;

// -----------------------------------------------------
// STEP 1. LOAD UNIVERSE
// -----------------------------------------------------
async function loadUniverse() {
  try {
    const p = path.join(__dirname, "../nse_universe.json");
    const arr = JSON.parse(fs.readFileSync(p, "utf8"));

    const clean = [];
    for (const raw of arr) {
      if (!raw) continue;
      const s = String(raw).trim();
      if (!s) continue;
      const full = fy.toFyersSymbol ? fy.toFyersSymbol(s) : (s.startsWith("NSE:") ? s : `NSE:${s}-EQ`);
      if (full && !clean.includes(full)) {
        clean.push(full);
      }
    }
    return clean;
  } catch (err) {
    lastError = "[loadUniverse] " + err.message;
    console.error(lastError);
    return [];
  }
}

// -----------------------------------------------------
// STEP 2. FETCH PREV CLOSE FOR EACH SYMBOL
// -----------------------------------------------------
async function fetchPrevClose(symbolFyersFormat) {
  try {
    const nowIST = DateTime.now().setZone(IST);
    const to = nowIST.toISODate();
    const from = nowIST.minus({ days: 7 }).toISODate();

    const resp = await fy.getHistory({
      symbol: symbolFyersFormat,
      resolution: "D",
      range_from: from,
      range_to: to
    });

    const candles = resp?.candles || [];
    if (candles.length < 1) {
      throw new Error("no historical candles");
    }

    const prev = candles[candles.length - 2] || candles[candles.length - 1];
    const prevClose = Number(prev[4]);

    if (!Number.isFinite(prevClose)) {
      throw new Error("prevClose NaN");
    }

    return prevClose;
  } catch (err) {
    console.warn("[fetchPrevClose] Fail for", symbolFyersFormat, err.message);
    lastError = err.message;
    return null;
  }
}

async function warmupPrevCloses(symbols) {
  prevCloseMap.clear();
  const results = [];

  for (const sym of symbols) {
    const pc = await fetchPrevClose(sym);
    if (pc != null) {
      prevCloseMap.set(sym, pc);
      results.push({ symbol: sym, prevClose: pc });
    }
  }

  const loadedCount = prevCloseMap.size;
  const totalCount = symbols.length;
  const sample = results
    .slice(0, 10)
    .map(r => `${r.symbol.split(":")[1]}: ${r.prevClose}`)
    .join(", ");

  console.log(`[M1] PrevClose warmup done. Loaded ${loadedCount}/${totalCount} symbols`);
  if (results.length > 0) {
    console.log(`[M1] PrevClose sample → ${sample}${results.length > 10 ? ", ..." : ""}`);
  } else {
    console.warn("[M1] No prevClose values fetched!");
  }
}

// -----------------------------------------------------
// STEP 3. SOCKET MANAGEMENT
// -----------------------------------------------------
async function ensureSocketConnected() {
  if (socket) return;

  const socketToken = await getSocketToken();
  socket = new fyersDataSocket(socketToken, "./");

  socket.on("connect", () => {
    console.log("[Socket] Connected to Fyers Stream");
    lastHeartbeatTs = Date.now();
    subscribeCurrentBatch();
    socket.autoreconnect(10);
  });

  socket.on("message", (msg) => {
    const data = Array.isArray(msg) ? msg : (msg?.d || msg?.data || [msg]);
    const arr = Array.isArray(data) ? data : [data];

    for (const t of arr) {
      const sym = t.symbol || t.s;
      const ltp = t.ltp || t.c || t.price;
      if (!sym || ltp == null) continue;
      ltpMap.set(sym, Number(ltp));
    }

    lastHeartbeatTs = Date.now();
  });

  socket.on("error", (err) => {
    lastError = err.message;
    console.error("[Socket Error]", err);
  });

  socket.on("close", () => {
    console.warn("[Socket] Closed");
    socket = null;
  });

  socket.connect();
}

function subscribeCurrentBatch() {
  if (!socket) return;
  if (!universeSymbols.length) return;

  const start = currentBatchIndex * BATCH_SIZE;
  const end = start + BATCH_SIZE;
  const batch = universeSymbols.slice(start, end);

  if (!batch.length) return;

  console.log(`[Socket] Subscribing batch ${currentBatchIndex} (${batch.length} symbols)`);
  socket.subscribe(batch, "lite");

  lastSubscriptionRotateTs = Date.now();
}

function rotateBatch() {
  if (!universeSymbols.length) return;
  if (!socket) return;

  currentBatchIndex++;
  if (currentBatchIndex * BATCH_SIZE >= universeSymbols.length) {
    currentBatchIndex = 0;
  }

  subscribeCurrentBatch();
}

// -----------------------------------------------------
// STEP 4. MOVER CALCULATION
// -----------------------------------------------------
function computeMovers(thresholdPct = 5) {
  const movers = [];

  for (const sym of universeSymbols) {
    const pc = prevCloseMap.get(sym);
    const ltp = ltpMap.get(sym);

    if (!pc || !ltp) continue;
    if (!Number.isFinite(pc) || !Number.isFinite(ltp)) continue;

    const pctChange = ((ltp - pc) / pc) * 100;
    if (pctChange >= thresholdPct) {
      movers.push({
        symbol: sym,
        prevClose: pc,
        ltp,
        changePct: pctChange
      });
    }
  }

  movers.sort((a, b) => b.changePct - a.changePct);
  return movers;
}

// -----------------------------------------------------
// STEP 5. PUBLIC ENGINE ACTIONS
// -----------------------------------------------------
async function startEngine() {
  if (engineOn) {
    return { ok: true, msg: "already running" };
  }

  console.log("[M1] Starting engine...");

  universeSymbols = await loadUniverse();
  if (!universeSymbols.length) {
    lastError = "Universe load failed or empty";
    console.error("[M1] Universe empty, aborting start");
    return { ok: false, error: lastError };
  }

  currentBatchIndex = 0;
  await warmupPrevCloses(universeSymbols);
  await ensureSocketConnected();

  if (rotationIntervalHandle) clearInterval(rotationIntervalHandle);
  rotationIntervalHandle = setInterval(rotateBatch, 5000);

  if (heartbeatIntervalHandle) clearInterval(heartbeatIntervalHandle);
  heartbeatIntervalHandle = setInterval(() => {
    const now = Date.now();
    const ageSec = lastHeartbeatTs ? Math.round((now - lastHeartbeatTs) / 1000) : null;

    console.log(
      `[HEARTBEAT] engineOn=${engineOn} ltpMapSize=${ltpMap.size} prevCloseMapSize=${prevCloseMap.size} lastTickAgeSec=${ageSec ?? "n/a"} batch=${currentBatchIndex}`
    );
  }, 10000);

  if (autoStopTimeoutHandle) clearTimeout(autoStopTimeoutHandle);
  const nowSec = Math.floor(DateTime.now().setZone(IST).toSeconds());
  const msTillCutoff = Math.max(0, (todayCutoffTs() - nowSec) * 1000) + 5000;

  autoStopTimeoutHandle = setTimeout(() => {
    console.log("[M1] Auto cutoff reached. Stopping engine.");
    stopEngine();
  }, msTillCutoff);

  engineOn = true;
  console.log(`[M1] Engine started with ${universeSymbols.length} symbols, batch size ${BATCH_SIZE}`);
  return { ok: true, msg: `Engine started with ${universeSymbols.length} symbols` };
}

async function stopEngine() {
  console.log("[M1] Stopping engine...");
  engineOn = false;

  if (rotationIntervalHandle) clearInterval(rotationIntervalHandle);
  if (heartbeatIntervalHandle) clearInterval(heartbeatIntervalHandle);
  if (autoStopTimeoutHandle) clearTimeout(autoStopTimeoutHandle);

  if (socket) {
    try {
      socket.close();
    } catch {}
    socket = null;
  }

  console.log("[M1] Engine stopped.");
  return { ok: true, msg: "stopped" };
}

async function getMovers() {
  if (!engineOn) {
    return { ok: false, data: [], error: "engine off" };
  }

  const movers = computeMovers(5);
  for (const m of movers) {
    await M1Mover.findOneAndUpdate(
      { symbol: m.symbol },
      { ...m, capturedAt: new Date() },
      { upsert: true }
    );
  }

  return { ok: true, count: movers.length, data: movers };
}

function getStatus() {
  return {
    engineOn,
    beforeCutoff: isBeforeCutoff(),
    lastError,
    stats: {
      universeCount: universeSymbols.length,
      ltpCount: ltpMap.size,
      prevCloseCount: prevCloseMap.size,
      currentBatchIndex,
      batchSize: BATCH_SIZE,
      lastHeartbeatTs,
      lastSubscriptionRotateTs
    }
  };
}

module.exports = { startEngine, stopEngine, getMovers, getStatus };
