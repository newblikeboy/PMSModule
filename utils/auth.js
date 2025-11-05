// utils/auth.js
"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { env } = require("../config/env");

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES = env.JWT_EXPIRES_IN;

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signJwt(user) {
  // only minimal safe payload
  return jwt.sign(
    {
      uid: user._id.toString(),
      plan: user.plan,
      isAdmin: user.plan === "admin"
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  signJwt,
  verifyJwt
};
