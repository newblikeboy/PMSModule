// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/auth.controller");
const authRequired = require("../middlewares/authRequired");

router.post("/signup", ctrl.signup);
router.post("/login", ctrl.login);
router.get("/me", authRequired, ctrl.me);

module.exports = router;
