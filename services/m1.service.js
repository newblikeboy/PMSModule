"use strict";

const fs = require("fs").promises;
const path = require("path");
const { DateTime } = require("luxon");
const { fyersDataSocket } = require("fyers-api-v3");

const fy = require("./fyersSdk"); // market data + history
const { getSocketToken } = require("./fyersAuth");
const { todayCutoffTs, isBeforeCutoff, IST } = require("../utils/time");
const M1Mover = require("../models/M1Mover");
const { env } = require("../config/env");

// ---------------------------
// Config (tune via env)
 // default values chosen conservatively for production stability
const CONFIG = {
  BATCH_SIZE: Number(env.M1_BATCH_SIZE) || 200,
  PREV_CLOSE_CONCURRENCY: Number(env.M1_PREV_CLOSE_CONCURRENCY) || 12,
  DB_UPSERT_CONCURRENCY: Number(env.M1_DB_UPSERT_CONCURRENCY) || 12,
  ROTATE_INTERVAL_MS: Number(env.M1_ROTATE_INTERVAL_MS) || 5000,
  HEARTBEAT_INTERVAL_MS: Number(env.M1_HEARTBEAT_INTERVAL_MS) || 10000,
  PREV_CLOSE_RETRY: Number(env.M1_PREV_CLOSE_RETRY) || 3,
  PREV_CLOSE_RETRY_BASE_MS: Number(env.M1_PREV_CLOSE_RETRY_BASE_MS) || 500,
  MOVER_THRESHOLD_PCT: Number(env.M1_MOVER_THRESHOLD_PCT) || 5,
  SNAPSHOT_HOUR: Number(env.M1_SNAPSHOT_HOUR) || 10,
  SNAPSHOT_MINUTE: Number(env.M1_SNAPSHOT_MINUTE) || 30,
  SOCKET_TOKEN_MIN_LENGTH: 20 // quick sanity
};

// convenience aliases
const BATCH_SIZE = CONFIG.BATCH_SIZE;
const PREV_CLOSE_CONCURRENCY = CONFIG.PREV_CLOSE_CONCURRENCY;
const DB_UPSERT_CONCURRENCY = CONFIG.DB_UPSERT_CONCURRENCY;
const MOVER_THRESHOLD_PCT = CONFIG.MOVER_THRESHOLD_PCT;

// ---------------------------
// Internal engine state
// ---------------------------
let engineOn = false;
let socket = null;
let universeSymbols = []; // canonical fyers symbols (strings)
let currentBatchIndex = 0;

const prevCloseMap = new Map(); // symbol -> prevClose
const ltpMap = new Map(); // symbol -> latest ltp (number)

let lastError = null;
let lastHeartbeatTs = null;
let lastSubscriptionRotateTs = null;

let rotationIntervalHandle = null;
let heartbeatIntervalHandle = null;
let autoStopTimeoutHandle = null;
let snapshotTimeoutHandle = null;
let snapshotCapturedAt = null;
let snapshotDateKey = null;

// socket helpers / guards
let currentSubscribedBatch = [];
let isSubscribing = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 60 * 1000; // 1 minute cap
const MIN_ROTATE_MS = 1500;
let lastRotateTs = 0;

// compact tick logging
let _compactTickBuffer = [];
let _compactLastFlushTs = 0;
const COMPACT_FLUSH_MS = 900;

// ---------------------------
// ALERT / DEDUPE
// ---------------------------
const ALERT_THRESHOLD_PCT = Number(env.M1_ALERT_THRESHOLD_PCT) || 5; // percent threshold
const lastAlertPct = new Map(); // symbol -> last alerted pct (number)

// ---------------------------
// Utility: small concurrency pool
// ---------------------------
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
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ---------------------------
// Utility: sleep & backoff
// ---------------------------
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function backoffDelay(baseMs, attempt) {
  // jittered exponential backoff
  const jitter = Math.random() * baseMs;
  return Math.min(MAX_RECONNECT_DELAY_MS, Math.round(baseMs * Math.pow(2, attempt - 1) + jitter));
}

