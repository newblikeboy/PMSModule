// models/M2Signal.js
const mongoose = require("mongoose");

const m2SignalSchema = new mongoose.Schema({
  symbol: { type: String, index: true, required: true },
  rsi: { type: Number, default: null },
  timeframe: { type: String, default: "5m" },
  inEntryZone: { type: Boolean, default: false }, // RSI 40-50 ?
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("M2Signal", m2SignalSchema);
