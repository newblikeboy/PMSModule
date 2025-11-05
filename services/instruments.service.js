// services/instruments.service.js
"use strict";

const fs = require("fs/promises");
const path = require("path");

const FILE =
  process.env.ANGEL_INSTRUMENTS_FILE ||
  path.join(process.cwd(), "data", "angel_instruments.json");

// cache
let _map = null;
let _mtime = 0;

async function load() {
  if (_map) return _map;
  try {
    const stat = await fs.stat(FILE);
    const mtimeMs = stat.mtimeMs || stat.mtime?.getTime?.() || Date.now();
    if (!_map || mtimeMs !== _mtime) {
      const raw = await fs.readFile(FILE, "utf8");
      const arr = JSON.parse(raw);
      const m = new Map();
      for (const r of arr) {
        const exch = String(r.exchange || r.exch || "NSE").toUpperCase();
        const ts = String(r.tradingsymbol || r.tradingSymbol || "").toUpperCase();
        const tok = String(r.symboltoken || r.token || r.symbolToken || "").trim();
        if (exch && ts && tok) m.set(`${exch}:${ts}`, tok);
      }
      _map = m;
      _mtime = mtimeMs;
      console.log(`[instruments] loaded ${_map.size} tokens from ${FILE}`);
    }
  } catch (e) {
    _map = new Map();
    console.warn("[instruments] failed to load:", FILE, e?.message || e);
  }
  return _map;
}

function normalizeTs(symbol) {
  // accepts "NSE:SBIN-EQ" or "SBIN-EQ"
  let s = String(symbol || "").toUpperCase().trim();
  if (!s) return null;
  s = s.replace(/^NSE:/, "");
  return `NSE:${s}`;
}

async function resolveToken(symbol) {
  const map = await load();
  const key = normalizeTs(symbol);
  return key ? map.get(key) || null : null;
}

module.exports = { resolveToken };
