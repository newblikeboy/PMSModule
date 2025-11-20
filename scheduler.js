// scheduler.js — FINAL PRODUCTION VERSION (CLEAN LOGS)
"use strict";

const { DateTime } = require("luxon");
const { IST } = require("./utils/time");

// Engines
const marketSocket = require("./services/marketSocket.service");
const m1Service = require("./services/m1.service");
const m2Service = require("./services/m2.service");
const tradeEngine = require("./services/tradeEngine.service");

// DB
const M1Mover = require("./models/M1Mover");
const M2Signal = require("./models/M2Signal");

// ---------------- CONFIG ----------------
const CONFIG = {
  MARKET_OPEN_H: 9,
  MARKET_OPEN_M: 15,
  MARKET_CLOSE_H: 15,
  MARKET_CLOSE_M: 30,
  M1_FORCE_START_ALLOWED: true,
  STARTUP_CYCLE_MS: 15000,  // 15 sec
  TRADE_CYCLE_MS: 15000,    // 15 sec
  SIGNAL_POLL_MS: 6000,     // 6 sec fallback
};

// ---------------- FLAGS ----------------
let flags = {
  day: null,
  socketConnected: false,

  m1Starting: false,
  m1Started: false,

  m2Starting: false,
  m2Started: false,

  tradeStarted: false,
  enginesStopped: false
};

// ---------------- TIME HELPERS ----------------
const nowIST = () => DateTime.now().setZone(IST);

function isMarketDay() {
  const d = nowIST().weekday;
  return d >= 1 && d <= 5;
}

function isMarketOpen() {
  if (!isMarketDay()) return false;
  const n = nowIST();
  const current = n.hour * 60 + n.minute;
  const open = CONFIG.MARKET_OPEN_H * 60 + CONFIG.MARKET_OPEN_M;
  const close = CONFIG.MARKET_CLOSE_H * 60 + CONFIG.MARKET_CLOSE_M;
  return current >= open && current <= close;
}

function isAfterCutoff() {
  const n = nowIST();
  const cutoff = 14 * 60 + 45;
  const nowMin = n.hour * 60 + n.minute;
  return nowMin >= cutoff;
}

// ---------------- DAILY RESET ----------------
function resetDailyFlags() {
  const today = nowIST().toISODate();

  if (flags.day !== today) {
    flags = {
      day: today,
      socketConnected: false,

      m1Starting: false,
      m1Started: false,

      m2Starting: false,
      m2Started: false,

      tradeStarted: false,
      enginesStopped: false
    };

    console.log("[SCHED] New Market Day — Flags Reset");
  }
}

// ---------------- START MARKET SOCKET ----------------
async function startMarketSocket() {
  try {
    await marketSocket.start();
  } catch {}
}

// ---------------- START M1 ----------------
async function startM1() {
  if (flags.m1Started || flags.m1Starting) return;
  flags.m1Starting = true;

  try {
    const res = await m1Service.startEngine();
    if (res.ok) {
      flags.m1Started = true;
      console.log("[SCHED] M1 Completed — Movers Found:", res.movers?.length || 0);
    }
  } catch (err) {
    console.error("[SCHED] M1 Error:", err.message);
  }

  flags.m1Starting = false;
}

// ---------------- START M2 ----------------
async function startM2() {
  if (!flags.m1Started || flags.m2Started || flags.m2Starting) return;
  flags.m2Starting = true;

  try {
    const res = await m2Service.startM2Engine(onRealtimeSignal);
    if (res.ok) {
      flags.m2Started = true;
      console.log("[SCHED] M2 Engine Active");
    }
  } catch (err) {
    console.error("[SCHED] M2 Error:", err.message);
  }

  flags.m2Starting = false;
}

// ---------------- START TRADE ENGINE ----------------
async function startTradeEngine() {
  if (flags.tradeStarted || !flags.m2Started || isAfterCutoff()) return;

  const sigs = await M2Signal.find({ inEntryZone: true }).lean();
  if (!sigs.length) return;

  flags.tradeStarted = true;
  console.log("[SCHED] Trade Engine Activated");
}

// ---------------- REAL-TIME M2 CALLBACK ----------------
async function onRealtimeSignal() {
  if (!flags.m2Started || isAfterCutoff()) return;
  if (!flags.tradeStarted) {
    await startTradeEngine();
  }
}

// ---------------- FALLBACK DB SIGNAL WATCHER ----------------
async function fallbackSignalWatcher() {
  if (!flags.m2Started || flags.tradeStarted || isAfterCutoff()) return;

  const recent = await M2Signal.find({
    inEntryZone: true,
    updatedAt: { $gte: new Date(Date.now() - 60 * 1000) }
  });

  if (recent.length > 0) {
    await startTradeEngine();
  }
}

// ---------------- STOP ALL ENGINES ----------------
async function stopAllEngines() {
  if (flags.enginesStopped) return;
  flags.enginesStopped = true;

  console.log("[SCHED] Market Closed — Stopping Engines...");

  try { await m2Service.stopM2Engine(); } catch {}
}

// ---------------- STARTUP PIPELINE ----------------
async function startupCycle() {
  resetDailyFlags();

  if (!isMarketOpen()) return;

  await startMarketSocket();

  // M1 auto-run ANY TIME server starts
  if (!flags.m1Started) {
    await startM1();
  }

  if (flags.m1Started && !flags.m2Started) {
    await startM2();
  }

  if (flags.m2Started && !flags.tradeStarted && !isAfterCutoff()) {
    await startTradeEngine();
  }
}

// ---------------- TRADE CYCLE ----------------
async function tradeCycle() {
  if (!isMarketOpen()) return;

  try {
    if (flags.tradeStarted && !isAfterCutoff()) {
      await tradeEngine.autoEnterOnSignal();  // bulk entry
    }

    await tradeEngine.checkOpenTradesAndUpdate(); // exits
  } catch (e) {
    console.error("[SCHED] tradeCycle:", e.message);
  }
}

// ---------------- MARKET CLOSE CHECK ----------------
function checkMarketClose() {
  if (!isMarketOpen()) {
    stopAllEngines();
  }
}

// ---------------- SCHEDULER START ----------------
function startScheduler() {
  console.log("[SCHED] Scheduler Started (Clean Logs)");

  startMarketSocket();

  setInterval(startupCycle, CONFIG.STARTUP_CYCLE_MS);
  setInterval(tradeCycle, CONFIG.TRADE_CYCLE_MS);
  setInterval(fallbackSignalWatcher, CONFIG.SIGNAL_POLL_MS);
  setInterval(checkMarketClose, 60000); // every 1 min
}

module.exports = { startScheduler };
