"use strict";

const axios = require("axios");
const fy = require("./fyersSdk");
const { env } = require("../config/env");

const DEFAULT_BASE_URL = "https://apiconnect.angelbroking.com";
const BASE_URL = env.ANGEL_API_BASE || DEFAULT_BASE_URL;
const ORDER_ENDPOINT = "/rest/secure/angelbroking/order/v1/placeOrder";

const configCache = {
  loaded: false,
  value: null
};

function loadConfig() {
  if (configCache.loaded) return configCache.value;

  const apiKey = env.ANGEL_API_KEY;
  const clientCode = env.ANGEL_CLIENT_CODE;
  const accessToken = env.ANGEL_ACCESS_TOKEN;

  if (!apiKey || !clientCode || !accessToken) {
    const err = new Error("Angel One configuration missing (ANGEL_API_KEY, ANGEL_CLIENT_CODE, ANGEL_ACCESS_TOKEN)");
    err.code = "ANGEL_CONFIG";
    throw err;
  }

  const cfg = {
    apiKey,
    clientCode,
    accessToken,
    sourceId: env.ANGEL_SOURCE_ID || "WEB",
    localIp: env.ANGEL_CLIENT_LOCAL_IP || "127.0.0.1",
    publicIp: env.ANGEL_CLIENT_PUBLIC_IP || env.ANGEL_CLIENT_LOCAL_IP || "127.0.0.1",
    mac: env.ANGEL_CLIENT_MAC || "AA:BB:CC:DD:EE:FF",
    appVersion: env.ANGEL_APP_VERSION || "1.0.0",
    timeout: Number(env.ANGEL_HTTP_TIMEOUT_MS) || 15000
  };

  configCache.loaded = true;
  configCache.value = cfg;
  return cfg;
}

const tokenMapCache = {
  loaded: false,
  value: {}
};

function getSymbolTokenMap() {
  if (!tokenMapCache.loaded) {
    const raw = env.ANGEL_SYMBOL_TOKEN_MAP || "{}";
    try {
      const parsed = JSON.parse(raw);
      tokenMapCache.value = parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      console.warn("[AngelOne] Failed to parse ANGEL_SYMBOL_TOKEN_MAP:", err.message || err);
      tokenMapCache.value = {};
    }
    tokenMapCache.loaded = true;
  }
  return tokenMapCache.value;
}

function normalizeSymbol(inputSymbol) {
  if (!inputSymbol) return inputSymbol;
  return fy.toFyersSymbol ? fy.toFyersSymbol(inputSymbol) : String(inputSymbol);
}

function toAngelTradingsymbol(symbol) {
  const normalized = normalizeSymbol(symbol);
  return normalized.replace(/^NSE:/i, "").toUpperCase();
}

function resolveSymbolToken(symbol) {
  const map = getSymbolTokenMap();
  const normalized = normalizeSymbol(symbol).toUpperCase();
  return map[normalized] || map[toAngelTradingsymbol(symbol)] || null;
}

function buildHeaders(cfg) {
  return {
    Authorization: `Bearer ${cfg.accessToken}`,
    "X-UserType": "USER",
    "X-SourceID": cfg.sourceId,
    "X-ClientLocalIP": cfg.localIp,
    "X-ClientPublicIP": cfg.publicIp,
    "X-MACAddress": cfg.mac,
    "X-PrivateKey": cfg.apiKey,
    "X-AppVersion": cfg.appVersion,
    "Content-Type": "application/json",
    Accept: "application/json",
    clientcode: cfg.clientCode
  };
}

function ensureQuantity(qty) {
  const num = Number(qty);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("Invalid quantity for Angel One order");
  }
  return Math.round(num);
}

async function placeOrder({
  symbol,
  qty,
  side = "BUY",
  orderType = "MARKET",
  productType = "INTRADAY",
  price,
  tag
} = {}) {
  const cfg = loadConfig();
  const normalized = normalizeSymbol(symbol);
  const tradingsymbol = toAngelTradingsymbol(normalized);
  const symboltoken = resolveSymbolToken(normalized);

  if (!symboltoken) {
    throw new Error(`Angel One symbol token missing for ${tradingsymbol}. Provide ANGEL_SYMBOL_TOKEN_MAP.`);
  }

  const quantity = ensureQuantity(qty);
  const transactiontype = side.toUpperCase();
  const ordertype = orderType.toUpperCase();
  const producttype = productType.toUpperCase();

  const payload = {
    variety: "NORMAL",
    tradingsymbol,
    symboltoken: String(symboltoken),
    transactiontype,
    exchange: "NSE",
    ordertype,
    producttype,
    duration: "DAY",
    quantity,
    price: ordertype === "MARKET" ? "0" : Number(price ?? 0).toFixed(2),
    triggerprice: ordertype === "SL" || ordertype === "SLM" ? Number(price ?? 0).toFixed(2) : "0",
    disclosedquantity: "0",
    squareoff: "0",
    stoploss: "0",
    trailingstoploss: "0"
  };

  if (tag) {
    payload.tag = String(tag);
  }

  try {
    const resp = await axios.post(`${BASE_URL}${ORDER_ENDPOINT}`, payload, {
      headers: buildHeaders(cfg),
      timeout: cfg.timeout
    });

    const data = resp.data || {};
    if (data.status !== true) {
      const message = data.message || data.errorcode || "Angel One order rejected";
      throw new Error(message);
    }

    const orderId = data.data?.orderid || null;
    const avgPrice = data.data?.averageprice ?? data.data?.price ?? null;

    return {
      ok: true,
      orderId,
      price: avgPrice != null ? Number(avgPrice) : null,
      payload
    };
  } catch (err) {
    if (err.response) {
      const info = err.response.data || {};
      const message = info.message || info.errorcode || err.message;
      throw new Error(`Angel One order error: ${message}`);
    }
    throw new Error(`Angel One order error: ${err.message || err}`);
  }
}

function isConfigured() {
  try {
    loadConfig();
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  placeOrder,
  isConfigured,
  _normalizeSymbol: normalizeSymbol,
  _resolveSymbolToken: resolveSymbolToken
};
