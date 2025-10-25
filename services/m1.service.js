"use strict";
const fs = require("fs");
const path = require("path");
const { fyersDataSocket } = require("fyers-api-v3");
const { getSocketToken } = require("./fyersAuth");
const fy = require("./fyersSdk");
const { todayCutoffTs, isBeforeCutoff, IST } = require("../utils/time");
const { DateTime } = require("luxon");
const M1Mover = require("../models/M1Mover");

let socket = null;
let engineOn = false;
let subscribedSymbols = [];
let prevCloseMap = new Map();
let ltpMap = new Map();
let lastError = null;

async function loadUniverse() {
  const p = path.join(__dirname, "../nse_universe.json");
  const arr = JSON.parse(fs.readFileSync(p, "utf8"));
  return [...new Set(arr.map((s) => s.trim()))];
}

async function fetchPrevClose(symbol) {
  const to = DateTime.now().setZone(IST).toISODate();
  const from = DateTime.now().setZone(IST).minus({ days: 7 }).toISODate();
  const resp = await fy.getHistory({
    symbol,
    resolution: "D",
    range_from: from,
    range_to: to,
  });
  const candles = resp?.candles || [];
  if (candles.length < 1) throw new Error("no data");
  const prev = candles[candles.length - 2] || candles[candles.length - 1];
  return Number(prev[4]);
}

async function warmupPrevCloses(symbols) {
  prevCloseMap.clear();
  for (const s of symbols) {
    try {
      const pc = await fetchPrevClose(s);
      prevCloseMap.set(s, pc);
    } catch (e) {
      lastError = e.message;
    }
  }
}

async function startSocket(symbols) {
  const token = await getSocketToken();
  if (socket) {
    try {
      socket.close();
    } catch {}
  }
  socket = new fyersDataSocket(token, "./");
  socket.on("connect", () => {
    socket.subscribe(symbols, "lite");
    socket.autoreconnect(10);
  });
  socket.on("message", (msg) => {
    const data = Array.isArray(msg) ? msg : msg?.d || msg?.data || [msg];
    (Array.isArray(data) ? data : [data]).forEach((t) => {
      const sym = t.symbol || t.s;
      const ltp = t.ltp || t.c || t.price;
      if (!sym || ltp == null) return;
      ltpMap.set(sym, Number(ltp));
    });
  });
  socket.connect();
}

function computeMovers(threshold = 5) {
  const arr = [];
  for (const sym of subscribedSymbols) {
    const pc = prevCloseMap.get(sym);
    const ltp = ltpMap.get(sym);
    if (!pc || !ltp) continue;
    const pct = ((ltp - pc) / pc) * 100;
    if (pct >= threshold) {
      arr.push({ symbol: sym, prevClose: pc, ltp, changePct: pct });
    }
  }
  arr.sort((a, b) => b.changePct - a.changePct);
  return arr;
}

async function startEngine() {
  if (engineOn) return { ok: true, msg: "already running" };
  const uni = await loadUniverse();
  subscribedSymbols = uni;
  await warmupPrevCloses(uni);
  await startSocket(uni);
  engineOn = true;

  // Auto stop at cutoff
  const remainMs =
    Math.max(0, (todayCutoffTs() - Math.floor(DateTime.now().setZone(IST).toSeconds())) * 1000) + 5000;
  setTimeout(stopEngine, remainMs);

  return { ok: true, msg: `started ${uni.length} symbols` };
}

async function stopEngine() {
  if (socket) try { socket.close(); } catch {}
  engineOn = false;
  return { ok: true, msg: "stopped" };
}

async function getMovers() {
  if (!engineOn) return { ok: false, data: [] };
  const movers = computeMovers();
  // Save to DB
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
  return { engineOn, beforeCutoff: isBeforeCutoff(), lastError };
}

module.exports = { startEngine, stopEngine, getMovers, getStatus };
