// models/LiveQuote.js - Schema for storing live market quotes
"use strict";

const mongoose = require("mongoose");

const liveQuoteSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true, // One quote per symbol
    index: true
  },
  name: {
    type: String,
    required: true
  },
  ltp: {
    type: Number,
    required: true
  },
  prevClose: {
    type: Number,
    required: true
  },
  changePct: {
    type: Number,
    required: true
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    enum: ['m1_engine', 'manual_refresh', 'scheduled'],
    default: 'm1_engine'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'livequotes'
});

// Indexes for better query performance

liveQuoteSchema.index({ fetchedAt: -1 });
liveQuoteSchema.index({ changePct: -1 });

// Static methods
liveQuoteSchema.statics.getLatestQuotes = function(limit = 798) {
  return this.find({ isActive: true })
    .sort({ changePct: -1 }) // Sort by biggest movers first
    .limit(limit);
};

liveQuoteSchema.statics.getQuotesByChangePct = function(minChange = 0, limit = 100) {
  const absMinChange = Math.abs(minChange);
  return this.find({
    isActive: true,
    $expr: { $gte: [{ $abs: "$changePct" }, absMinChange] }
  })
  .sort({ changePct: -1 })
  .limit(limit);
};

liveQuoteSchema.statics.getTopGainers = function(limit = 50) {
  return this.find({ isActive: true, changePct: { $gt: 0 } })
    .sort({ changePct: -1 })
    .limit(limit);
};

liveQuoteSchema.statics.getTopLosers = function(limit = 50) {
  return this.find({ isActive: true, changePct: { $lt: 0 } })
    .sort({ changePct: 1 }) // ASC to get biggest losers first
    .limit(limit);
};

liveQuoteSchema.statics.clearOldData = function(hoursOld = 24) {
  const cutoffDate = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));
  return this.deleteMany({ fetchedAt: { $lt: cutoffDate } });
};

// Instance methods
liveQuoteSchema.methods.updateQuote = function(newData) {
  this.ltp = newData.ltp || this.ltp;
  this.prevClose = newData.prevClose || this.prevClose;
  this.changePct = newData.changePct || this.changePct;
  this.changeAmt = newData.changeAmt || this.changeAmt;
  this.volume = newData.volume || this.volume;
  this.dayHigh = newData.dayHigh || this.dayHigh;
  this.dayLow = newData.dayLow || this.dayLow;
  this.fetchedAt = new Date();
  this.source = newData.source || 'm1_engine';
  return this.save();
};

module.exports = mongoose.model("LiveQuote", liveQuoteSchema);