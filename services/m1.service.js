"use strict";

const fs = require("fs").promises;
const path = require("path");
const { DateTime } = require("luxon");
const { fyersDataSocket } = require("fyers-api-v3");

const fy = require("./fyersSdk");
const { getSocketToken } = require("./fyersAuth");
const { todayCutoffTs, isBeforeCutoff, IST } = require("../utils/time");
const M1Mover = require("../models/M1Mover");

/* ======================= Config ======================= */
// Conservative defaults for production stability
const CONFIG = Object.freeze({
  BATCH_SIZE: Number(process.env.M1_BATCH_SIZE) || 200,
  PREV_CLOSE_CONCURRENCY: Number(process.env.M1_PREV_CLOSE_CONCURRENCY) || 12,
  DB_UPSERT_CONCURRENCY: Number(process.env.M1_DB_UPSERT_CONCURRENCY) || 12,
  ROTATE_INTERVAL_MS: Number(process.env.M1_ROTATE_INTERVAL_MS) || 5000,
  HEARTBEAT_INTERVAL_MS: Number(process.env.M1_HEARTBEAT_INTERVAL_MS) || 10000,
  PREV_CLOSE_RETRY: Number(process.env.M1_PREV_CLOSE_RETRY) || 3,
  PREV_CLOSE_RETRY_BASE_MS: Number(process.env.M1_PREV_CLOSE_RETRY_BASE_MS) || 500,
  QUOTE_BATCH_SIZE:
    Number(
      process.env.M1_QUOTE_BATCH_SIZE ??
      process.env.M1_PREV_CLOSE_QUOTE_BATCH
    ) || 40,
  QUOTE_BATCH_DELAY_MS:
    Number(
      process.env.M1_QUOTE_BATCH_DELAY_MS ??
      process.env.M1_PREV_CLOSE_QUOTE_DELAY_MS
    ) || 120,
  BOOTSTRAP_RUN_AT: process.env.M1_BOOTSTRAP_RUN_AT || "10:28",
  BOOTSTRAP_MAX_WAIT_MS: Number(process.env.M1_BOOTSTRAP_MAX_WAIT_MS) || 120_000,
  MAX_MINUTE_CANDLES: Number(process.env.M1_MAX_MINUTE_CANDLES) || 240,
  SOCKET_TOKEN_MIN_LENGTH: 20,
  ALERT_THRESHOLD_PCT: Number(process.env.M1_ALERT_THRESHOLD_PCT) || 5,
  MAX_RECONNECT_DELAY_MS: 60_000,
  MIN_ROTATE_MS: 1500,
  COMPACT_FLUSH_MS: 900,
});

const {
  BATCH_SIZE,
  PREV_CLOSE_CONCURRENCY,
  DB_UPSERT_CONCURRENCY,
  MAX_RECONNECT_DELAY_MS,
  MIN_ROTATE_MS,
  COMPACT_FLUSH_MS,
  QUOTE_BATCH_SIZE,
  QUOTE_BATCH_DELAY_MS,
  BOOTSTRAP_RUN_AT,
  BOOTSTRAP_MAX_WAIT_MS,
  MAX_MINUTE_CANDLES,
} = CONFIG;

/* ======================= State ======================= */
let engineOn = false;
let socket = null;
let universeSymbols = []; // canonical Fyers symbols
let currentBatchIndex = 0;

const prevCloseMap = new Map(); // symbol -> prevClose
const ltpMap = new Map();       // symbol -> latest LTP
const minuteSeries = new Map(); // symbol -> { candles: [...], lastBucketTs }

let lastError = null;
let lastHeartbeatTs = null;
let lastSubscriptionRotateTs = null;

let rotationIntervalHandle = null;
let heartbeatIntervalHandle = null;
let autoStopTimeoutHandle = null;

let currentSubscribedBatch = [];
let isSubscribing = false;

let reconnectAttempts = 0;
let reconnectTimer = null;

let lastRotateTs = 0;

/* compact tick logging */
let compactTickBuffer = [];
let lastCompactFlushTs = 0;

/* alert/dedupe */
const lastAlertPct = new Map(); // symbol -> last alerted pct

