// routes/angel.auth.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const authRequired = require("../middlewares/authRequired");
const angelPublisher = require("../services/angel.publisher.service");

/**
 * Step 1 → /auth/angel/login
 * Must be logged-in; saves userId in session; redirects to Angel login
 */
router.get("/auth/angel/login", authRequired, async (req, res) => {
  try {
    if (req.session && req.user?._id) {
      req.session.pendingBrokerConnect = {
        provider: "ANGEL",
        userId: req.user._id.toString(),
        createdAt: Date.now(),
      };
      await req.session.save(); // ensure session written before redirect
      console.log("💾 [Angel Login Route] Saved user in session:", req.user._id);
    }
    return angelPublisher.startLogin(req, res);
  } catch (err) {
    console.error("💥 [Angel Login Route Error]", err);
    return res.status(500).send("Failed to start Angel login");
  }
});

/**
 * Step 2 + 3 → /auth/angel/callback
 * Handles redirect from Angel → exchanges token → updates DB
 */
router.get("/auth/angel/callback", async (req, res) => {
  console.log("⚡ [Router] Received /auth/angel/callback request");
  return angelPublisher.handleCallback(req, res);
});

module.exports = router;
