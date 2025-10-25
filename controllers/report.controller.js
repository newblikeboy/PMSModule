// controllers/report.controller.js
const reportService = require("../services/report.service");

exports.getDailyReportJSON = async (req, res, next) => {
  try {
    const result = await reportService.buildDailyReport();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getDailyReportCSV = async (req, res, next) => {
  try {
    const { csv, filename } = await reportService.buildDailyReportCSV();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};
