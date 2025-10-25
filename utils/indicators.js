// utils/indicators.js
"use strict";

/**
 * candles array format we expect:
 * [
 *   [ts, open, high, low, close, volume],
 *   ...
 * ]
 *
 * We will compute RSI(14) on closing prices.
 */

function calcRSI14FromCandles(candles) {
  // Need at least ~15 candles for RSI(14)
  if (!candles || candles.length < 15) return null;

  // Take only close values
  const closes = candles.map(c => Number(Array.isArray(c) ? c[4] : c.close)).filter(v => !isNaN(v));
  if (closes.length < 15) return null;

  // Wilder's RSI (standard)
  const period = 14;
  let gains = 0;
  let losses = 0;

  // initial avg gain/loss
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += (-diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  // smooth further (if more than 15 points)
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    // no losses => RSI 100
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(2));
}

module.exports = {
  calcRSI14FromCandles
};
