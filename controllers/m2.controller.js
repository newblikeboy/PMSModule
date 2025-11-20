// controllers/m2.controller.js
const m2Service = require("../services/m2.service");

exports.runScan = async (req, res, next) => {
  try {
    const result = await m2Service.startM2Engine();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getSignals = async (req, res, next) => {
  try {
    const result = await m2Service.getLatestSignalsFromDB();
    res.json(result);
  } catch (err) {
    next(err);
  }
};
