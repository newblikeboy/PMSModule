// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middlewares/validate");
const { signupSchema, loginSchema } = require("../validators/auth.validators");
const ctrl = require("../controllers/auth.controller");
const authRequired = require("../middlewares/authRequired");

router.post("/signup", validate(signupSchema), ctrl.signup);
router.post("/login", validate(loginSchema), ctrl.login);
router.get("/me", authRequired, ctrl.me);

module.exports = router;