/* one-time shutdown hook */
let shutdownHookInstalled = false;

/* ======================= Utils ======================= */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const jitter = (base) => base * (0.75 + Math.random() * 0.5);
const backoffDelay = (baseMs, attempt) =>
  clamp(Math.round(jitter(baseMs * 2 ** (attempt - 1))), baseMs, MAX_RECONNECT_DELAY_MS);

const prettySymbol = (s) => {
  let v = String(s || "");
  if (v.startsWith("NSE:")) v = v.slice(4);
  if (v.endsWith("-EQ")) v = v.slice(0, -3);
  return v;
};

const percentChange = (from, to) => ((to - from) / from) * 100;
const toNumber = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
};

function parseBootstrapTime(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

async function waitUntilBootstrapTimeIfNeeded() {
  const target = parseBootstrapTime(BOOTSTRAP_RUN_AT);
  if (!target) return;

  const now = DateTime.now().setZone(IST);
  let targetDt = now.set({
    hour: target.hour,
    minute: target.minute,
    second: 0,
    millisecond: 0,
  });

  if (now >= targetDt) return;

  const diffMs = targetDt.toMillis() - now.toMillis();
  if (diffMs <= 0) return;

  if (diffMs > BOOTSTRAP_MAX_WAIT_MS) {
    const minsAway = Math.round(diffMs / 60000);
    console.log(
      `[M1] Bootstrap target ${BOOTSTRAP_RUN_AT} IST is ${minsAway}m away. Run start closer to the target or increase M1_BOOTSTRAP_MAX_WAIT_MS. Proceeding immediately.`
    );
    return;
  }

  const mins = Math.floor(diffMs / 60000);
  const secs = Math.round((diffMs % 60000) / 1000);
  console.log(`[M1] Waiting ${mins}m ${secs}s for bootstrap window ${BOOTSTRAP_RUN_AT} IST before scanning quotes.`);
  await sleep(diffMs);
}

function minuteBucket(tsMs) {
  if (!Number.isFinite(tsMs)) tsMs = Date.now();
  return Math.floor(tsMs / 60_000) * 60_000;
}

function ensureMinuteSeries(symbol) {
  let entry = minuteSeries.get(symbol);
  if (!entry) {
    entry = { candles: [], lastBucketTs: null };
    minuteSeries.set(symbol, entry);
  }
  return entry;
}

function updateMinuteSeries(symbol, price, tsMs = Date.now()) {
  if (!symbol || !Number.isFinite(price)) return;
  const bucketTs = minuteBucket(tsMs);
  const entry = ensureMinuteSeries(symbol);

  let candle = entry.candles[entry.candles.length - 1];
  if (!candle || candle.ts !== bucketTs) {
    candle = { ts: bucketTs, o: price, h: price, l: price, c: price, v: 1 };
    entry.candles.push(candle);
    entry.lastBucketTs = bucketTs;
    if (entry.candles.length > MAX_MINUTE_CANDLES) {
      entry.candles.splice(0, entry.candles.length - MAX_MINUTE_CANDLES);
    }
  } else {
    candle.h = Math.max(candle.h, price);
    candle.l = Math.min(candle.l, price);
    candle.c = price;
    candle.v += 1;
  }
}

function seedMinuteSeries(symbol, price, tsMs = Date.now()) {
  if (!symbol || !Number.isFinite(price)) return;
  const entry = ensureMinuteSeries(symbol);
  if (!entry.candles.length) {
    updateMinuteSeries(symbol, price, tsMs);
  }
}

function getMinuteCandles(symbol, limit = 60) {
  if (!symbol) return [];
  const entry = minuteSeries.get(symbol);
  if (!entry || !entry.candles.length) return [];
  if (!limit || limit >= entry.candles.length) {
    return entry.candles.slice();
  }
  return entry.candles.slice(entry.candles.length - limit);
}

function extractTickTimestamp(payload) {
  if (!payload || typeof payload !== "object") return Date.now();
  const nested = payload.v || payload.V || {};
  const raw =
    payload.timestamp ??
    payload.ts ??
    payload.tt ??
    payload.t ??
    payload.time ??
    payload.exch_time ??
    payload.exchange_time ??
    nested.tt ??
    nested.timestamp ??
    null;

  if (raw == null) return Date.now();
  let num = Number(raw);
  if (!Number.isFinite(num)) return Date.now();
  if (num > 1e12) return num;
  if (num > 1e9) return num * 1000;
  return num * 1000;
}

/** Small, stable concurrency pool */
async function asyncPool(items, workerFn, concurrency = 5) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (concurrency < 1) concurrency = 1;

  const ret = new Array(items.length);
  let i = 0;
  const executing = new Set();

  async function enqueue() {
    if (i >= items.length) return;
    const curIndex = i++;
    const p = Promise.resolve()
      .then(() => workerFn(items[curIndex], curIndex))
      .then((v) => (ret[curIndex] = v))
      .catch((e) => {
        ret[curIndex] = undefined;
        // swallow; individual worker logs/handles
      })
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

/* compact console line printer */
function flushCompactTicks(force = false) {
  const now = Date.now();
  if (!force && now - lastCompactFlushTs < COMPACT_FLUSH_MS) return;
  if (compactTickBuffer.length > 0) {
    const line = compactTickBuffer.join("   ");
    try {
      process.stdout.write(line + "\n");
    } catch {
      console.log(line);
    }
    compactTickBuffer = [];
  }
  lastCompactFlushTs = now;
}

/* ======================= Universe ======================= */
async function loadUniverse() {
  try {
    const p = path.join(__dirname, "../nse_universe.json");
    const raw = await fs.readFile(p, "utf8");
    const arr = JSON.parse(raw || "[]");

    const seen = new Set();
    const clean = [];

    for (const rawItem of arr) {
      if (rawItem == null) continue;
      const s = String(rawItem).trim();
      if (!s) continue;
      const fySym = fy.toFyersSymbol ? fy.toFyersSymbol(s) : (s.startsWith("NSE:") ? s : `NSE:${s}-EQ`);
      if (fySym && !seen.has(fySym)) {
        seen.add(fySym);
        clean.push(fySym);
      }
    }
    return clean;
  } catch (err) {
    lastError = `[loadUniverse] ${err?.message ?? String(err)}`;
    console.error(lastError);
    return [];
  }
}

/* ======================= Prev Close / Quote Snapshots ======================= */
function extractPrevCloseFromQuote(rawQuote = {}) {
  if (!rawQuote || typeof rawQuote !== "object") return null;
  const nested = rawQuote.v || rawQuote.V || rawQuote.quote || rawQuote.q || {};
  const candidates = [
    rawQuote.prev_close_price,
    rawQuote.prevClosePrice,
    rawQuote.prevClose,
    rawQuote.prev_price,
    rawQuote.prevPrice,
    rawQuote.previous_close_price,
    rawQuote.pc,
    rawQuote.c,
    rawQuote.close,
    nested.prev_close_price,
    nested.prevPrice,
    nested.prev_price,
    nested.prevClose,
    nested.pc,
  ];

  for (const candidate of candidates) {
    const num = toNumber(candidate);
    if (num != null && num > 0) return num;
  }
  return null;
}

function canonicalSymbolFromQuote(rawQuote = {}, fallback) {
  const rawSymbol =
    rawQuote.symbol ||
    rawQuote.code ||
    rawQuote.s ||
    rawQuote.n ||
    fallback;
  if (!rawSymbol) return null;
  if (typeof fy.toFyersSymbol === "function") {
    return fy.toFyersSymbol(rawSymbol);
  }
  const s = String(rawSymbol).trim();
  if (!s) return null;
  if (/^NSE:/i.test(s)) return s;
  return `NSE:${s.replace(/-EQ$/i, "")}-EQ`;
}

function extractChangePercentFromQuote(rawQuote = {}, fallback) {
  const nested = rawQuote.v || rawQuote.V || rawQuote.quote || rawQuote.q || {};
  const candidates = [
    rawQuote.chp,
    rawQuote.chgPct,
    rawQuote.changePercent,
    rawQuote.pChange,
    rawQuote.perChange,
    nested.chp,
    nested.chgPct,
    nested.changePercent,
    nested.pChange,
    fallback
  ];
  for (const candidate of candidates) {
    const num = toNumber(candidate);
    if (num != null) return num;
  }
  return null;
}

function extractLtpFromQuote(rawQuote = {}, fallback) {
  const nested = rawQuote.v || rawQuote.V || rawQuote.quote || rawQuote.q || {};
  const candidates = [
    rawQuote.ltp,
    rawQuote.lt,
    rawQuote.last_price,
    rawQuote.price,
    rawQuote.c,
    rawQuote.lp,
    nested.lp,
    nested.ltp,
    nested.last_price,
    nested.price,
    fallback
  ];
  for (const candidate of candidates) {
    const num = toNumber(candidate);
    if (num != null) return num;
  }
  return null;
}

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
        range_to: to,
      });

      const candles = resp?.candles || resp?.data || [];
      if (!Array.isArray(candles) || candles.length < 1) {
        throw new Error("no historical candles");
      }

      // take previous day close if available; otherwise last
      const prev = candles[candles.length - 2] || candles[candles.length - 1];
      const prevClose = Number(prev?.[4]);
      if (!Number.isFinite(prevClose)) throw new Error("prevClose NaN");

      return prevClose;
    } catch (err) {
      const msg = err?.message ?? String(err);
      if (attempt < CONFIG.PREV_CLOSE_RETRY) {
        const d = backoffDelay(CONFIG.PREV_CLOSE_RETRY_BASE_MS, attempt);
        await sleep(d);
      } else {
        console.warn(`[fetchPrevClose] ${symbolFyersFormat} failed: ${msg}`);
        lastError = msg;
      }
    }
  }
  return null;
}

