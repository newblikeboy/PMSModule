"use strict";

const mongoose = require("mongoose");
const { env } = require("./env");

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000
    });
    isConnected = true;
    console.log("[DB] MongoDB connected");
    return mongoose.connection;
  } catch (err) {
    console.error("[DB] Connection error:", err.message);
    throw err;
  }
}

module.exports = {
  connectDB
};

