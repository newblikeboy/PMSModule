"use strict";

module.exports = function notFound(_req, res) {
  res.status(404).json({
    ok: false,
    error: "Route not found"
  });
};

