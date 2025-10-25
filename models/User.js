const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, required: true },
    phone: { type: String, trim: true },

    passwordHash: { type: String, required: true },

    plan: {
      type: String,
      enum: ["trial", "paid", "admin"],
      default: "trial"
    },

    broker: {
      connected: { type: Boolean, default: false },

      brokerName: {
        type: String,
        enum: ["", "ZERODHA", "ANGEL", "FYERS"],
        default: ""
      },

      creds: {
        apiKey: { type: String, default: "" },
        clientId: { type: String, default: "" },
        accessToken: { type: String, default: "" },
        refreshToken: { type: String, default: "" },
        note: { type: String, default: "" }
      }
    },

    autoTradingEnabled: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
