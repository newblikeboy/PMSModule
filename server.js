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
const PaperTrade = require("./models/PaperTrade");
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

// ========================================
// 🧩 Live Market Ticks Stream (Server-Sent Events)
// ========================================
const activeLiveTickClients = new Set();
const marketSocket = require("./services/marketSocket.service");

app.get("/api/live-market-ticks", async (req, res) => {
  // Check authentication - session or token query param
  let userId = req.session?.userId;
  
  // If no session, check token in query parameter (for EventSource compatibility)
  if (!userId && req.query.token) {
    try {
      const jwtDecoded = require('jsonwebtoken').verify(
        req.query.token,
        process.env.JWT_SECRET || 'dfhksjafh93478fhcwgobnlzs836ybx'
      );
      userId = jwtDecoded.userId || jwtDecoded.uid || jwtDecoded.id;
    } catch (err) {
      console.warn("Invalid token for live-market-ticks");
    }
  }

  if (!userId) {
    res.writeHead(401, { 'Content-Type': 'text/event-stream' });
    res.end("data: {\"error\": \"Unauthorized\"}\n\n");
    return;
  }

  // Setup SSE headers for streaming
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const ownerId = `sse-${userId || "anon"}-${Date.now()}`;
  let trackedSymbols = new Set();
  let heartbeat = null;
  let cleaned = false;
  let syncTimer = null;

  async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    if (syncTimer) clearInterval(syncTimer);
    if (heartbeat) clearInterval(heartbeat);
    marketSocket.off('tick', handleTick);
    if (trackedSymbols.size) {
      try { await marketSocket.unsubscribe(Array.from(trackedSymbols), ownerId); }
      catch (err) { console.warn("Failed to unsubscribe SSE symbols:", err.message); }
    }
    activeLiveTickClients.delete(sendTick);
    res.end();
  }

  const sendTick = (tick) => {
    try {
      res.write(`data: ${JSON.stringify(tick)}\n\n`);
    } catch (err) {
      cleanup().catch((e) => console.warn("SSE cleanup error:", e.message));
    }
  };

  activeLiveTickClients.add(sendTick);

  async function syncSymbols() {
    try {
      const openTrades = await PaperTrade.find({ status: "OPEN" }).select("symbol").lean();
      const latest = new Set(openTrades.map((t) => t.symbol).filter(Boolean));

      const toAdd = [];
      const toRemove = [];

      latest.forEach((sym) => {
        if (!trackedSymbols.has(sym)) toAdd.push(sym);
      });
      trackedSymbols.forEach((sym) => {
        if (!latest.has(sym)) toRemove.push(sym);
      });

      if (toAdd.length) await marketSocket.subscribe(toAdd, ownerId);
      if (toRemove.length) await marketSocket.unsubscribe(toRemove, ownerId);

      trackedSymbols = latest;
    } catch (err) {
      console.warn("Failed to sync live tick symbols:", err.message);
    }
  }

  await syncSymbols();
  syncTimer = setInterval(syncSymbols, 5000);

  const handleTick = (tick) => {
    if (!trackedSymbols.has(tick.symbol)) return;
    sendTick({
      symbol: tick.symbol,
      ltp: tick.ltp,
      ts: tick.ts,
      source: 'live'
    });
  };

  marketSocket.on('tick', handleTick);

  req.on('close', () => {
    cleanup().catch((err) => console.warn("SSE cleanup error:", err.message));
  });

  // Send heartbeat every 30s to keep connection alive
  heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (err) {
      cleanup().catch((e) => console.warn("SSE cleanup error:", e.message));
    }
  }, 30000);
});

// ------------------------------
// ⚠️ Error handler
// ------------------------------
app.use(errorHandler);

// ------------------------------
// 🚀 Server Startup
// ------------------------------
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
    console.log(`📊 Dashboard: http://127.0.0.1:${PORT}/dashboard.html`);
    startScheduler();
  });
}

module.exports = app;