function todayDateKey() {
  return DateTime.now().setZone(IST).toISODate();
}

function todayRangeIst() {
  const now = DateTime.now().setZone(IST);
  return {
    start: now.startOf("day").toJSDate(),
    end: now.endOf("day").toJSDate()
  };
}

// ---------------------------
// STEP 1. LOAD UNIVERSE
// ---------------------------
// Normalizes duplicates, uses fy.toFyersSymbol if available
async function loadUniverse() {
  try {
    const p = path.join(__dirname, "../nse_universe.json");
    const raw = await fs.readFile(p, "utf8");
    const arr = JSON.parse(raw || "[]");

    const seen = new Set();
    const clean = [];

    for (const rawItem of arr) {
      if (rawItem === undefined || rawItem === null) continue;
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
    lastError = `[loadUniverse] ${err?.message ?? String(err)}`;
    console.error(lastError);
    return [];
  }
}

// ---------------------------
// STEP 2. FETCH PREV CLOSE
// ---------------------------
// robust: retries with backoff, isolated errors per symbol
async function fetchPrevClose(symbolFyersFormat) {
  for (let attempt = 1; attempt <= CONFIG.PREV_CLOSE_RETRY; attempt++) {
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

      const candles = resp?.candles || resp?.data || [];
      if (!Array.isArray(candles) || candles.length < 1) {
        throw new Error("no historical candles");
      }

      const prev = candles[candles.length - 2] || candles[candles.length - 1];
      const prevClose = Number(prev[4]);

      if (!Number.isFinite(prevClose)) {
        throw new Error("prevClose NaN");
      }

      return prevClose;
    } catch (err) {
      const msg = err?.message ?? String(err);
      console.warn(`[fetchPrevClose] ${symbolFyersFormat} attempt ${attempt} failed: ${msg}`);
      lastError = msg;
      if (attempt < CONFIG.PREV_CLOSE_RETRY) {
        const d = backoffDelay(CONFIG.PREV_CLOSE_RETRY_BASE_MS, attempt);
        await sleep(d);
      }
    }
  }
  // final failure
  return null;
}

