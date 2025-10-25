// middlewares/authRequired.js
"use strict";

const User = require("../models/User");
const { verifyJwt } = require("../utils/auth");

// expects Authorization: Bearer <token>
module.exports = async function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const parts = auth.split(" ");
    const token = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "No token" });
    }

    const decoded = verifyJwt(token);
    if (!decoded) {
      return res.status(401).json({ ok: false, error: "Bad token" });
    }

    const user = await User.findById(decoded.uid);
    if (!user) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    // attach user to request for downstream handlers
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
