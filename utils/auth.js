// utils/auth.js
"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES = "7d"; // 7 day session

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
      role: user.role,
      plan: user.plan,
      isAdmin: user.role === "Admin"
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
  verifyJwt,
};