function normalizeQuoteSnapshot(quote) {
  if (!quote) return null;
  const raw = quote.raw || {};
  const symbol = canonicalSymbolFromQuote(raw, quote.symbol);
  if (!symbol) return null;

  return {
    symbol,
    prevClose: extractPrevCloseFromQuote(raw),
    ltp: extractLtpFromQuote(raw, quote.ltp),
    changePct: extractChangePercentFromQuote(raw, quote.changePercent),
    raw,
  };
}

async function fetchQuoteSnapshots(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];

  const snapshots = [];
  const chunkSize = Math.max(1, QUOTE_BATCH_SIZE || 40);

  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    try {
      const quotes = await fy.getQuotes(chunk);
      if (Array.isArray(quotes)) {
        for (const quote of quotes) {
          const snap = normalizeQuoteSnapshot(quote);
          if (snap) snapshots.push(snap);
        }
      }
    } catch (err) {
      lastError = err?.message || String(err);
      console.warn(`[fetchQuoteSnapshots] Batch failed (${chunk.length} symbols): ${lastError}`);
    }

    if (QUOTE_BATCH_DELAY_MS > 0 && i + chunkSize < symbols.length) {
      await sleep(QUOTE_BATCH_DELAY_MS);
    }
  }

  return snapshots;
}

