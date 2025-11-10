// routes/angel.auth.routes.js
"use strict";

const express = require("express");
const router = express.Router();

const authRequired = require("../middlewares/authRequired");
const angelPub = require("../services/angel.publisher.service");

// Require auth on login initiation (user must be logged in to start link flow).
router.get("/auth/angel/login", authRequired, angelPub.startLogin);
// Callback stays public because SmartAPI redirects without our Authorization header.
router.get("/auth/angel/callback", angelPub.handleCallback);

module.exports = router;
