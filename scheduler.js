// scheduler.js - Comprehensive trading engine scheduler
"use strict";

/**
 * Complete trading engine scheduler with auto-start functionality:
 * 1. M1 Engine: Auto-starts Monday-Friday at 10:30 AM IST
 * 2. M2 Engine: Auto-starts if M1Mover data exists for the day
 * 3. Trade Engine: Auto-starts if M2Signal data exists for the day
 * 4. Market monitoring: Continuous trade execution and exit monitoring
 */

const { DateTime } = require("luxon");
const { IST } = require("./utils/time");
const m1Service = require("./services/m1.service");
const m2Service = require("./services/m2.service");
const tradeEngine = require("./services/tradeEngine.service");
const M1Mover = require("./models/M1Mover");
const M2Signal = require("./models/M2Signal");

// ---------------- CONFIG ----------------
const CONFIG = Object.freeze({
  // M1 auto-start time (10:30 AM IST)
  M1_START_HOUR: 10,
  M1_START_MINUTE: 30,
  
  // Market timing
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 15,
  MARKET_CLOSE_HOUR: 15,
  MARKET_CLOSE_MINUTE: 30,
  
  // Trade cutoff (no new entries after this time)
  TRADE_CUTOFF_HOUR: 14,
  TRADE_CUTOFF_MINUTE: 45,
});

// ---------------- TIME UTILS ----------------
function isMarketDayIST() {
  const now = DateTime.now().setZone(IST);
  const dow = now.weekday; // 1=Mon ... 7=Sun
  return dow >= 1 && dow <= 5; // Monday to Friday
}

function isMarketOpenIST() {
  const now = DateTime.now().setZone(IST);
  if (!isMarketDayIST()) return false;
  
  const currentTime = now.hour * 60 + now.minute;
  const marketOpen = CONFIG.MARKET_OPEN_HOUR * 60 + CONFIG.MARKET_OPEN_MINUTE;
  const marketClose = CONFIG.MARKET_CLOSE_HOUR * 60 + CONFIG.MARKET_CLOSE_MINUTE;
  
  return currentTime >= marketOpen && currentTime <= marketClose;
}

function isM1StartTimeIST() {
  const now = DateTime.now().setZone(IST);
  if (!isMarketDayIST()) return false;
  
  return now.hour === CONFIG.M1_START_HOUR && now.minute === CONFIG.M1_START_MINUTE;
}

function isAfterTradeCutoffIST() {
  const now = DateTime.now().setZone(IST);
  const currentTime = now.hour * 60 + now.minute;
  const cutoffTime = CONFIG.TRADE_CUTOFF_HOUR * 60 + CONFIG.TRADE_CUTOFF_MINUTE;
  
  return currentTime >= cutoffTime;
}

async function getTodayM1Movers() {
  const now = DateTime.now().setZone(IST);
  const startOfDay = now.startOf('day').toJSDate();
  const endOfDay = now.endOf('day').toJSDate();
  
  return await M1Mover.find({
    capturedAt: { $gte: startOfDay, $lte: endOfDay }
  }).lean();
}

async function getTodayM2Signals() {
  const now = DateTime.now().setZone(IST);
  const startOfDay = now.startOf('day').toJSDate();
  const endOfDay = now.endOf('day').toJSDate();
  
  return await M2Signal.find({
    updatedAt: { $gte: startOfDay, $lte: endOfDay },
    inEntryZone: true
  }).lean();
}

// ---------------- ENGINE MANAGEMENT ----------------
let m1Started = false;
let m2Started = false;
let tradeStarted = false;

async function startM1Engine() {
  if (m1Started) return;
  
  console.log("[SCHED] Starting M1 Engine...");
  try {
    const result = await m1Service.startEngine();
    if (result.ok) {
      m1Started = true;
      console.log("[SCHED] M1 Engine started successfully, found movers:", result.movers?.length || 0);
    }
  } catch (err) {
    console.error("[SCHED] M1 Engine failed to start:", err.message);
  }
}

async function startM2Engine() {
  if (m2Started) return;
  
  try {
    const movers = await getTodayM1Movers();
    if (movers.length === 0) {
      console.log("[SCHED] No M1Mover data found, M2 Engine not started");
      return;
    }
    
    console.log("[SCHED] Starting M2 Engine with", movers.length, "movers...");
    const result = await m2Service.startM2Engine();
    if (result.ok) {
      m2Started = true;
      console.log("[SCHED] M2 Engine started successfully");
    }
  } catch (err) {
    console.error("[SCHED] M2 Engine failed to start:", err.message);
  }
}