function hydrateFromQuoteSnapshots(snapshots = []) {
  let prevLoaded = 0;
  let ltpLoaded = 0;

  for (const snap of snapshots) {
    if (!snap?.symbol) continue;

    if (Number.isFinite(snap.prevClose) && snap.prevClose > 0) {
      if (!prevCloseMap.has(snap.symbol)) prevLoaded += 1;
      prevCloseMap.set(snap.symbol, snap.prevClose);
    }

    if (Number.isFinite(snap.ltp) && snap.ltp > 0) {
      ltpMap.set(snap.symbol, snap.ltp);
      ltpLoaded += 1;
      seedMinuteSeries(snap.symbol, snap.ltp, extractTickTimestamp(snap.raw || {}));
    }
  }

  return { prevLoaded, ltpLoaded };
}

async function backfillPrevCloseWithHistory(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return 0;
  let loaded = 0;

  await asyncPool(
    symbols,
    async (sym) => {
      const pc = await fetchPrevClose(sym);
      if (pc != null) {
        if (!prevCloseMap.has(sym)) loaded += 1;
        prevCloseMap.set(sym, pc);
      }
      return null;
    },
    Math.max(1, Math.min(3, PREV_CLOSE_CONCURRENCY))
  );

  return loaded;
}

async function warmupPrevCloses(symbols) {
  prevCloseMap.clear();
  ltpMap.clear();
  minuteSeries.clear();

  if (!Array.isArray(symbols) || symbols.length === 0) return;

  const snapshots = await fetchQuoteSnapshots(symbols);
  hydrateFromQuoteSnapshots(snapshots);

  const missingSymbols = symbols.filter((sym) => !prevCloseMap.has(sym));
  let fallbackLoaded = 0;
  if (missingSymbols.length) {
    console.warn(`[M1] PrevClose quotes missing ${missingSymbols.length}. Falling back to history (slow).`);
    fallbackLoaded = await backfillPrevCloseWithHistory(missingSymbols);
  }

  const loadedCount = prevCloseMap.size;
  const totalCount = symbols.length;

  const sample = Array.from(prevCloseMap.entries())
    .slice(0, 8)
    .map(([sym, value]) => `${prettySymbol(sym)}:${value}`)
    .join(", ");

  const parts = [
    `${loadedCount}/${totalCount}`,
    `quotes=${snapshots.length}`,
    `history=${fallbackLoaded}`
  ];

  console.log(`[M1] PrevClose warmup: ${parts.join(" | ")}${sample ? ` | ${sample}` : ""}`);
  if (!loadedCount) console.warn("[M1] No prevClose values fetched!");
}

