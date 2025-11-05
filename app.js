"use strict";

const path = require("path");
const mongoose = require("mongoose");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const pinoHttp = require("pino-http");

const { env, isDevelopment } = require("./config/env");
const logger = require("./config/logger");

const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");

const m1Routes = require("./routes/m1.routes");
const m2Routes = require("./routes/m2.routes");
const tradeRoutes = require("./routes/trade.routes");
const reportRoutes = require("./routes/report.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const fyersRoutes = require("./routes/fyers.routes");

const m1Service = require("./services/m1.service");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url
        }),
        res: (res) => ({
          statusCode: res.statusCode
        })
      },
      customLogLevel: function (res, err) {
        if (res.statusCode >= 500 || err) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: function (_req, res) {
        return `request completed with status ${res.statusCode}`;
      },
      autoLogging: { ignorePaths: ["/health", "/ready"] }
    })
  );

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS.includes("*") ? "*" : env.CORS,
      credentials: true
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (isDevelopment) {
    app.use(morgan("dev"));
  }

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Too many requests, please try again later." }
  });

  app.use("/auth", authLimiter);

  app.use(express.static(path.join(__dirname, "public")));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      status: "healthy",
      uptime: process.uptime()
    });
  });

  app.get("/ready", (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const ready = dbState === 1;
    res.status(ready ? 200 : 503).json({
      ok: ready,
      status: ready ? "ready" : "degraded",
      dbState
    });
  });

  app.get("/api/socket-stream", (_req, res) => {
    try {
      if (m1Service && typeof m1Service._getLtpSnapshot === "function") {
        const snapshot = m1Service._getLtpSnapshot() || [];
        return res.json(snapshot.slice(-50));
      }

      if (global.ltpMap && typeof global.ltpMap.entries === "function") {
        const arr = Array.from(global.ltpMap.entries()).map(([symbol, ltp]) => ({
          symbol,
          ltp: Number(ltp),
          ts: Date.now()
        }));
        return res.json(arr.slice(-50));
      }

      const msg = "No LTP snapshot available.";
      return res.status(503).json({ ok: false, error: msg });
    } catch (err) {
      logger.error({ err }, "[socket-stream] failed");
      return res.status(500).json({ ok: false, error: "Failed to fetch stream snapshot" });
    }
  });

  app.use("/m1", m1Routes);
  app.use("/m2", m2Routes);
  app.use("/trade", tradeRoutes);
  app.use("/report", reportRoutes);
  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use("/admin", adminRoutes);
  app.use("/fyers", fyersRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