async function startTradeEngine() {
  if (tradeStarted) return;
  
  try {
    const signals = await getTodayM2Signals();
    if (signals.length === 0) {
      console.log("[SCHED] No M2Signal data found, Trade Engine not started");
      return;
    }
    
    console.log("[SCHED] Starting Trade Engine with", signals.length, "signals...");
    tradeStarted = true;
    console.log("[SCHED] Trade Engine started successfully");
  } catch (err) {
    console.error("[SCHED] Trade Engine failed to start:", err.message);
  }
}

// ---------------- DAILY CYCLE MANAGEMENT ----------------
async function runDailyStartChecks() {
  if (!isMarketOpenIST()) return;
  
  // Check M1 start time
  if (isM1StartTimeIST()) {
    await startM1Engine();
  }
  
  // Check if M2 should start (after M1 has run and we have movers)
  if (m1Started && !m2Started) {
    await startM2Engine();
  }
  
  // Check if Trade Engine should start (after M2 has signals)
  if (m2Started && !tradeStarted && !isAfterTradeCutoffIST()) {
    await startTradeEngine();
  }
}

// ---------------- MARKET MONITORING CYCLE ----------------
async function runMarketCycle() {
  if (!isMarketOpenIST()) {
    return;
  }
  
  try {
    // Auto-enter new trades (only if trade engine is started and not after cutoff)
    if (tradeStarted && !isAfterTradeCutoffIST()) {
      const enterRes = await tradeEngine.autoEnterOnSignal();
      if (enterRes.results) {
        const successful = enterRes.results.filter(r => r.ok && r.trade);
        if (successful.length > 0) {
          console.log(`[SCHED] New trades created:`, successful.map(r => r.trade.symbol));
        }
      }
    }
    
    // Check and update exits for all open trades
    const exitRes = await tradeEngine.checkOpenTradesAndUpdate();
    if (exitRes.results) {
      const closedTrades = exitRes.results.filter(r => r.closed && r.closed.length > 0);
      for (const result of closedTrades) {
        console.log(`[SCHED] Trades closed for user ${result.userId}:`, result.closed.map(t => t.symbol));
      }
    }
  } catch (err) {
    console.error("[SCHED] Error in market cycle:", err.message || err);
  }
}

// ---------------- DAILY RESET ----------------
function resetDailyFlags() {
  m1Started = false;
  m2Started = false;
  tradeStarted = false;
  console.log("[SCHED] Daily flags reset for new trading day");
}

// ---------------- MAIN SCHEDULER ----------------
function startScheduler() {
  console.log("[SCHED] Starting comprehensive trading scheduler...");
  
  // Reset daily flags at market open
  setInterval(() => {
    if (isMarketOpenIST()) {
      // This runs every minute, reset flags once per day at market open
      const now = DateTime.now().setZone(IST);
      if (now.hour === CONFIG.MARKET_OPEN_HOUR && now.minute === CONFIG.MARKET_OPEN_MINUTE) {
        resetDailyFlags();
      }
    }
  }, 60 * 1000);
  
  // Run daily start checks every minute during market hours
  setInterval(() => {
    runDailyStartChecks();
  }, 60 * 1000);
  
  // Run market monitoring cycle every 30 seconds
  setInterval(() => {
    runMarketCycle();
  }, 30 * 1000);
  
  console.log("[SCHED] Scheduler started with:");
  console.log("- M1 Engine: Monday-Friday at 10:30 AM IST");
  console.log("- M2 Engine: Auto-starts when M1 data available");
  console.log("- Trade Engine: Auto-starts when M2 signals available");
  console.log("- Market monitoring: Every 30 seconds during market hours");
}

// ---------------- LEGACY METHODS FOR BACKWARD COMPATIBILITY ----------------
async function manualRunM1AndMaybeM2() {
  const result = await m1Service.startEngine();
  if (result.ok && result.movers?.length > 0) {
    setTimeout(async () => {
      await m2Service.startM2Engine();
    }, 5000);
  }
  return result;
}

module.exports = { 
  startScheduler,
  manualRunM1AndMaybeM2
};