async function bootstrapMoversViaQuotes(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];

  await waitUntilBootstrapTimeIfNeeded();

  console.log(`[M1] Quote bootstrap scanning ${symbols.length} symbols (batch=${QUOTE_BATCH_SIZE}).`);
  const startedAt = Date.now();

  prevCloseMap.clear();
  ltpMap.clear();
  minuteSeries.clear();

  const snapshots = await fetchQuoteSnapshots(symbols);
  hydrateFromQuoteSnapshots(snapshots);

  const missingSymbols = symbols.filter((sym) => !prevCloseMap.has(sym));
  if (missingSymbols.length) {
    console.log(`[M1] Quote bootstrap missing prevClose for ${missingSymbols.length} symbols. Falling back to history.`);
    await backfillPrevCloseWithHistory(missingSymbols);
  }

  const moverMap = new Map();
  for (const snap of snapshots) {
    if (!snap?.symbol) continue;
    const prevClose = snap.prevClose ?? prevCloseMap.get(snap.symbol) ?? null;
    const ltp = snap.ltp ?? ltpMap.get(snap.symbol) ?? null;
    let changePct = Number(snap.changePct);
    if (!Number.isFinite(changePct) && Number.isFinite(prevClose) && Number.isFinite(ltp) && prevClose > 0) {
      changePct = percentChange(prevClose, ltp);
    }
    if (!Number.isFinite(changePct)) continue;
    moverMap.set(snap.symbol, {
      symbol: snap.symbol,
      prevClose,
      ltp,
      changePct,
    });
  }

  const movers = Array.from(moverMap.values()).filter(
    (m) => Number.isFinite(m.changePct) && m.changePct >= CONFIG.ALERT_THRESHOLD_PCT
  );
  movers.sort((a, b) => b.changePct - a.changePct);

  await persistMovers(movers);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[M1] Quote bootstrap complete in ${elapsedSec}s | movers=${movers.length} | prevClose=${prevCloseMap.size} | ltp=${ltpMap.size}`
  );
  return movers;
}

/* ======================= Socket ======================= */
function detachSocketListeners(sock) {
  if (!sock) return;
  try {
    // node ws supports removeAllListeners; fyersDataSocket proxies events
    if (typeof sock.removeAllListeners === "function") {
      sock.removeAllListeners("connect");
      sock.removeAllListeners("message");
      sock.removeAllListeners("error");
      sock.removeAllListeners("close");
    }
  } catch {}
}

function safeCloseSocket() {
  if (!socket) return;
  try {
    detachSocketListeners(socket);
    if (typeof socket.close === "function") socket.close();
  } catch {}
  socket = null;
  currentSubscribedBatch = [];
  isSubscribing = false;
}

function scheduleReconnect() {
  // coalesce multiple schedule requests
  if (reconnectTimer) return;

  reconnectAttempts = clamp(reconnectAttempts + 1, 1, 20);
  const delay = clamp(1000 * 2 ** (reconnectAttempts - 1), 1000, MAX_RECONNECT_DELAY_MS);

  console.log(`[Socket] reconnect #${reconnectAttempts} in ${Math.round(delay / 1000)}s`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await ensureSocketConnected();
    } catch (e) {
      console.error("[Socket] reconnect attempt failed:", e?.message || e);
      scheduleReconnect();
    }
  }, delay);
}

