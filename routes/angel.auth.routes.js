// routes/angel.auth.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const authRequired = require("../middlewares/authRequired");
const angelPublisher = require("../services/angel.publisher.service");

/**
 * /auth/angel/login → Redirects user to Angel login page
 * Must be logged in (authRequired middleware)
 */
router.get("/auth/angel/login", authRequired, async (req, res) => {
  // Optional: store session fallback for pop-up flows
  if (req.session) {
    req.session.pendingBrokerConnect = {
      provider: "ANGEL",
      userId: req.user._id.toString(),
      createdAt: Date.now(),
    };
  }
  return angelPublisher.startLogin(req, res);
});

/**
 * /auth/angel/callback → Angel redirects back here
 * Handles messy query parsing, token exchange, and DB update.
 */
router.get("/auth/angel/callback", (req, res) =>
  angelPublisher.handleCallback(req, res)
);

module.exports = router;
