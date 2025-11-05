"use strict";

const { config } = require("dotenv");
const { z } = require("zod");

config();

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGO_URI: z
    .string({ required_error: "MONGO_URI is required" })
    .min(1, "MONGO_URI cannot be empty"),
  JWT_SECRET: z
    .string()
    .min(12, "JWT_SECRET must be at least 12 characters")
    .optional(),
  FYERS_APP_ID: z.string().optional(),
  FYERS_APP_SECRET: z.string().optional(),
  FYERS_REDIRECT_URI: z.string().optional(),
  FYERS_API_BASE: z.string().optional(),
  FYERS_DATA_BASE: z.string().optional(),
  ANGEL_API_KEY: z.string().optional(),
  ANGEL_CLIENT_CODE: z.string().optional(),
  ANGEL_ACCESS_TOKEN: z.string().optional(),
  ANGEL_SOURCE_ID: z.string().optional(),
  ANGEL_CLIENT_LOCAL_IP: z.string().optional(),
  ANGEL_CLIENT_PUBLIC_IP: z.string().optional(),
  ANGEL_CLIENT_MAC: z.string().optional(),
  ANGEL_APP_VERSION: z.string().optional(),
  ANGEL_HTTP_TIMEOUT_MS: z.string().optional(),
  ANGEL_SYMBOL_TOKEN_MAP: z.string().optional(),
  TRADE_DEFAULT_QTY: z.string().optional(),
  M1_BATCH_SIZE: z.string().optional(),
  M1_MOVER_THRESHOLD_PCT: z.string().optional(),
  M1_SNAPSHOT_HOUR: z.string().optional(),
  M1_SNAPSHOT_MINUTE: z.string().optional(),
  JWT_EXPIRES_IN: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  ENABLE_SCHEDULER: z
    .string()
    .optional()
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[Env] Configuration validation failed:");
  parsed.error.errors.forEach((issue) => {
    console.error(`  - ${issue.path.join(".") || "root"}: ${issue.message}`);
  });
  process.exit(1);
}

const env = parsed.data;

if (!env.JWT_SECRET) {
  if (env.NODE_ENV === "production") {
    console.error("[Env] JWT_SECRET is required in production");
    process.exit(1);
  }
  env.JWT_SECRET = "dev_secret_change_this";
  console.warn("[Env] JWT_SECRET missing. Using development fallback secret.");
}

if (!env.MONGO_URI) {
  console.error("[Env] MONGO_URI is required");
  process.exit(1);
}

env.JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || "7d";
env.CORS = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["*"];
env.ENABLE_SCHEDULER = env.ENABLE_SCHEDULER
  ? ["1", "true", "yes"].includes(env.ENABLE_SCHEDULER.toLowerCase())
  : true;

module.exports = {
  env,
  isProduction: env.NODE_ENV === "production",
  isDevelopment: env.NODE_ENV === "development"
};
