"use strict";

const { DateTime } = require("luxon");

const { IST } = require("./utils/time");
const { env } = require("./config/env");
const logger = require("./config/logger");
const tradeEngine = require("./services/tradeEngine.service");

let intervalHandle = null;

function isMarketOpenIST() {
  const now = DateTime.now().setZone(IST);
  const dow = now.weekday;
  if (dow === 6 || dow === 7) return false;
  const hhmm = Number(now.toFormat("HHmm"));
  return hhmm >= 915 && hhmm <= 1530;
}

async function runCycle() {
  if (!isMarketOpenIST()) return;

  try {
    const enterRes = await tradeEngine.autoEnterOnSignal();
    if (enterRes?.created?.length) {
      logger.info(
        { symbols: enterRes.created.map((t) => t.symbol), mode: enterRes.mode },
        "[SCHED] New trades created"
      );
    }

    const exitRes = await tradeEngine.checkOpenTradesAndUpdate();
    if (exitRes?.closed?.length) {
      logger.info(
        { symbols: exitRes.closed.map((t) => t.symbol) },
        "[SCHED] Trades closed"
      );
    }
  } catch (err) {
    logger.error({ err }, "[SCHED] Error in cycle");
  }
}

function startScheduler() {
  if (!env.ENABLE_SCHEDULER) {
    logger.warn("[SCHED] Scheduler disabled via configuration");
    return;
  }

  if (intervalHandle) {
    logger.warn("[SCHED] Scheduler already running");
    return;
  }

  logger.info("[SCHED] Scheduler started (30s interval during market hours)");
  intervalHandle = setInterval(runCycle, 30 * 1000);
  intervalHandle.unref?.();
}

function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("[SCHED] Scheduler stopped");
  }
}

module.exports = {
  startScheduler,
  stopScheduler
};

