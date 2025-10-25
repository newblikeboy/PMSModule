// controllers/trade.controller.js
const tradeEngine = require("../services/tradeEngine.service");

exports.scanAndEnter = async (req, res, next) => {
  try {
    const result = await tradeEngine.autoEnterOnSignal();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// run exit checks (target / stop)
exports.checkExits = async (req, res, next) => {
  try {
    const result = await tradeEngine.checkOpenTradesAndUpdate();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.listTrades = async (req, res, next) => {
  try {
    const result = await tradeEngine.getAllTrades();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.closeManual = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await tradeEngine.closeTradeManual(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