async function warmupPrevCloses(symbols) {
  prevCloseMap.clear();
  const results = [];

  async function worker(sym) {
    const pc = await fetchPrevClose(sym);
    if (pc != null) {
      prevCloseMap.set(sym, pc);
      return { symbol: sym, prevClose: pc };
    }
    return null;
  }

  // run with controlled concurrency
  const fetched = await asyncPool(symbols, worker, PREV_CLOSE_CONCURRENCY);

  for (const r of fetched) if (r) results.push(r);

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

// ---------------------------
// STEP 3. SOCKET MANAGEMENT
// ---------------------------
// Helpers for compact terminal prints
function _flushCompactTicksIfNeeded(force = false) {
  const now = Date.now();
  if (force || now - _compactLastFlushTs >= COMPACT_FLUSH_MS) {
    if (_compactTickBuffer.length > 0) {
      const line = _compactTickBuffer.join("   ");
      try {
        process.stdout.write(line + "\n");
      } catch (e) {
        console.log(line);
      }
      _compactTickBuffer = [];
    }
    _compactLastFlushTs = now;
  }
}

async function ensureSocketConnected() {
  if (socket) return;

  try {
    const socketToken = await getSocketToken();
    if (!socketToken || String(socketToken).indexOf(":") === -1 || String(socketToken).length < CONFIG.SOCKET_TOKEN_MIN_LENGTH) {
      lastError = "socket token invalid or not in <APP_ID>:<ACCESS_TOKEN> format";
      console.warn("[Socket] " + lastError);
      // still attempt to connect — getSocketToken should be fixed in that case
    }

    socket = new fyersDataSocket(socketToken);

    reconnectAttempts = 0;

    socket.on("connect", () => {
      console.log("[Socket] Connected to Fyers Stream");
      lastHeartbeatTs = Date.now();
      // subscribe current batch (idempotent)
      subscribeCurrentBatch();

      if (typeof socket.autoreconnect === "function") {
        try { socket.autoreconnect(); } catch (e) { console.warn("[Socket] autoreconnect failed:", e?.message || e); }
      }
    });

    socket.on("message", (msg) => {
      // Normalize payload
      const data = Array.isArray(msg) ? msg : (msg?.d ?? msg?.data ?? msg);
      const arr = Array.isArray(data) ? data : [data];

      const parsedForPrint = [];

      for (const t of arr) {
        const sym = t?.symbol ?? t?.s ?? t?.n ?? t?.nseSym;
        const ltpCandidate = t?.ltp ?? t?.c ?? t?.price ?? t?.v?.lp ?? t?.v?.last_price ?? t?.last_price;

        let ltp = ltpCandidate;
        if (ltp && typeof ltp === "object") {
          for (const k of Object.keys(ltp)) {
            const v = ltp[k];
            if (v != null && Number.isFinite(Number(v))) {
              ltp = Number(v);
              break;
            }
          }
        }

        if (!sym) continue;
        if (ltp == null) continue;
        const num = Number(ltp);
        if (!Number.isFinite(num)) continue;

        // update map
        try {
          ltpMap.set(sym, num);
        } catch (e) {
          // ignore if map unavailable
        }

        // --- ALERT: check against prevClose and log if >= ALERT_THRESHOLD_PCT ---
        try {
          const pc = prevCloseMap.get(sym);
          if (pc != null && Number.isFinite(pc) && pc > 0) {
            const changePct = ((num - pc) / pc) * 100;
            if (changePct >= ALERT_THRESHOLD_PCT) {
              const prevAlert = lastAlertPct.get(sym) ?? -Infinity;
              if (changePct >= prevAlert + 0.1) {
                let alertSym = String(sym);
                if (alertSym.startsWith("NSE:")) alertSym = alertSym.slice(4);
                if (alertSym.endsWith("-EQ")) alertSym = alertSym.slice(0, -3);
                const pctStr = changePct.toFixed(2);
                const priceStr = Number.isInteger(num) ? String(num) : num.toFixed(2);
                console.log(`[ALERT] ${alertSym} is up ${pctStr}% (LTP ${priceStr}, prevClose ${pc})`);
                lastAlertPct.set(sym, changePct);
              }
            }
          }
        } catch (e) {
          console.warn("[M1] alert check error for", sym, e?.message || e);
        }

        // pretty symbol
        let prettySym = String(sym);
        if (prettySym.startsWith("NSE:")) prettySym = prettySym.slice(4);
        if (prettySym.endsWith("-EQ")) prettySym = prettySym.slice(0, -3);
        const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2);

        parsedForPrint.push(`${prettySym} → ${formatted}`);
      }

      if (parsedForPrint.length) {
        _compactTickBuffer.push(...parsedForPrint);
      }
      _flushCompactTicksIfNeeded();

      lastHeartbeatTs = Date.now();
    });

    socket.on("error", (err) => {
      lastError = err?.message || String(err);
      console.error("[Socket Error]", err);
    });

    socket.on("close", (code, reason) => {
      console.warn("[Socket] Closed", code ?? "", reason ?? "");
      socket = null;
      currentSubscribedBatch = [];
      isSubscribing = false;
      _flushCompactTicksIfNeeded(true);
      scheduleReconnect();
    });

    // open
    try {
      if (typeof socket.connect === "function") socket.connect();
      else if (typeof socket.open === "function") socket.open();
      else console.warn("[Socket] no connect/open method on socket instance");
    } catch (err) {
      console.error("[Socket] connect threw:", err?.message || err);
      socket = null;
      scheduleReconnect();
    }
  } catch (err) {
    lastError = err?.message || String(err);
    console.error("[Socket] ensureSocketConnected error:", lastError);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  reconnectAttempts = Math.min(20, reconnectAttempts + 1);
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);

  console.log(`[Socket] scheduling reconnect attempt #${reconnectAttempts} in ${Math.round(delay/1000)}s`);
  setTimeout(() => {
    ensureSocketConnected().catch(e => {
      console.error("[Socket] reconnect attempt failed:", e?.message || e);
      scheduleReconnect();
    });
  }, delay);
}