async function ensureSocketConnected() {
  if (socket) return;

  try {
    const socketToken = await getSocketToken();
    if (!socketToken || !socketToken.includes(":") || String(socketToken).length < CONFIG.SOCKET_TOKEN_MIN_LENGTH) {
      lastError = "socket token invalid or not in <APP_ID>:<ACCESS_TOKEN> format";
      console.warn("[Socket] " + lastError);
      // continue; fyers lib may still error usefully
    }

    socket = new fyersDataSocket(socketToken);
    reconnectAttempts = 0; // reset on new instance

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      lastHeartbeatTs = Date.now();
      // idempotent subscribe
      subscribeCurrentBatch();

      if (typeof socket.autoreconnect === "function") {
        try { socket.autoreconnect(); } catch {}
      }
    });

    socket.on("message", (msg) => {
      const data = Array.isArray(msg) ? msg : (msg?.d ?? msg?.data ?? msg);
      const arr = Array.isArray(data) ? data : [data];

      const parsedForPrint = [];

      for (const t of arr) {
        const sym = t?.symbol ?? t?.s ?? t?.n ?? t?.nseSym;
        let ltp = t?.ltp ?? t?.c ?? t?.price ?? t?.v?.lp ?? t?.v?.last_price ?? t?.last_price;

        if (ltp && typeof ltp === "object") {
          // pick first numeric field
          const k = Object.keys(ltp).find((k) => Number.isFinite(Number(ltp[k])));
          if (k) ltp = Number(ltp[k]);
        }

        if (!sym || ltp == null || !Number.isFinite(Number(ltp))) continue;

        const num = Number(ltp);
        ltpMap.set(sym, num);
        const tickTs = extractTickTimestamp(t);
        updateMinuteSeries(sym, num, tickTs);

        // threshold alert (deduped)
        const pc = prevCloseMap.get(sym);
        if (Number.isFinite(pc) && pc > 0) {
          const chg = percentChange(pc, num);
          if (chg >= CONFIG.ALERT_THRESHOLD_PCT) {
            const prev = lastAlertPct.get(sym) ?? -Infinity;
            if (chg >= prev + 0.1) {
              console.log(`[ALERT] ${prettySymbol(sym)} up ${chg.toFixed(2)}% (LTP ${num.toFixed(2)}, prev ${pc})`);
              lastAlertPct.set(sym, chg);
            }
          }
        }

        parsedForPrint.push(`${prettySymbol(sym)} → ${Number.isInteger(num) ? String(num) : num.toFixed(2)}`);
      }

      if (parsedForPrint.length) {
        compactTickBuffer.push(...parsedForPrint);
        flushCompactTicks(false);
      }
      lastHeartbeatTs = Date.now();
    });

    socket.on("error", (err) => {
      lastError = err?.message || String(err);
      console.error("[Socket Error]", lastError);
    });

    socket.on("close", (code, reason) => {
      console.warn("[Socket] Closed", code ?? "", reason ?? "");
      safeCloseSocket();
      flushCompactTicks(true);
      scheduleReconnect();
    });

    if (typeof socket.connect === "function") socket.connect();
    else if (typeof socket.open === "function") socket.open();
    else console.warn("[Socket] no connect/open method on socket instance");
  } catch (err) {
    lastError = err?.message || String(err);
    console.error("[Socket] ensureSocketConnected error:", lastError);
    safeCloseSocket();
    scheduleReconnect();
  }
}

