// services/fyersSdk.js
"use strict";

const axios = require("axios");
const { getAccessToken } = require("./fyersAuth");

// Helper base URL (paper vs live endpoint)
const FYERS_BASE = "https://api-t1.fyers.in/api/v3";

// Map our internal symbol format to Fyers format.
// You might store plain "RELIANCE", but Fyers expects "NSE:RELIANCE-EQ"
function toFyersSymbol(sym) {
  // Adjust if you also trade BANKNIFTY etc. Fyers sometimes uses "NSE:SBIN-EQ".
  return `NSE:${sym}-EQ`;
}

// ---- Low level request wrapper ----
async function fyersGet(path, params={}) {
  const token = await getAccessToken();
  const resp = await axios.get(`${FYERS_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    params
  });
  return resp.data;
}

async function fyersPost(path, body={}) {
  const token = await getAccessToken();
  const resp = await axios.post(`${FYERS_BASE}${path}`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  return resp.data;
}


// -------------------------------------------------
// 1. PROFILE / FUNDS / MARGIN
// -------------------------------------------------

// Get profile or funds info
async function getProfile() {
  // adjust path to actual fyers profile endpoint in v3
  // commonly /profile or /funds depending on doc.
  // we'll expose both separately.
  const data = await fyersGet("/profile");
  return data;
}

async function getFunds() {
  const data = await fyersGet("/funds");
  return data;
}

// Margin calculator-like info:
// Many brokers expose margin / required funds for an order spec. We'll simulate.
async function getRequiredMargin(orderSpec) {
  // In real fyers v3, margin endpoint looks like /margin or /convertMargin etc.
  // If not available to you yet, this can call your own calc.
  // We'll just return a fake computed margin for now so code doesn't break.
  // Replace with actual broker call when you confirm API.
  const { qty = 0, entryPrice = 0, leverage = 5 } = orderSpec;
  const notional = qty * entryPrice;
  const marginRequired = notional / leverage;
  return {
    ok: true,
    notional,
    marginRequired
  };
}


// -------------------------------------------------
// 2. QUOTES (LTP / %change for multiple symbols)
// -------------------------------------------------

// Get quotes for many symbols for ticker tape etc.
async function getQuotes(symbolList) {
  // symbolList is like ["RELIANCE","HDFCBANK",...]
  // Fyers usually supports comma-separated instruments
  const fySymbols = symbolList.map(toFyersSymbol);

  // sample path, might differ in actual doc:
  // /quotes/?symbols=NSE:RELIANCE-EQ,NSE:SBIN-EQ
  const data = await fyersGet("/quotes", {
    symbols: fySymbols.join(",")
  });

  // Normalize result to { symbol, ltp, changePercent }
  // You must map according to fyers actual response.
  // We'll assume response like:
  // { s: "ok", d: [ {symbol:"NSE:RELIANCE-EQ", ltp:..., chgPct:...}, ...] }
  const raw = data.d || data.data || [];

  const normalized = raw.map(row => {
    // Extract clean symbol like "RELIANCE"
    // "NSE:RELIANCE-EQ" -> RELIANCE
    let clean = row.symbol || row.sym || "";
    clean = clean.replace("NSE:","").replace("-EQ","");

    return {
      symbol: clean,
      ltp: row.ltp ?? row.last_price ?? row.price,
      changePercent: row.chgPct ?? row.changePct ?? row.pChange ?? 0
    };
  });

  return normalized;
}


// -------------------------------------------------
// 3. HISTORICAL DATA / LIVE DATA (candles)
// -------------------------------------------------

// Historical candles
// resolution could be "1","3","5","15","60","D" etc based on Fyers
async function getHistorical(symbol, resolution, fromDate, toDate) {
  // You map these params to fyers format.
  // Fyers typical candle endpoint: /history or /candles?symbol=...&resolution=...&date_format=...&range_from=...&range_to=...
  const fySym = toFyersSymbol(symbol);

  const data = await fyersGet("/history", {
    symbol: fySym,
    resolution,
    range_from: fromDate, // "YYYY-MM-DD"
    range_to: toDate,     // "YYYY-MM-DD"
    // add extra params if fyers requires them
  });

  // You likely get back candle arrays like [timestamp, open, high, low, close, volume]
  return data;
}

// You also have live ticks via websocket. That will NOT live here (that’s in your dataStream).
// fyersSdk.js can still export helpers later if needed.

// -------------------------------------------------
// 4. PLACE ORDER
// -------------------------------------------------

// WE SUPPORT PAPER TRADE + (future) LIVE TRADE
// paperMode=true means: don't actually hit fyers place-order, just simulate/store in DB.
// paperMode=false means: call fyers real order endpoint.

async function placeOrder(order, { paperMode = true } = {}) {
  // order example:
  // {
  //   symbol: "RELIANCE",
  //   side: "BUY",           // or "SELL"
  //   qty: 10,
  //   type: "MARKET",        // or "LIMIT"
  //   limitPrice: 2740.5,
  //   productType: "INTRADAY" // CNC / MIS / etc.
  // }

  if (paperMode) {
    // <-- Paper execution logic:
    // 1. Store trade in your engine state (_engineState.trades)
    // 2. Return a fake orderId
    // This is what we've already been using for paper trading in M4/M5.
    const fakeOrderId = "PAPER-" + Date.now();
    // TODO: insert this position into _engineState.trades with status "OPEN"
    return {
      ok: true,
      mode: "paper",
      orderId: fakeOrderId
    };
  }

  // <-- LIVE execution logic (when you go real with broker):
  // Map our order fields to Fyers payload
  // Check Fyers placeOrder spec in docs.
  // Example (pseudo):
  const fyPayload = {
    symbol: toFyersSymbol(order.symbol),
    qty: order.qty,
    type: order.type === "MARKET" ? 2 : 1,   // Fyers might use enums for order_type
    side: order.side === "BUY" ? 1 : -1,     // Fyers uses numeric side sometimes
    productType: order.productType || "INTRADAY",
    limitPrice: order.limitPrice || 0,
    // ... any other required fields (validity, disclosedQty, stopPrice etc.)
  };

  const resp = await fyersPost("/orders", fyPayload);

  // Normalize the broker response
  return {
    ok: true,
    mode: "live",
    raw: resp
  };
}


// -------------------------------------------------
// EXPORTS
// -------------------------------------------------

module.exports = {
  getProfile,
  getFunds,
  getRequiredMargin,
  getQuotes,
  getHistorical,
  placeOrder,

  // exposing converter might help debugging elsewhere:
  toFyersSymbol
};
