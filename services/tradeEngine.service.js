// services/tradeEngine.service.js
"use strict";

const PaperTrade = require("../models/PaperTrade");
const m2Service = require("./m2.service"); // for RSI + LTP data
const fy = require("./fyersSdk"); // for quotes() -> live LTP

// helper: fetch live LTP for a symbol using fy.getQuotes()
async function fetchLTP(symbol) {
    const resp = await fy.getQuotes(symbol);
    // FYERS quotes response shape can differ, so try some keys:
    const d = resp?.d || resp?.data || resp;
    if (Array.isArray(d) && d.length > 0) {
        // usually [{v:{lp:...}, n:"NSE:SBIN-EQ"}] or similar
        const tick = d[0];
        const price = tick.ltp || tick.c || tick.v?.lp || tick.v?.last_price || tick.v?.lp;
        return Number(price);
    }
    if (d && d.ltp) return Number(d.ltp);
    return null;
}

/**
 * Create a new paper trade if:
 * - RSI signal says inEntryZone = true
 * - we don't already have an OPEN trade for that symbol
 */
async function autoEnterOnSignal() {
    // run a fresh scan (M2)
    const scan = await m2Service.scanRSIEntryZone();
    if (!scan.ok || !scan.data || !scan.data.length) {
        return { ok: true, created: [], msg: "no signals" };
    }

    const createdTrades = [];

    for (const sig of scan.data) {
        if (!sig.inEntryZone) continue;

        const symbol = sig.symbol;
        const alreadyOpen = await PaperTrade.findOne({
            symbol,
            status: "OPEN"
        });

        if (alreadyOpen) {
            // trade already running, skip
            continue;
        }

        // Use LTP from scan if present, else fallback to fresh quotes
        let entryPrice = sig.ltp;
        if (!entryPrice) {
            entryPrice = await fetchLTP(symbol);
        }
        if (!entryPrice) {
            // can't reliably enter without price
            continue;
        }

        const qty = 1; // <- can make configurable later

        // Target +1.5%, Stop -0.75%
        const targetPrice = entryPrice * (1 + 1.5 / 100);
        const stopPrice = entryPrice * (1 - 0.75 / 100);

        const trade = await PaperTrade.create({
            symbol,
            entryPrice,
            qty,
            targetPrice,
            stopPrice,
            rsiAtEntry: sig.rsi,
            changePctAtEntry: sig.changePct,
            notes: "Auto-entry from RSI zone strategy"
        });

        // open the below code for real trading
        // const trade = await fy.place_order({
        //     symbol,
        //     qty,
        //     type: 2, // LIMIT / MARKET as per preference
        //     side: 1, // BUY
        //     productType: "INTRADAY",
        //     limitPrice: entryPrice,
        //     stopPrice,
        //     takeProfitPrice: targetPrice
        // });

        createdTrades.push(trade);
    }

    return { ok: true, created: createdTrades };
}

/**
 * Check all OPEN trades:
 * - get current LTP
 * - if LTP >= targetPrice → close as WIN
 * - if LTP <= stopPrice → close as LOSS
 */
async function checkOpenTradesAndUpdate() {
    const openTrades = await PaperTrade.find({ status: "OPEN" });
    const updated = [];

    for (const tr of openTrades) {
        const ltp = await fetchLTP(tr.symbol);
        if (!ltp) continue;

        let shouldClose = false;
        let exitReason = "";

        if (ltp >= tr.targetPrice) {
            shouldClose = true;
            exitReason = "TARGET";
        } else if (ltp <= tr.stopPrice) {
            shouldClose = true;
            exitReason = "STOPLOSS";
        }

        if (shouldClose) {
            const pnlAbs = (ltp - tr.entryPrice) * tr.qty;
            const pnlPct = ((ltp - tr.entryPrice) / tr.entryPrice) * 100;

            tr.exitPrice = ltp;
            tr.exitTime = new Date();
            tr.pnlAbs = pnlAbs;
            tr.pnlPct = pnlPct;
            tr.status = "CLOSED";
            tr.notes = exitReason;

            await tr.save();
            updated.push(tr);
        }
    }

    return { ok: true, closed: updated };
}

/**
 * Get trades list
 */
async function getAllTrades() {
    const trades = await PaperTrade.find().sort({ entryTime: -1 }).lean();
    return { ok: true, trades };
}

/**
 * Close a trade manually (force exit)
 */
async function closeTradeManual(tradeId) {
    const tr = await PaperTrade.findById(tradeId);
    if (!tr || tr.status === "CLOSED") {
        return { ok: false, error: "Trade not open / not found" };
    }

    const ltp = await fetchLTP(tr.symbol);
    const exitPx = ltp || tr.entryPrice;

    const pnlAbs = (exitPx - tr.entryPrice) * tr.qty;
    const pnlPct = ((exitPx - tr.entryPrice) / tr.entryPrice) * 100;

    tr.exitPrice = exitPx;
    tr.exitTime = new Date();
    tr.pnlAbs = pnlAbs;
    tr.pnlPct = pnlPct;
    tr.status = "CLOSED";
    tr.notes = "MANUAL";

    await tr.save();
    return { ok: true, trade: tr };
}

module.exports = {
    autoEnterOnSignal,
    checkOpenTradesAndUpdate,
    getAllTrades,
    closeTradeManual
};
