// models/PaperTrade.js
"use strict";

const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const PaperTradeSchema = new Schema(
  {
    // --- New: per-user ownership (for multi-user engine + per-user PnL) ---
    userId: { type: Types.ObjectId, ref: "User", index: true },
    signalId: { type: Types.ObjectId, ref: "M2Signal" },
    signalCapturedAt: { type: Date },

    // --- Core trade fields (existing-compatible) ---
    symbol: { type: String, required: true },
    qty: { type: Number, default: 1, min: 1 },

    entryPrice: { type: Number, required: true },
    entryTime: { type: Date, default: Date.now },

    targetPrice: { type: Number, required: true },
    stopPrice: { type: Number, required: true },

    exitPrice: { type: Number },
    exitTime: { type: Date },

    pnlAbs: { type: Number, default: 0 },
    pnlPct: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true
    },

    notes: { type: String, default: "" },

    // signals at entry (already used in your code)
    rsiAtEntry: { type: Number },
    changePctAtEntry: { type: Number },

    // --- New: live/paper bookkeeping ---
    tradeMode: {
      type: String,
      enum: ["paper", "live"],
      default: "paper",
      index: true
    },
    broker: {
      type: String, // e.g. "ANGEL_ONE" or "PAPER"
      default: "PAPER",
      index: true
    },
    brokerOrderId: { type: String }, // Angel order id for audit
  },
  { timestamps: true }
);

// Useful compound index: one-open-trade-per-user fast check
PaperTradeSchema.index({ userId: 1, status: 1 });

// Optional: frequent queries by user & recency
PaperTradeSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("PaperTrade", PaperTradeSchema);
