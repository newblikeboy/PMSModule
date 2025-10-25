// models/PaperTrade.js
const mongoose = require("mongoose");

const paperTradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },

  entryPrice: { type: Number, required: true },
  entryTime: { type: Date, default: Date.now },

  qty: { type: Number, default: 1 }, // फिलहाल fixed quantity

  targetPrice: { type: Number, required: true },
  stopPrice: { type: Number, required: true },

  exitPrice: { type: Number, default: null },
  exitTime: { type: Date, default: null },

  status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },

  pnlAbs: { type: Number, default: null }, // absolute PnL
  pnlPct: { type: Number, default: null }, // % return

  notes: { type: String, default: "" },

  // snapshot info from signal
  rsiAtEntry: { type: Number, default: null },
  changePctAtEntry: { type: Number, default: null }
});

module.exports = mongoose.model("PaperTrade", paperTradeSchema);
