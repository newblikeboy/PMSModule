const mongoose = require("mongoose");

const moverSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  prevClose: Number,
  ltp: Number,
  changePct: Number,
  moverDate: { type: String, index: true },  // YYYY-MM-DD format
  capturedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("M1Mover", moverSchema);