function subscribeCurrentBatch() {
  if (!socket) {
    ensureSocketConnected().catch((e) =>
      console.error("[subscribeCurrentBatch] ensureSocketConnected error", e?.message || e)
    );
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

    const same =
      currentSubscribedBatch.length === batch.length &&
      currentSubscribedBatch.every((v, i) => v === batch[i]);
    if (same) {
      // refresh lite mode if supported
      if (typeof socket.mode === "function" && socket.LiteMode != null) {
        try { socket.mode(socket.LiteMode); } catch {}
      }
      return;
    }

    // unsubscribe previous (best-effort)
    if (currentSubscribedBatch.length && typeof socket.unsubscribe === "function") {
      try { socket.unsubscribe(currentSubscribedBatch); } catch (uerr) { console.warn("[Socket] unsubscribe:", uerr?.message || uerr); }
    }

    // set lite mode and subscribe
    try {
      if (typeof socket.mode === "function" && socket.LiteMode != null) {
        try { socket.mode(socket.LiteMode); } catch {}
      }
      socket.subscribe(batch);
      if (typeof socket.mode === "function" && socket.LiteMode != null) {
        try { socket.mode(socket.LiteMode); } catch {}
      }
      if (typeof socket.autoreconnect === "function") {
        try { socket.autoreconnect(); } catch {}
      }

      currentSubscribedBatch = batch;
      lastSubscriptionRotateTs = Date.now();
      console.log(`[Socket] Subscribed batch ${currentBatchIndex} (${batch.length} symbols) LiteMode`);
    } catch (err) {
      lastError = err?.message || String(err);
      console.error("[subscribeCurrentBatch] subscribe error", lastError);
    }
  } finally {
    // avoid re-entrancy
    setImmediate(() => {
      isSubscribing = false;
    });
  }
}

function rotateBatch() {
  const now = Date.now();
  if (now - lastRotateTs < MIN_ROTATE_MS) return;
  lastRotateTs = now;

  if (!Array.isArray(universeSymbols) || universeSymbols.length === 0) return;
  if (!socket) {
    ensureSocketConnected().catch((e) => console.error("[rotateBatch] ensureSocketConnected error", e?.message || e));
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

/* ======================= Movers ======================= */
function computeMovers(thresholdPct = CONFIG.ALERT_THRESHOLD_PCT) {
  const movers = [];
  for (const sym of universeSymbols) {
    const pc = prevCloseMap.get(sym);
    const ltp = ltpMap.get(sym);
    if (!Number.isFinite(pc) || !Number.isFinite(ltp)) continue;

    const chg = percentChange(pc, ltp);
    if (chg >= thresholdPct) {
      movers.push({ symbol: sym, prevClose: pc, ltp, changePct: chg });
    }
  }
  movers.sort((a, b) => b.changePct - a.changePct);
  return movers;
}

async function persistMovers(movers = []) {
  if (!Array.isArray(movers) || !movers.length) return;

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
        console.warn("[persistMovers] DB upsert fail for", m.symbol, err?.message || err);
        lastError = err?.message || String(err);
      }
    },
    DB_UPSERT_CONCURRENCY
  );
}