function subscribeCurrentBatch() {
  if (!socket) {
    ensureSocketConnected().catch(e => console.error("[subscribeCurrentBatch] ensureSocketConnected error", e?.message || e));
    return;
  }
  if (!Array.isArray(universeSymbols) || universeSymbols.length === 0) return;
  if (isSubscribing) return;
  isSubscribing = true;

  try {
    const start = currentBatchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, universeSymbols.length);
    const batch = universeSymbols.slice(start, end);
    if (!batch.length) return;

    // avoid subscribing identical batch twice
    const sameBatch = currentSubscribedBatch.length === batch.length
      && currentSubscribedBatch.every((v, i) => v === batch[i]);
    if (sameBatch) {
      // still refresh lite mode if available
      if (typeof socket.mode === "function" && socket.LiteMode != null) {
        try { socket.mode(socket.LiteMode); } catch (_) {}
      }
      isSubscribing = false;
      return;
    }

    // unsubscribe previous batch if supported
    const prev = currentSubscribedBatch;
    if (prev && prev.length && typeof socket.unsubscribe === "function") {
      try { socket.unsubscribe(prev); } catch (uerr) { console.warn("[Socket] unsubscribe failed:", uerr?.message || uerr); }
    }

    // set lite mode and subscribe
    try {
      if (typeof socket.mode === "function" && socket.LiteMode != null) {
        try { socket.mode(socket.LiteMode); } catch (_) {}
      }
      socket.subscribe(batch);
      if (typeof socket.mode === "function" && socket.LiteMode != null) {
        try { socket.mode(socket.LiteMode); } catch (_) {}
      }
      if (typeof socket.autoreconnect === "function") {
        try { socket.autoreconnect(); } catch (_) {}
      }

      currentSubscribedBatch = batch;
      lastSubscriptionRotateTs = Date.now();
      console.log(`[Socket] Subscribed batch ${currentBatchIndex} (${batch.length} symbols) in LiteMode`);
    } catch (err) {
      lastError = err?.message || String(err);
      console.error("[subscribeCurrentBatch] subscribe error", err);
    }
  } finally {
    setImmediate(() => { isSubscribing = false; });
  }
}

function rotateBatch() {
  const now = Date.now();
  if (now - lastRotateTs < MIN_ROTATE_MS) return;
  lastRotateTs = now;

  if (!Array.isArray(universeSymbols) || universeSymbols.length === 0) return;
  if (!socket) {
    ensureSocketConnected().catch(e => console.error("[rotateBatch] ensureSocketConnected error", e?.message || e));
    return;
  }

  const totalBatches = Math.max(1, Math.ceil(universeSymbols.length / BATCH_SIZE));
  const prevIndex = currentBatchIndex;
  currentBatchIndex = (currentBatchIndex + 1) % totalBatches;
  if (currentBatchIndex === prevIndex) return;

  try {
    subscribeCurrentBatch();
  } catch (err) {
    console.error("[rotateBatch] subscribeCurrentBatch threw:", err?.message || err);
  }
}

