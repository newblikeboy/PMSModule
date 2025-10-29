"use strict";

const fs = require("fs").promises;
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

// ---------------------------
// Optimization / tuning
// ---------------------------
const PREV_CLOSE_CONCURRENCY = 10; // number of parallel history requests
const DB_UPSERT_CONCURRENCY = 10; // parallel savers for movers

// ---------------------------------
// small generic concurrency pool
// ---------------------------------
async function asyncPool(items, workerFn, concurrency = 5) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const p = (async () => workerFn(item))();
    results.push(p);
    executing.add(p);

    const cleanUp = () => executing.delete(p);
    p.then(cleanUp, cleanUp);

    if (executing.size >= concurrency) {
      // wait for any to finish
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// -----------------------------------------------------
// STEP 1. LOAD UNIVERSE (async, non-blocking)
// -----------------------------------------------------
async function loadUniverse() {
  try {
    const p = path.join(__dirname, "../nse_universe.json");
    const raw = await fs.readFile(p, "utf8");
    const arr = JSON.parse(raw || "[]");

    const seen = new Set();
    const clean = [];

    for (const rawItem of arr) {
      if (!rawItem && rawItem !== 0) continue;
      const s = String(rawItem).trim();
      if (!s) continue;

      const full = fy.toFyersSymbol ? fy.toFyersSymbol(s) : (s.startsWith("NSE:") ? s : `NSE:${s}-EQ`);
      if (full && !seen.has(full)) {
        seen.add(full);
        clean.push(full);
      }
    }

    return clean;
  } catch (err) {
    lastError = "[loadUniverse] " + (err && err.message ? err.message : String(err));
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

    // prefer the day-before-last; fallback to last
    const prev = candles[candles.length - 2] || candles[candles.length - 1];
    const prevClose = Number(prev[4]);

    if (!Number.isFinite(prevClose)) {
      throw new Error("prevClose NaN");
    }

    return prevClose;
  } catch (err) {
    // keep the symbol's failure isolated
    console.warn("[fetchPrevClose] Fail for", symbolFyersFormat, err?.message || err);
    lastError = err?.message || String(err);
    return null;
  }
}

async function warmupPrevCloses(symbols) {
  prevCloseMap.clear();
  const results = [];

  // worker to fetch and store
  async function worker(sym) {
    const pc = await fetchPrevClose(sym);
    if (pc != null) { // explicit null check (allows 0)
      prevCloseMap.set(sym, pc);
      return { symbol: sym, prevClose: pc };
    }
    return null;
  }

  const fetched = await asyncPool(symbols, worker, PREV_CLOSE_CONCURRENCY);

  for (const r of fetched) {
    if (r) results.push(r);
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
// keep these module-scope helpers/vars alongside your other state
let currentSubscribedBatch = [];
let isSubscribing = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 60 * 1000; // 1 minute cap

async function ensureSocketConnected() {
  // if socket already exists and appears connected, do nothing
  if (socket) return;

  try {
    const socketToken = await getSocketToken();
    socket = new fyersDataSocket(socketToken, "./");

    // reset reconnect attempts on a fresh instance
    reconnectAttempts = 0;

    socket.on("connect", () => {
      console.log("[Socket] Connected to Fyers Stream");
      lastHeartbeatTs = Date.now();
      // subscribe the current batch (safe-guarded inside subscribeCurrentBatch)
      subscribeCurrentBatch();

      // prefer SDK autoreconnect if available
      if (typeof socket.autoreconnect === "function") {
        try {
          socket.autoreconnect(10);
        } catch (e) {
          console.warn("[Socket] autoreconnect call failed:", e?.message || e);
        }
      }
    });

    socket.on("message", (msg) => {
      // normalize many shapes of payloads
      const data = Array.isArray(msg) ? msg : (msg?.d ?? msg?.data ?? msg);
      const arr = Array.isArray(data) ? data : [data];

      for (const t of arr) {
        // support multiple common alias fields
        const sym = t?.symbol ?? t?.s ?? t?.n ?? t?.nseSym;
        const ltpCandidate = t?.ltp ?? t?.c ?? t?.price ?? t?.v?.lp ?? t?.v?.last_price ?? t?.last_price;

        // if ltpCandidate is an object (some SDKs nest it), try to dig numeric
        let ltp = ltpCandidate;
        if (ltp && typeof ltp === "object") {
          // find first numeric property
          for (const k of Object.keys(ltp)) {
            const v = ltp[k];
            if (v != null && Number.isFinite(Number(v))) {
              ltp = Number(v);
              break;
            }
          }
        }

        if (!sym) continue;
        if (ltp == null) continue; // allow 0 but not null/undefined
        const num = Number(ltp);
        if (!Number.isFinite(num)) continue;

        ltpMap.set(sym, num);
      }

      lastHeartbeatTs = Date.now();
    });

    socket.on("error", (err) => {
      lastError = err?.message || String(err);
      console.error("[Socket Error]", err);
    });

    socket.on("close", (code, reason) => {
      console.warn("[Socket] Closed", code ?? "", reason ?? "");
      // clear the socket ref so ensureSocketConnected can recreate it
      socket = null;
      // reset current subscription tracking
      currentSubscribedBatch = [];
      isSubscribing = false;
      // schedule reconnect (only if SDK didn't already do autoreconnect)
      scheduleReconnect();
    });

    // actually open connection
    try {
      socket.connect();
    } catch (err) {
      console.error("[Socket] connect() threw:", err?.message || err);
      socket = null;
      scheduleReconnect();
    }
  } catch (err) {
    lastError = err?.message || String(err);
    console.error("[Socket] ensureSocketConnected error:", lastError);
    // schedule reconnect if token fetch failed
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  // do not flood reconnect attempts; use exponential backoff
  reconnectAttempts = Math.min(20, reconnectAttempts + 1);
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);

  console.log(`[Socket] scheduling reconnect attempt #${reconnectAttempts} in ${Math.round(delay / 1000)}s`);
  setTimeout(() => {
    // try to connect again
    ensureSocketConnected().catch(e => {
      console.error("[Socket] reconnect attempt failed:", e?.message || e);
      // schedule next attempt
      scheduleReconnect();
    });
  }, delay);
}

function subscribeCurrentBatch() {
  // guard: must have socket and universe symbols
  if (!socket) {
    // ensure a socket will be created if needed
    ensureSocketConnected().catch(e => console.error("[subscribeCurrentBatch] ensureSocketConnected error", e?.message || e));
    return;
  }
  if (!universeSymbols || universeSymbols.length === 0) return;

  // avoid re-entrant subscribe calls
  if (isSubscribing) return;
  isSubscribing = true;

  try {
    const start = currentBatchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, universeSymbols.length);
    const batch = universeSymbols.slice(start, end);

    if (!batch.length) return;

    // if we previously subscribed a different batch, try to unsubscribe it first
    const prev = currentSubscribedBatch;
    if (prev && prev.length) {
      try {
        // some SDKs support unsubscribe; ignore errors if not supported
        if (typeof socket.unsubscribe === "function") {
          socket.unsubscribe(prev);
          console.log(`[Socket] Unsubscribed previous batch (${prev.length} symbols)`);
        }
      } catch (uerr) {
        console.warn("[Socket] unsubscribe failed, continuing:", uerr?.message || uerr);
      }
    }

    // perform subscription
    try {
      socket.subscribe(batch, "lite");
      currentSubscribedBatch = batch;
      lastSubscriptionRotateTs = Date.now();
      console.log(`[Socket] Subscribed batch ${currentBatchIndex} (${batch.length} symbols)`);
    } catch (err) {
      lastError = err?.message || String(err);
      console.error("[subscribeCurrentBatch] subscribe error", err);
    }
  } finally {
    // unlock subscribing flag after a tick to avoid blocking rotateBatch from scheduling later.
    setImmediate(() => { isSubscribing = false; });
  }
}

function rotateBatch() {
  // safety guards
  if (!universeSymbols || universeSymbols.length === 0) return;
  // if socket absent, attempt to create it and skip rotation now
  if (!socket) {
    ensureSocketConnected().catch(e => console.error("[rotateBatch] ensureSocketConnected error", e?.message || e));
    return;
  }

  // increment index and wrap
  currentBatchIndex++;
  if (currentBatchIndex * BATCH_SIZE >= universeSymbols.length) {
    currentBatchIndex = 0;
  }

  // subscribe to the new batch (subscribeCurrentBatch is guarded)
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

    // explicit null/undefined checks so 0 values are allowed
    if (pc == null || ltp == null) continue;
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
    } catch (e) {
      // ignore close errors
    }
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

  // upsert movers in controlled parallelism
  await asyncPool(
    movers,
    async (m) => {
      try {
        await M1Mover.findOneAndUpdate(
          { symbol: m.symbol },
          { ...m, capturedAt: new Date() },
          { upsert: true }
        );
      } catch (err) {
        console.warn("[getMovers] DB upsert fail for", m.symbol, err?.message || err);
        lastError = err?.message || String(err);
      }
    },
    DB_UPSERT_CONCURRENCY
  );

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