/* ======================= Public Actions ======================= */
async function startEngine() {
  if (engineOn) return { ok: true, msg: "already running" };
  console.log("[M1] Starting engine...");

  const universe = await loadUniverse();
  if (!universe.length) {
    lastError = "Universe load failed or empty";
    console.error("[M1] Universe empty, aborting start");
    return { ok: false, error: lastError };
  }

  universeSymbols = universe;
  currentBatchIndex = 0;
  let moversFromBootstrap = [];
  try {
    moversFromBootstrap = await bootstrapMoversViaQuotes(universeSymbols);
  } catch (err) {
    console.error("[M1] Quote bootstrap failed:", err?.message || err);
  }

  if (moversFromBootstrap?.length) {
    universeSymbols = moversFromBootstrap.map((m) => m.symbol);
    console.log(
      `[M1] Live socket universe limited to ${universeSymbols.length} movers (>= ${CONFIG.ALERT_THRESHOLD_PCT}% change).`
    );
  } else {
    console.log("[M1] Bootstrap yielded no movers. Falling back to full-universe warmup.");
    await warmupPrevCloses(universeSymbols);
  }

  await ensureSocketConnected();

  // rotation
  clearInterval(rotationIntervalHandle);
  rotationIntervalHandle = setInterval(rotateBatch, CONFIG.ROTATE_INTERVAL_MS);

  // heartbeat
  clearInterval(heartbeatIntervalHandle);
  heartbeatIntervalHandle = setInterval(() => {
    const now = Date.now();
    const ageSec = lastHeartbeatTs ? Math.round((now - lastHeartbeatTs) / 1000) : null;
    const batches = Math.max(1, Math.ceil(universeSymbols.length / BATCH_SIZE));
    console.log(
      `[HEARTBEAT] on=${engineOn} ltp=${ltpMap.size} prev=${prevCloseMap.size} ageSec=${ageSec ?? "n/a"} batch=${currentBatchIndex}/${batches - 1} reconnects=${reconnectAttempts}`
    );
  }, CONFIG.HEARTBEAT_INTERVAL_MS);

  // auto-stop before cutoff
  clearTimeout(autoStopTimeoutHandle);
  const nowSec = Math.floor(DateTime.now().setZone(IST).toSeconds());
  const msTillCutoff = Math.max(0, (todayCutoffTs() - nowSec) * 1000) + 5000;
  autoStopTimeoutHandle = setTimeout(() => {
    console.log("[M1] Auto cutoff reached. Stopping engine.");
    stopEngine();
  }, msTillCutoff);

  engineOn = true;
  console.log(`[M1] Engine started: ${universeSymbols.length} symbols, batch=${BATCH_SIZE}`);
  installShutdownHookOnce();
  return { ok: true, msg: `Engine started with ${universeSymbols.length} symbols` };
}

async function stopEngine() {
  console.log("[M1] Stopping engine...");
  engineOn = false;

  clearInterval(rotationIntervalHandle); rotationIntervalHandle = null;
  clearInterval(heartbeatIntervalHandle); heartbeatIntervalHandle = null;
  clearTimeout(autoStopTimeoutHandle); autoStopTimeoutHandle = null;

  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  safeCloseSocket();

  prevCloseMap.clear();
  minuteSeries.clear();
  // keep ltpMap for post-mortem if needed
  console.log("[M1] Engine stopped.");
  return { ok: true, msg: "stopped" };
}

async function getMovers() {
  if (!engineOn) return { ok: false, data: [], error: "engine off" };

  const movers = computeMovers(CONFIG.ALERT_THRESHOLD_PCT);

  await persistMovers(movers);

  return { ok: true, count: movers.length, data: movers };
}

function getStatus() {
  const batches = Math.max(1, Math.ceil(universeSymbols.length / BATCH_SIZE));
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
      batches,
      lastHeartbeatTs,
      lastSubscriptionRotateTs,
      reconnectAttempts,
    },
  };
}

/* ======================= Admin/Debug ======================= */
function _getLtpSnapshot() {
  try {
    return Array.from(ltpMap.entries()).map(([symbol, ltp]) => ({
      symbol,
      ltp: Number(ltp),
      ts: Date.now(),
    }));
  } catch (err) {
    console.error("[m1._getLtpSnapshot] error:", err?.message || err);
    return [];
  }
}

function _getUniverse() {
  return Array.from(universeSymbols);
}

/* ======================= Shutdown Hook ======================= */
function installShutdownHookOnce() {
  if (shutdownHookInstalled) return;
  shutdownHookInstalled = true;

  const shutdown = async () => {
    try {
      console.log("[M1] shutdown signal received - stopping engine...");
      await stopEngine();
      setTimeout(() => process.exit(0), 400);
    } catch (err) {
      console.error("[M1] shutdown error:", err?.message || err);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/* ======================= Exports ======================= */
module.exports = {
  startEngine,
  stopEngine,
  getMovers,
  getStatus,
  _getLtpSnapshot,
  _getUniverse,
  getMinuteCandles,
};
