"use strict";

const express = require("express");
const router = express.Router();
const angelPublisher = require("../services/angel.publisher.service");

// 1️⃣ Start Angel login
router.get("/auth/angel/login", angelPublisher.startLogin);

// 2️⃣ Handle Angel callback (stateless)
router.get("/auth/angel/callback", angelPublisher.handleCallback);

module.exports = router;
