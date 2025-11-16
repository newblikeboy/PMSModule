// utils/auth.js
"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_this";
const JWT_EXPIRES = "7d"; // 7 day session

// Encryption key for broker tokens - should be in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

const ALGORITHM = "aes-256-cbc";

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

/**
 * Encrypt sensitive data like broker tokens
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text in hex format
 */
function encrypt(text) {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY.slice(0, 32), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data like broker tokens
 * @param {string} encryptedText - Encrypted text in hex format
 * @returns {string} Decrypted plain text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return "";
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return "";
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY.slice(0, 32), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  hashPassword,
  comparePassword,
  signJwt,
  verifyJwt,
  encrypt,
  decrypt
};
