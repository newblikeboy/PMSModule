"use strict";
const dotenv = require("dotenv");
dotenv.config(); // load .env if present

const express = require("express");
const morgan = require("morgan");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const connectDB = require("./config/db");
const m1Routes = require("./routes/m1.routes");
const m2Routes = require("./routes/m2.routes");
const tradeRoutes = require("./routes/trade.routes");
const reportRoutes = require("./routes/report.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const fyersRoutes = require("./routes/fyers.routes");
const errorHandler = require("./middlewares/errorHandler");
const { startScheduler } = require("./scheduler");

const app = express();

// ------------------------------
// 🔌  Middleware setup
// ------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ------------------------------
// 💾 Express Session Configuration
// ------------------------------
// ✅ Using connect-mongo to persist sessions across redirects
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dfhksjafh93478fhcwgobnlzs836ybx",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 86400, // 1 day
      autoRemove: "native",
    }),
    cookie: {
      httpOnly: true,
      secure: false, // set true in production HTTPS
      sameSite: "lax", // ✅ important for Angel callback to keep session
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// ------------------------------
// 🧠 Connect DB
// ------------------------------
connectDB();

// ------------------------------
// 🌐 Serve frontend
// ------------------------------
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------
// 🧭 Routes
// ------------------------------
app.use("/m1", m1Routes);
app.use("/m2", m2Routes);
app.use("/trade", tradeRoutes);
app.use("/report", reportRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/fyers", fyersRoutes);

// ---- ✅ Angel Publisher integration ----
app.use("/", require("./routes/angel.auth.routes")); // /auth/angel/login + /auth/angel/callback

// ------------------------------
// 🧩 Testing Purpose - Live Tick Data Stream
// ------------------------------
const m1Service = require("./services/m1.service"); // adjust path to match your project

app.get("/api/socket-stream", (req, res) => {
  try {
    if (m1Service && typeof m1Service._getLtpSnapshot === "function") {
      const snapshot = m1Service._getLtpSnapshot() || [];
      return res.json(snapshot.slice(-50));
    }

    if (global.ltpMap && typeof global.ltpMap.entries === "function") {
      const arr = Array.from(global.ltpMap.entries()).map(([symbol, ltp]) => ({
        symbol,
        ltp: Number(ltp),
        ts: Date.now(),
      }));
      return res.json(arr.slice(-50));
    }

    const msg =
      "No ltp snapshot available. Export _getLtpSnapshot() from m1 service or set global.ltpMap = ltpMap.";
    console.warn("/api/socket-stream:", msg);
    return res.status(500).json({ error: msg });
  } catch (err) {
    console.error("/api/socket-stream error:", err?.stack || err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// ------------------------------
// ⚠️ Error handler
// ------------------------------
app.use(errorHandler);

// ------------------------------
// 🚀 Server Startup
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
  console.log(`📊 Dashboard: http://127.0.0.1:${PORT}/dashboard.html`);
  startScheduler();
});
