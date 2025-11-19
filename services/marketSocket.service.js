// services/marketSocket.service.js
"use strict";

/**
 * marketSocket.service.js
 * Shared singleton market socket manager for fyers websocket.
 *
 * API:
 *  - start()                     // ensure socket started
 *  - stop()                      // close socket
 *  - subscribe(symbols, ownerId) // ownerId can be 'm2', 'trade', userId, etc.
 *  - unsubscribe(symbols, ownerId)
 *  - on(event, cb) / off(event, cb)
 *  - getLastTick(symbol) -> { ltp, ts, raw } | null
 *
 * Events emitted:
 *  - 'connect', 'disconnect', 'error'
 *  - 'tick' -> { symbol, ltp, ts, raw }
 *  - 'batch' -> [ { symbol, ltp, ts, raw }, ... ]
 *  - 'subscribed' -> [symbols]
 *  - 'unsubscribed' -> [symbols]
 */

const EventEmitter = require("events");
const { fyersDataSocket } = require("fyers-api-v3");
const { getSocketToken } = require("./fyersAuth");

const DEFAULTS = {
  SUBSCRIBE_DEBOUNCE_MS: 200,
  RECONNECT_BASE_MS: 1000,
  RECONNECT_MAX_MS: 60000,
};

class MarketSocket extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connecting = false;
    this.reconnectAttempts = 0;

    // symbol -> Set(ownerId)
    this.symbolOwners = new Map();
    // symbols currently subscribed on fyers socket
    this.subscribed = new Set();
    // pending symbols to subscribe (debounced)
    this.pendingSubscribe = new Set();
    this.subscribeTimer = null;

    // cache: symbol -> { ltp, ts, raw }
    this.ltpMap = new Map();

    // bound handlers for socket events so we can remove them
    this._onMessage = this._onMessage.bind(this);
    this._onConnect = this._onConnect.bind(this);
    this._onClose = this._onClose.bind(this);
    this._onError = this._onError.bind(this);
  }

  async start() {
    if (this.socket || this.connecting) return;
    this.connecting = true;
    try {
      const token = await getSocketToken();
      if (!token) {
        throw new Error("socket token not available");
      }

      this.socket = new fyersDataSocket(token);

      this.socket.on("connect", this._onConnect);
      this.socket.on("message", this._onMessage);
      this.socket.on("close", this._onClose);
      this.socket.on("error", this._onError);

      if (typeof this.socket.connect === "function") {
        this.socket.connect();
      } else if (typeof this.socket.open === "function") {
        this.socket.open();
      } else {
        throw new Error("socket object has no connect/open method");
      }
    } catch (err) {
      this.emit("error", err);
      this._scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  async stop() {
    try {
      if (!this.socket) return;
      try {
        if (typeof this.socket.removeAllListeners === "function") {
          this.socket.removeAllListeners("connect");
          this.socket.removeAllListeners("message");
          this.socket.removeAllListeners("close");
          this.socket.removeAllListeners("error");
        }
      } catch (e) {}
      if (typeof this.socket.close === "function") this.socket.close();
      this.socket = null;
      this.reconnectAttempts = 0;
      this.emit("disconnect");
    } catch (err) {
      this.emit("error", err);
    }
  }

  _onConnect() {
    this.reconnectAttempts = 0;
    this.emit("connect");
    // resubscribe previously subscribed symbols
    const all = Array.from(this.subscribed);
    if (all.length && this.socket && typeof this.socket.subscribe === "function") {
      try {
        this.socket.subscribe(all);
      } catch (e) {
        this.emit("error", e);
      }
    }
  }

  _onClose(code, reason) {
    this.emit("disconnect", { code, reason });
    // try reconnect
    this.socket = null;
    this._scheduleReconnect();
  }

  _onError(err) {
    this.emit("error", err);
  }

  _onMessage(msg) {
    // Normalize message to array of tick objects
    const data = Array.isArray(msg) ? msg : (msg?.d ?? msg?.data ?? msg);
    const arr = Array.isArray(data) ? data : [data];

    const out = [];
    for (const t of arr) {
      const sym = t?.symbol ?? t?.s ?? t?.n ?? t?.tradingsymbol;
      let ltp = t?.ltp ?? t?.lp ?? t?.c ?? (t?.v && (t.v.lp ?? t.v.last_price)) ?? null;
      if (ltp && typeof ltp === "object") {
        // try to take numeric value inside object
        const k = Object.keys(ltp).find(k => Number.isFinite(Number(ltp[k])));
        if (k) ltp = Number(ltp[k]);
      }
      if (!sym || ltp == null || !Number.isFinite(Number(ltp))) continue;
      const tsRaw = t?.timestamp ?? t?.ts ?? t?.time ?? Date.now();
      const ts = Number(tsRaw) > 1e12 ? Number(tsRaw) : (Number(tsRaw) > 1e9 ? Number(tsRaw) : Number(tsRaw) * 1000);
      const tick = { symbol: String(sym), ltp: Number(ltp), ts, raw: t };
      this.ltpMap.set(tick.symbol, { ltp: tick.ltp, ts: tick.ts, raw: tick.raw });
      out.push(tick);
      // emit per tick
      this.emit("tick", tick);
    }
    if (out.length) this.emit("batch", out);
  }

  _scheduleReconnect() {
    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 20);
    const delay = Math.min(DEFAULTS.RECONNECT_MAX_MS, DEFAULTS.RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1));
    const jitter = Math.round(delay * (0.75 + Math.random() * 0.5));
    setTimeout(() => this.start().catch(e => this.emit("error", e)), jitter);
  }

  async subscribe(symbols = [], ownerId = "anonymous") {
    if (!Array.isArray(symbols)) symbols = [symbols];
    if (!symbols.length) return;

    for (const s of symbols) {
      const sym = String(s);
      let set = this.symbolOwners.get(sym);
      if (!set) {
        set = new Set();
        this.symbolOwners.set(sym, set);
      }
      set.add(ownerId);
      // if not yet subscribed on socket, queue it
      if (!this.subscribed.has(sym)) this.pendingSubscribe.add(sym);
    }

    // Debounce actual socket.subscribe calls
    if (!this.subscribeTimer) {
      this.subscribeTimer = setTimeout(() => this._flushSubscribe(), DEFAULTS.SUBSCRIBE_DEBOUNCE_MS);
    }

    // ensure socket running
    await this.start();
  }

  _flushSubscribe() {
    const batch = Array.from(this.pendingSubscribe);
    this.pendingSubscribe.clear();
    this.subscribeTimer = null;
    if (!batch.length || !this.socket) return;
    try {
      if (typeof this.socket.subscribe === "function") {
        this.socket.subscribe(batch);
        for (const s of batch) this.subscribed.add(s);
        this.emit("subscribed", batch);
      }
    } catch (err) {
      this.emit("error", err);
    }
  }

  async unsubscribe(symbols = [], ownerId = "anonymous") {
    if (!Array.isArray(symbols)) symbols = [symbols];
    if (!symbols.length) return;

    const toUnsub = [];
    for (const s of symbols) {
      const sym = String(s);
      const set = this.symbolOwners.get(sym);
      if (!set) continue;
      set.delete(ownerId);
      if (set.size === 0) {
        this.symbolOwners.delete(sym);
        if (this.subscribed.has(sym)) toUnsub.push(sym);
        this.subscribed.delete(sym);
      }
    }

    if (toUnsub.length && this.socket && typeof this.socket.unsubscribe === "function") {
      try {
        this.socket.unsubscribe(toUnsub);
        this.emit("unsubscribed", toUnsub);
      } catch (err) {
        this.emit("error", err);
      }
    }
  }

  getLastTick(symbol) {
    return this.ltpMap.get(String(symbol)) || null;
  }

  // convenience to return an array of currently subscribed symbols
  getSubscribedSymbols() {
    return Array.from(this.subscribed);
  }
}

// export singleton
module.exports = new MarketSocket();
