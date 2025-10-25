// routes/report.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/report.controller");

// JSON summary + trades of TODAY
router.get("/daily", ctrl.getDailyReportJSON);

// CSV download for TODAY
router.get("/daily.csv", ctrl.getDailyReportCSV);

module.exports = router;
