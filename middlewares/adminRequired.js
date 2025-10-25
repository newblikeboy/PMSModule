// middlewares/adminRequired.js
"use strict";

const authRequired = require("./authRequired");

/*
 We compose:
 1) authRequired -> sets req.user if valid token
 2) adminRequired -> checks req.user.plan === "admin"
*/

module.exports = async function adminRequired(req, res, next) {
  // First run authRequired manually.
  // Because Express middleware can't await another middleware cleanly,
  // we'll just call it in code, not export chain.
  authRequired(req, res, async (err) => {
    if (err) return next(err);

    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    if (req.user.plan !== "admin") {
      return res.status(403).json({ ok: false, error: "Admin only" });
    }

    next();
  });
};
