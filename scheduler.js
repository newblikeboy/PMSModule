// scheduler.js
"use strict";

/**
 * यह lightweight scheduler है जो live market hours में
 * बार-बार strategy को चलाता है:
 *
 * 1) /trade/enter जैसी logic: नए RSI signals से paper trades बनाओ
 * 2) /trade/check-exit जैसी logic: खुले trades में target/SL hit है या नहीं
 *
 * हम इसे सीधे services कॉल करेंगे (HTTP नहीं मारेंगे).
 */

const { DateTime } = require("luxon");
const { IST } = require("./utils/time");
const tradeEngine = require("./services/tradeEngine.service");

// market timing control (optional safety)
function isMarketOpenIST() {
  // Monday-Friday, 09:15 - 15:30 IST
  const now = DateTime.now().setZone(IST);
  const dow = now.weekday; // 1=Mon ... 7=Sun
  if (dow === 6 || dow === 7) return false; // Sat/Sun
  const t = now.toFormat("HHmm"); // e.g. "0945"
  const n = Number(t);
  return n >= 915 && n <= 1530;
}

// run one cycle
async function runCycle() {
  if (!isMarketOpenIST()) {
    return;
  }

  try {
    // 1. auto enter on new RSI signals
    const enterRes = await tradeEngine.autoEnterOnSignal();
    if (enterRes.created && enterRes.created.length > 0) {
      console.log("[SCHED] New paper trades created:", enterRes.created.map(t => t.symbol));
    }

    // 2. update exits for open trades
    const exitRes = await tradeEngine.checkOpenTradesAndUpdate();
    if (exitRes.closed && exitRes.closed.length > 0) {
      console.log("[SCHED] Trades closed:", exitRes.closed.map(t => t.symbol));
    }
  } catch (err) {
    console.error("[SCHED] Error in cycle:", err.message || err);
  }
}

// start interval
function startScheduler() {
  console.log("[SCHED] Scheduler started (every 30s in market hours)");
  // हर 30 सेकंड में चेक करो
  setInterval(runCycle, 30 * 1000);
}

module.exports = { startScheduler };
