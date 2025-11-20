const service = require("../services/m1.service");

exports.start = async (req, res, next) => {
  try { res.json(await service.startEngine()); }
  catch (err) { next(err); }
};

exports.stop = async (req, res, next) => {
  try { res.json(await service.stopEngine()); }
  catch (err) { next(err); }
};

exports.movers = async (req, res, next) => {
  try { res.json(await service.getMovers()); }
  catch (err) { next(err); }
};

exports.status = (req, res) => {
  res.json({
    ok: true,
    message: "M1 Engine operational. Use /m1/movers to get today's movers."
  });
};
