// scheduler.js - Comprehensive trading engine scheduler (FINAL VERSION)
"use strict";

const { DateTime } = require("luxon");
const { IST } = require("./utils/time");

const m1Service = require("./services/m1.service");
const m2Service = require("./services/m2.service");
const tradeEngine = require("./services/tradeEngine.service");

const M1Mover = require("./models/M1Mover");
const M2Signal = require("./models/M2Signal");

// ---------------- CONFIG ----------------
const CONFIG = Object.freeze({
  M1_START_HOUR: 10,
  M1_START_MINUTE: 30,

  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 15,
  MARKET_CLOSE_HOUR: 15,
  MARKET_CLOSE_MINUTE: 30,

  TRADE_CUTOFF_HOUR: 14,
  TRADE_CUTOFF_MINUTE: 45,
});

// ---------------- TIME UTILS ----------------
function isMarketDayIST() {
  const now = DateTime.now().setZone(IST);
  const dow = now.weekday;
  return dow >= 1 && dow <= 5;
}

function isMarketOpenIST() {
  if (!isMarketDayIST()) return false;
  const now = DateTime.now().setZone(IST);

  const current = now.hour * 60 + now.minute;
  const open = CONFIG.MARKET_OPEN_HOUR * 60 + CONFIG.MARKET_OPEN_MINUTE;
  const close = CONFIG.MARKET_CLOSE_HOUR * 60 + CONFIG.MARKET_CLOSE_MINUTE;

  return current >= open && current <= close;
}

function isM1StartTimeIST() {
  const now = DateTime.now().setZone(IST);
  return (
    isMarketDayIST() &&
    now.hour === CONFIG.M1_START_HOUR &&
    now.minute === CONFIG.M1_START_MINUTE
  );
}

function isAfterTradeCutoffIST() {
  const now = DateTime.now().setZone(IST);
  const current = now.hour * 60 + now.minute;
  const cutoff = CONFIG.TRADE_CUTOFF_HOUR * 60 + CONFIG.TRADE_CUTOFF_MINUTE;
  return current >= cutoff;
}

async function getTodayM1Movers() {
  const now = DateTime.now().setZone(IST);
  const start = now.startOf("day").toJSDate();
  const end = now.endOf("day").toJSDate();
  return await M1Mover.find({
    capturedAt: { $gte: start, $lte: end },
  }).lean();
}

async function getTodayM2Signals() {
  const now = DateTime.now().setZone(IST);
  const start = now.startOf("day").toJSDate();
  const end = now.endOf("day").toJSDate();
  return await M2Signal.find({
    updatedAt: { $gte: start, $lte: end },
    inEntryZone: true,
  }).lean();
}

// ---------------- ENGINE FLAGS ----------------
let m1Started = false;
let m2Started = false;
let tradeStarted = false;
let enginesStoppedForToday = false;

// ---------------- ENGINE STARTERS ----------------
async function startM1Engine() {
  if (m1Started) return;

  console.log("[SCHED] Starting M1 Engine…");
  try {
    const res = await m1Service.startEngine();
    if (res.ok) {
      m1Started = true;
      console.log(
        "[SCHED] M1 Engine started, movers:",
        res.movers?.length || 0
      );
    }
  } catch (err) {
    console.error("[SCHED] M1 failed:", err.message);
  }
}

async function startM2Engine() {
  if (m2Started) return;

  const movers = await getTodayM1Movers();
  if (!movers.length) {
    console.log("[SCHED] No M1 movers → M2 won't start yet");
    return;
  }

  console.log("[SCHED] Starting M2 Engine…");
  try {
    const res = await m2Service.startM2Engine();
    if (res.ok) {
      m2Started = true;
      console.log("[SCHED] M2 Engine started");
    }
  } catch (err) {
    console.error("[SCHED] M2 failed:", err.message);
  }
}

async function startTradeEngine() {
  if (tradeStarted) return;

  const signals = await getTodayM2Signals();
  if (!signals.length) {
    console.log("[SCHED] No M2 signals → Trade Engine won't start yet");
    return;
  }

  console.log("[SCHED] Trade Engine is active.");
  tradeStarted = true;
}

// ---------------- DAILY RESET ----------------
function resetDailyFlags() {
  m1Started = false;
  m2Started = false;
  tradeStarted = false;
  enginesStoppedForToday = false;

  console.log("[SCHED] Daily flags reset");
}

// ---------------- RUN DAILY START CHECKS ----------------
async function runDailyStartChecks() {
  if (!isMarketOpenIST()) return;

  if (isM1StartTimeIST()) await startM1Engine();

  if (m1Started && !m2Started) await startM2Engine();

  if (m2Started && !tradeStarted && !isAfterTradeCutoffIST())
    await startTradeEngine();
}

// ---------------- MARKET CYCLE ----------------
async function runMarketCycle() {
  // Stop engines ONCE after market close
  if (!isMarketOpenIST()) {
    if (!enginesStoppedForToday) {
      enginesStoppedForToday = true;
      console.log("[SCHED] Market closed → Stopping ALL engines…");

      try {
        await m2Service.stopM2Engine?.();
      } catch {}

      try {
        await tradeEngine.stopRealTimeMonitoring?.();
      } catch {}

      console.log("[SCHED] All engines stopped for the day.");
    }
    return;
  }

  // MARKET OPEN → Active trading cycle
  try {
    if (tradeStarted && !isAfterTradeCutoffIST()) {
      await tradeEngine.autoEnterOnSignal();
    }

    await tradeEngine.checkOpenTradesAndUpdate();
  } catch (err) {
    console.error("[SCHED] Market cycle error:", err.message);
  }
}

// ---------------- START SCHEDULER ----------------
function startScheduler() {
  console.log("[SCHED] Comprehensive scheduler started.");

  // Reset flags at market open (once per day)
  setInterval(() => {
    const now = DateTime.now().setZone(IST);
    if (
      now.hour === CONFIG.MARKET_OPEN_HOUR &&
      now.minute === CONFIG.MARKET_OPEN_MINUTE
    ) {
      resetDailyFlags();
    }
  }, 60 * 1000);

  // Run startup sequence
  setInterval(runDailyStartChecks, 60 * 1000);

  // Market monitoring
  setInterval(runMarketCycle, 30 * 1000);
}

module.exports = { startScheduler };
