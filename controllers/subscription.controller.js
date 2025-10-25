// controllers/subscription.controller.js
"use strict";

const User = require("../models/User");

/**
 * GET /user/plan/status
 * returns user's current plan
 */
exports.getStatus = async (req, res, next) => {
  try {
    const u = req.user;
    res.json({
      ok: true,
      plan: u.plan,
      canAutoTrade: u.plan === "paid" && u.autoTradingEnabled === true,
      message:
        u.plan === "paid"
          ? "You are on Paid Plan."
          : (u.plan === "admin"
              ? "Admin access."
              : "You are on Trial. Upgrade to unlock automation.")
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /user/plan/upgrade-intent
 * This would normally create a payment order (Razorpay/Stripe).
 * For now we just simulate "₹1999/month" plan.
 */
exports.createUpgradeIntent = async (req, res, next) => {
  try {
    const u = req.user;

    // If already paid, no need to create
    if (u.plan === "paid" || u.plan === "admin") {
      return res.json({
        ok: true,
        alreadyPaid: true,
        plan: u.plan,
        message: "You already have paid access."
      });
    }

    // In real life:
    //  - create Razorpay order or Stripe checkout session
    //  - return paymentRef / checkoutURL
    // For demo MVP we just mock it:
    const mockPaymentRef = "PAY_" + Date.now();

    res.json({
      ok: true,
      amountINR: 1999,
      currency: "INR",
      description: "QuantPulse Monthly Plan",
      paymentRef: mockPaymentRef,
      message:
        "Payment intent created. Complete payment to activate Paid Plan."
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /user/plan/confirm
 * Body: { paymentRef }
 * This is where you'd verify payment from Razorpay webhook/receipt.
 * We'll trust the frontend for now (demo mode).
 */
exports.confirmUpgrade = async (req, res, next) => {
  try {
    const { paymentRef } = req.body;
    if (!paymentRef) {
      return res
        .status(400)
        .json({ ok: false, error: "paymentRef required" });
    }

    // TODO: verify paymentRef with payment provider
    // For MVP we assume payment succeeded.

    req.user.plan = "paid";
    await req.user.save();

    res.json({
      ok: true,
      plan: req.user.plan,
      message: "Subscription upgraded to Paid."
    });
  } catch (err) {
    next(err);
  }
};
