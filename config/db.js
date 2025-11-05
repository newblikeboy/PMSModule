const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[DB] MongoDB Connected ✅");
  } catch (err) {
    console.error("[DB] Connection Error ❌", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
