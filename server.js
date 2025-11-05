"use strict";

const http = require("http");

const { createApp } = require("./app");
const { connectDB } = require("./config/db");
const { env } = require("./config/env");
const logger = require("./config/logger");
const { startScheduler, stopScheduler } = require("./scheduler");

let server;

async function bootstrap() {
  try {
    await connectDB();

    const app = createApp();
    server = http.createServer(app);

    server.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV },
        `Server running on http://127.0.0.1:${env.PORT}`
      );
      if (env.ENABLE_SCHEDULER) {
        startScheduler();
      }
    });
  } catch (err) {
    logger.error({ err }, "Fatal startup error");
    process.exit(1);
  }
}

function shutdown(signal) {
  logger.info({ signal }, "Shutdown signal received");
  stopScheduler();
  if (server) {
    server.close((err) => {
      if (err) {
        logger.error({ err }, "Error during server close");
        process.exit(1);
      }
      logger.info("HTTP server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  shutdown("uncaughtException");
});

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => shutdown(signal));
});

bootstrap();

