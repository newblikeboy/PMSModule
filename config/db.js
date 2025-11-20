const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,  // 30 seconds for initial connection
      socketTimeoutMS: 45000,            // 45 seconds for socket operations
      maxPoolSize: 10,
      retryWrites: true,
      w: "majority"
    });
    console.log("[DB] MongoDB Connected ✅");
  } catch (err) {
    console.error("[DB] Connection Error ❌", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
