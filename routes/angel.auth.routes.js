// routes/angel.auth.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const authRequired = require("../middlewares/authRequired");
const angelPub = require("../services/angel.publisher.service");

// Require auth on both routes, so callback can fallback to req.user when state is missing.
router.get("/auth/angel/login", authRequired, angelPub.startLogin);
router.get("/auth/angel/callback", authRequired, angelPub.handleCallback);

module.exports = router;
