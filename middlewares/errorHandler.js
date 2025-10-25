function errorHandler(err, req, res, _next) {
  console.error("[Error]", err);
  res.status(500).json({ ok: false, error: err.message || String(err) });
}
module.exports = errorHandler;
