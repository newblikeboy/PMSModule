// controllers/subscription.controller.js
"use strict";

const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");

const PLAN_PRICING = {
  monthly: { amount: 1000, label: "Monthly" },
  quarterly: { amount: 2100, label: "Quarterly" },
  yearly: { amount: 6000, label: "Yearly" }
};

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
      planTier: u.planTier || u.plan,
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

    const planType = String(req.body?.planType || "monthly").toLowerCase();
    const planInfo = PLAN_PRICING[planType];
    if (!planInfo) {
      return res.status(400).json({ ok: false, error: "Invalid plan type" });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({
        ok: false,
        error: "Razorpay keys not configured on the server"
      });
    }

    const amountPaise = Math.round(planInfo.amount * 100);
    const payload = {
      amount: amountPaise,
      currency: "INR",
      receipt: `qp_${planType}_${Date.now()}`,
      payment_capture: 1,
      notes: {
        planType,
        userId: u._id.toString()
      }
    };

    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const orderResp = await axios.post("https://api.razorpay.com/v1/orders", payload, {
      headers: { Authorization: authHeader }
    });
    const order = orderResp?.data;

    res.json({
      ok: true,
      planType,
      label: planInfo.label,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      keyId
    });
  } catch (err) {
    console.error("[subscription] createUpgradeIntent error:", err?.response?.data || err?.message || err);
    res.status(500).json({ ok: false, error: "Failed to create Razorpay order" });
  }
};

/**
 * POST /user/plan/confirm
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType }
 */
exports.confirmUpgrade = async (req, res, next) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      planType
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid payment confirmation payload" });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ ok: false, error: "Razorpay secret missing" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      return res.status(400).json({ ok: false, error: "Signature verification failed" });
    }

    req.user.plan = "paid";
    if (planType && PLAN_PRICING[planType]) {
      req.user.planTier = planType;
    } else if (!req.user.planTier) {
      req.user.planTier = "monthly";
    }
    await req.user.save();

    res.json({
      ok: true,
      plan: req.user.plan,
      planTier: req.user.planTier,
      message: "Subscription upgraded to Paid."
    });
  } catch (err) {
    console.error("[subscription] confirmUpgrade error:", err?.message || err);
    res.status(500).json({ ok: false, error: "Failed to confirm payment" });
  }
};
