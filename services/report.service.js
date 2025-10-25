// services/report.service.js
"use strict";

const { DateTime } = require("luxon");
const { IST } = require("../utils/time");
const PaperTrade = require("../models/PaperTrade");

function isSameDayIST(dateA, dateB) {
  // compare yyyy-mm-dd in IST
  const a = DateTime.fromJSDate(dateA).setZone(IST).toISODate();
  const b = DateTime.fromJSDate(dateB).setZone(IST).toISODate();
  return a === b;
}

function toTwo(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return Number(n).toFixed(2);
}

async function fetchTodayTrades() {
  // हम एक तेज तरीका लेंगे:
  // 1. आज की शुरुआत IST से -> आज रात IST तक का range
  const now = DateTime.now().setZone(IST);
  const startOfDay = now.startOf("day"); // 00:00 IST
  const endOfDay = now.endOf("day");     // 23:59:59 IST

  // चूँकि Mongo में टाइम UTC में है, हमें UTC में convert करना होगा
  const startUTC = startOfDay.toUTC();
  const endUTC   = endOfDay.toUTC();

  const trades = await PaperTrade.find({
    entryTime: { $gte: startUTC.toJSDate(), $lte: endUTC.toJSDate() }
  }).sort({ entryTime: 1 }).lean();

  return trades;
}

function summarizeTrades(trades) {
  const summary = {
    dateIST: DateTime.now().setZone(IST).toISODate(),
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 0,
    wins: 0,
    losses: 0,
    grossPnLAbs: 0,
    avgPnLAbs: 0,
    bestTrade: null,
    worstTrade: null
  };

  summary.totalTrades = trades.length;

  // We'll also collect cleaned rows for table / CSV
  const rows = trades.map(tr => {
    const isClosed = tr.status === "CLOSED";
    const plAbs = isClosed ? (tr.pnlAbs ?? 0) : 0;

    return {
      _id: tr._id,
      symbol: tr.symbol,
      qty: tr.qty,
      entryPrice: tr.entryPrice,
      targetPrice: tr.targetPrice,
      stopPrice: tr.stopPrice,
      entryTime: tr.entryTime,
      status: tr.status,
      exitPrice: tr.exitPrice ?? null,
      exitTime: tr.exitTime ?? null,
      pnlAbs: tr.pnlAbs ?? null,
      pnlPct: tr.pnlPct ?? null,
      notes: tr.notes ?? ""
    };
  });

  // compute stats
  const closed = rows.filter(r => r.status === "CLOSED");
  const open   = rows.filter(r => r.status === "OPEN");

  summary.openTrades = open.length;
  summary.closedTrades = closed.length;

  // wins / losses: based on pnlAbs > 0
  closed.forEach(r => {
    const abs = r.pnlAbs || 0;
    summary.grossPnLAbs += abs;
    if (abs > 0) summary.wins += 1;
    else if (abs < 0) summary.losses += 1;
  });

  // avgPnLAbs (per closed trade)
  if (closed.length > 0) {
    summary.avgPnLAbs = summary.grossPnLAbs / closed.length;
  }

  // best/worst
  if (closed.length > 0) {
    summary.bestTrade = closed.reduce((best, r) => {
      if (!best) return r;
      return (r.pnlAbs || 0) > (best.pnlAbs || 0) ? r : best;
    }, null);

    summary.worstTrade = closed.reduce((worst, r) => {
      if (!worst) return r;
      return (r.pnlAbs || 0) < (worst.pnlAbs || 0) ? r : worst;
    }, null);
  }

  return { summary, rows };
}

function buildCSV(summary, rows) {
  // CSV header
  const header = [
    "symbol",
    "qty",
    "entryPrice",
    "targetPrice",
    "stopPrice",
    "entryTimeIST",
    "status",
    "exitPrice",
    "exitTimeIST",
    "pnlAbs",
    "pnlPct",
    "notes"
  ];

  const lines = [];
  lines.push("# Daily Strategy Report");
  lines.push(`# Date(IST),${summary.dateIST}`);
  lines.push(`# TotalTrades,${summary.totalTrades}`);
  lines.push(`# ClosedTrades,${summary.closedTrades}`);
  lines.push(`# Wins,${summary.wins}`);
  lines.push(`# Losses,${summary.losses}`);
  lines.push(`# GrossPnLAbs,${toTwo(summary.grossPnLAbs)}`);
  lines.push(`# AvgPnLAbs,${toTwo(summary.avgPnLAbs)}`);
  lines.push("");
  lines.push(header.join(","));

  rows.forEach(r => {
    const entryIST = DateTime.fromJSDate(r.entryTime).setZone(IST).toFormat("HH:mm:ss");
    const exitIST  = r.exitTime
      ? DateTime.fromJSDate(r.exitTime).setZone(IST).toFormat("HH:mm:ss")
      : "";

    const rowCsv = [
      r.symbol,
      r.qty,
      toTwo(r.entryPrice),
      toTwo(r.targetPrice),
      toTwo(r.stopPrice),
      entryIST,
      r.status,
      r.exitPrice != null ? toTwo(r.exitPrice) : "",
      exitIST,
      r.pnlAbs != null ? toTwo(r.pnlAbs) : "",
      r.pnlPct != null ? toTwo(r.pnlPct) : "",
      (r.notes || "").replace(/,/g,";") // commas break CSV
    ];

    lines.push(rowCsv.join(","));
  });

  const csv = lines.join("\n");
  const filename = `daily_report_${summary.dateIST}.csv`;
  return { csv, filename };
}

async function buildDailyReport() {
  const trades = await fetchTodayTrades();
  const { summary, rows } = summarizeTrades(trades);
  return {
    ok: true,
    summary,
    trades: rows
  };
}

async function buildDailyReportCSV() {
  const trades = await fetchTodayTrades();
  const { summary, rows } = summarizeTrades(trades);
  return buildCSV(summary, rows);
}

module.exports = {
  buildDailyReport,
  buildDailyReportCSV
};
