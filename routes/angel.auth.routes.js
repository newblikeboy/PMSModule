"use strict";

const express = require("express");
const router = express.Router();

const authRequired = require("../middlewares/authRequired");
const angelPublisher = require("../services/angel.publisher.service");

// Authed users can request a redirect (optional helper)
router.get("/auth/angel/login", authRequired, angelPublisher.startLogin);

// Angel redirects browser here (popup or same tab)
router.get("/auth/angel/callback", angelPublisher.handleCallback);

module.exports = router;

