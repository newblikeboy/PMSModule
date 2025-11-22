// controllers/auth.controller.js
"use strict";

const User = require("../models/User");
const { hashPassword, comparePassword, signJwt } = require("../utils/auth");

exports.signup = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email & password required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok: false, error: "User already exists" });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: "User",
      plan: "Free",
      broker: { connected: false, brokerName: "", note: "Not connected" },
      autoTradingEnabled: false
    });

    const token = signJwt(user);

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        plan: user.plan,
        broker: user.broker,
        autoTradingEnabled: user.autoTradingEnabled
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const okPass = await comparePassword(password, user.passwordHash);
    if (!okPass) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = signJwt(user);

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        plan: user.plan,
        broker: user.broker,
        autoTradingEnabled: user.autoTradingEnabled
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    // req.user set by authMiddleware
    const u = req.user;
    if (!u) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    res.json({
      ok: true,
      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        plan: u.plan,
        broker: u.broker,
        autoTradingEnabled: u.autoTradingEnabled
      }
    });
  } catch (err) {
    next(err);
  }
};
