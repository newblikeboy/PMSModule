const dotenv = require("dotenv");
dotenv.config(); // load .env if present
const express = require("express");
const morgan = require("morgan");
const path = require("path");

const connectDB = require("./config/db");
const m1Routes = require("./routes/m1.routes");
const errorHandler = require("./middlewares/errorHandler");
const m2Routes = require("./routes/m2.routes");
const tradeRoutes = require("./routes/trade.routes");
const { startScheduler } = require("./scheduler");
const reportRoutes = require("./routes/report.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const fyersRoutes = require("./routes/fyers.routes");

const app = express();
app.use(express.json());
app.use(morgan("dev"));

// DB connect
connectDB();

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use(express.json()); // <-- CRITICAL
app.use(express.urlencoded({ extended: true })); // <-- good to have
app.use("/m1", m1Routes);
app.use("/m2", m2Routes);
app.use("/trade", tradeRoutes);
app.use("/report", reportRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/fyers", fyersRoutes);

//Testing Purpose - Live Tick Data Stream
// server.js (or routes file)
const m1Service = require("./services/m1.service"); // adjust path to match your project

app.get("/api/socket-stream", (req, res) => {
  try {
    // Prefer exported snapshot if available
    if (m1Service && typeof m1Service._getLtpSnapshot === "function") {
      const snapshot = m1Service._getLtpSnapshot() || [];
      return res.json(snapshot.slice(-50));
    }

    // Fallback: try global.ltpMap (if you set that)
    if (global.ltpMap && typeof global.ltpMap.entries === "function") {
      const arr = Array.from(global.ltpMap.entries()).map(([symbol, ltp]) => ({
        symbol,
        ltp: Number(ltp),
        ts: Date.now()
      }));
      return res.json(arr.slice(-50));
    }

    // No source found — return helpful dev error (500)
    const msg = "No ltp snapshot available. Export _getLtpSnapshot() from m1 service or set global.ltpMap = ltpMap.";
    console.warn("/api/socket-stream:", msg);
    return res.status(500).json({ error: msg });
  } catch (err) {
    // log full stack for debugging
    console.error("/api/socket-stream error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});



// error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
  console.log(`📊 Dashboard: http://127.0.0.1:${PORT}/dashboard.html`);
  startScheduler();
});