// ---------------------------
// STEP 4. MOVER CALCULATION
// ---------------------------
function computeMovers(thresholdPct = MOVER_THRESHOLD_PCT) {
  const movers = [];

  for (const sym of universeSymbols) {
    const pc = prevCloseMap.get(sym);
    const ltp = ltpMap.get(sym);

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

async function captureMoversSnapshot({ reason = "scheduled", force = false } = {}) {
  const dateKey = todayDateKey();
  const range = todayRangeIst();

  if (!force && isBeforeCutoff()) {
    return { ok: false, data: [], error: "Snapshot available only after 10:30 IST" };
  }

  if (!force && snapshotDateKey === dateKey && snapshotCapturedAt) {
    const existing = await M1Mover.find({
      capturedAt: { $gte: range.start, $lte: range.end }
    })
      .sort({ changePct: -1 })
      .lean();
    return { ok: true, alreadyCaptured: true, count: existing.length, data: existing };
  }

  try {
    const movers = computeMovers(MOVER_THRESHOLD_PCT);
    const now = new Date();
    const { start, end } = range;

    await M1Mover.deleteMany({ capturedAt: { $gte: start, $lte: end } });

    if (movers.length > 0) {
      const docs = movers.map((m) => ({
        symbol: m.symbol,
        prevClose: m.prevClose,
        ltp: m.ltp,
        changePct: m.changePct,
        capturedAt: now
      }));
      await M1Mover.insertMany(docs, { ordered: false });
      snapshotCapturedAt = Date.now();
      snapshotDateKey = dateKey;
      console.log(`[M1] Movers snapshot captured (${movers.length} symbols, reason=${reason})`);
      return { ok: true, count: docs.length, data: docs };
    }

    snapshotCapturedAt = Date.now();
    snapshotDateKey = dateKey;
    console.log(`[M1] Movers snapshot captured (0 symbols, reason=${reason})`);
    return { ok: true, count: 0, data: [] };
  } catch (err) {
    lastError = err?.message || String(err);
    console.error("[M1] captureMoversSnapshot error:", err?.message || err);
    throw err;
  }
}

function scheduleMoverSnapshot() {
  if (snapshotTimeoutHandle) {
    clearTimeout(snapshotTimeoutHandle);
    snapshotTimeoutHandle = null;
  }

  const now = DateTime.now().setZone(IST);
  const target = now.set({
    hour: CONFIG.SNAPSHOT_HOUR,
    minute: CONFIG.SNAPSHOT_MINUTE,
    second: 0,
    millisecond: 0
  });

  const delayMs = target.diff(now, "milliseconds").milliseconds;

  if (delayMs <= 0) {
    captureMoversSnapshot({ reason: "post-start immediate" }).catch((err) => {
      lastError = err?.message || String(err);
      console.error("[M1] immediate snapshot failed:", err?.message || err);
    });
    return;
  }

  snapshotTimeoutHandle = setTimeout(() => {
    snapshotTimeoutHandle = null;
    captureMoversSnapshot({ reason: "scheduled" }).catch((err) => {
      lastError = err?.message || String(err);
      console.error("[M1] scheduled snapshot failed:", err?.message || err);
    });
  }, delayMs);
}

// ---------------------------
// STEP 5. PUBLIC ENGINE ACTIONS
// ---------------------------
async function startEngine() {
  if (engineOn) return { ok: true, msg: "already running" };

  console.log("[M1] Starting engine...");

  // load universe
  universeSymbols = await loadUniverse();
  if (!universeSymbols.length) {
    lastError = "Universe load failed or empty";
    console.error("[M1] Universe empty, aborting start");
    return { ok: false, error: lastError };
  }

  currentBatchIndex = 0;

  // warmup prev closes (only symbols present)
  await warmupPrevCloses(universeSymbols);

  snapshotCapturedAt = null;
  snapshotDateKey = null;

  // connect socket
  await ensureSocketConnected();

  scheduleMoverSnapshot();

  // rotation interval
  if (rotationIntervalHandle) clearInterval(rotationIntervalHandle);
  rotationIntervalHandle = setInterval(rotateBatch, CONFIG.ROTATE_INTERVAL_MS);

  // heartbeat log
  if (heartbeatIntervalHandle) clearInterval(heartbeatIntervalHandle);
  heartbeatIntervalHandle = setInterval(() => {
    const now = Date.now();
    const ageSec = lastHeartbeatTs ? Math.round((now - lastHeartbeatTs) / 1000) : null;
    console.log(
      `[HEARTBEAT] engineOn=${engineOn} ltpMapSize=${ltpMap.size} prevCloseMapSize=${prevCloseMap.size} lastTickAgeSec=${ageSec ?? "n/a"} batch=${currentBatchIndex}`
    );
  }, CONFIG.HEARTBEAT_INTERVAL_MS);

  // auto-stop before market cutoff
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

  if (rotationIntervalHandle) {
    clearInterval(rotationIntervalHandle);
    rotationIntervalHandle = null;
  }
  if (heartbeatIntervalHandle) {
    clearInterval(heartbeatIntervalHandle);
    heartbeatIntervalHandle = null;
  }
  if (autoStopTimeoutHandle) {
    clearTimeout(autoStopTimeoutHandle);
    autoStopTimeoutHandle = null;
  }
  if (snapshotTimeoutHandle) {
    clearTimeout(snapshotTimeoutHandle);
    snapshotTimeoutHandle = null;
  }

  if (socket) {
    try {
      if (typeof socket.close === "function") socket.close();
    } catch (e) {
      // ignore
    }
    socket = null;
  }

  prevCloseMap.clear();
  // intentionally keep ltpMap for inspection after stop
  console.log("[M1] Engine stopped.");
  return { ok: true, msg: "stopped" };
}

async function getMovers({ refresh = false } = {}) {
  const range = todayRangeIst();
  const query = { capturedAt: { $gte: range.start, $lte: range.end } };

  if (!refresh) {
    const existing = await M1Mover.find(query).sort({ changePct: -1 }).lean();
    if (existing.length > 0) {
      return { ok: true, count: existing.length, data: existing };
    }
    if (isBeforeCutoff()) {
      return { ok: false, data: [], error: "Movers snapshot available after 10:30 IST" };
    }
  } else if (refresh && isBeforeCutoff()) {
    return { ok: false, data: [], error: "Cannot refresh movers before 10:30 IST" };
  }

  try {
    const captureRes = await captureMoversSnapshot({
      reason: refresh ? "manual-refresh" : "on-demand",
      force: refresh
    });

    if (captureRes.ok && Array.isArray(captureRes.data)) {
      return { ok: true, count: captureRes.data.length, data: captureRes.data };
    }

    if (!captureRes.ok) {
      return { ok: false, data: [], error: captureRes.error || "Snapshot unavailable" };
    }
  } catch (err) {
    lastError = err?.message || String(err);
    return { ok: false, data: [], error: lastError };
  }

  const latest = await M1Mover.find(query).sort({ changePct: -1 }).lean();
  return { ok: true, count: latest.length, data: latest };
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

// ---------------------------
// Utility exports for admin/UI
// ---------------------------
function _getLtpSnapshot() {
  try {
    return Array.from(ltpMap.entries()).map(([symbol, ltp]) => ({ symbol, ltp: Number(ltp), ts: Date.now() }));
  } catch (err) {
    console.error("[m1._getLtpSnapshot] error:", err?.message || err);
    return [];
  }
}

function _getUniverse() {
  return Array.from(universeSymbols);
}

// ---------------------------
// Graceful shutdown handlers
// ---------------------------
function _setupShutdown() {
  // only set once
  if (process._m1ShutdownHook) return;
  process._m1ShutdownHook = true;

  const shutdown = async () => {
    try {
      console.log("[M1] shutdown signal received - stopping engine...");
      await stopEngine();
      // give a moment for socket close logs to flush
      setTimeout(() => process.exit(0), 500);
    } catch (err) {
      console.error("[M1] shutdown error:", err?.message || err);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

_setupShutdown();

// ---------------------------
// Module exports
// ---------------------------
module.exports = {
  startEngine,
  stopEngine,
  getMovers,
  getStatus,
  // debug / admin helpers
  _getLtpSnapshot,
  _getUniverse,
  captureMoversSnapshot
};
