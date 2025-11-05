// models/User.js
"use strict";

const mongoose = require("mongoose");

const BrokerCredsSchema = new mongoose.Schema(
  {
    apiKey: { type: String, default: "" },
    clientId: { type: String, default: "" },
    accessToken: { type: String, default: "" },   // Angel Publisher JWT or other broker token
    refreshToken: { type: String, default: "" },  // if your broker supports refresh
    note: { type: String, default: "" }
  },
  { _id: false }
);

const BrokerSchema = new mongoose.Schema(
  {
    connected: { type: Boolean, default: false },

    // keep your original enum; ANGEL is required for Publisher flow
    brokerName: {
      type: String,
      enum: ["", "ANGEL"],
      default: ""
    },

    creds: { type: BrokerCredsSchema, default: () => ({}) }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ---- identity ----
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, required: true, index: true },
    phone: { type: String, trim: true },

    passwordHash: { type: String, required: true },
  
    password: { type: String, select: false },

    // ---- plan / roles ----
    plan: { type: String, enum: ["trial", "paid", "admin"], default: "trial" },
    planTier: { type: String, default: "trial" },

  
    broker: { type: BrokerSchema, default: () => ({}) },

  
    autoTradingEnabled: { type: Boolean, default: false },

    angelLiveEnabled: { type: Boolean, default: false },

    angelAllowedMarginPct: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  },
  { timestamps: true }
);



userSchema.set("toJSON", {
  transform: (doc, ret) => {
    // never leak secrets in API responses
    delete ret.password;
    delete ret.passwordHash;
    if (ret.broker && ret.broker.creds) {
      delete ret.broker.creds.accessToken;
      delete ret.broker.creds.refreshToken;
      delete ret.broker.creds.apiKey;
      delete ret.broker.creds.clientId;
      delete ret.broker.creds.note;
    }
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);
