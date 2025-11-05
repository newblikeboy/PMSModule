"use strict";

const pino = require("pino");
const { isDevelopment } = require("./env");

const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  redact: {
    paths: ["req.headers.authorization", "req.body.password"],
    censor: "[REDACTED]"
  }
});

module.exports = logger;

