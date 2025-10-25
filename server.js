require("dotenv").config();
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

const app = express();
app.use(express.json());
app.use(morgan("dev"));

// DB connect
connectDB();

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// API routes

app.use("/m1", m1Routes);
app.use("/m2", m2Routes);
app.use("/trade", tradeRoutes);
app.use("/report", reportRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);


// error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
  console.log(`📊 Dashboard: http://127.0.0.1:${PORT}/dashboard.html`);
  startScheduler();
});


