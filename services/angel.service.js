"use strict";

/**
 * Replace stubs with real Angel One SDK calls.
 * Required by tradeEngine:
 *  - getFunds(userId): { availableMargin: number }
 *  - placeMarketOrder({ symbol, qty, side, userId }): { ok, orderId?, avgPrice? }
 *  - closePositionMarket({ symbol, qty, side, userId }): { ok, orderId?, avgPrice? }
 */

async function getFunds(userId = "default") {
  // TODO: call Angel "Get Funds" endpoint for this user
  return { availableMargin: 0 };
}

async function placeMarketOrder({ symbol, qty, side, userId = "default" }) {
  // TODO: map to Angel tradingsymbol & place MARKET order
  // return shape below
  return { ok: true, orderId: "ANGEL-" + Date.now(), avgPrice: undefined };
}

async function closePositionMarket({ symbol, qty, side = "SELL", userId = "default" }) {
  // TODO: call Angel close position (or SELL market)
  return placeMarketOrder({ symbol, qty, side, userId });
}

module.exports = { getFunds, placeMarketOrder, closePositionMarket };
