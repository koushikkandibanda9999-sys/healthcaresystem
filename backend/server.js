/**
 * Healthcare Blockchain — Express Backend
 *
 * Start: node server.js   (development)
 *        NODE_ENV=production node server.js
 */

require("dotenv").config();
const express  = require("express");
const helmet   = require("helmet");
const cors     = require("cors");
const path     = require("path");
const { connectDB }   = require("./src/config/database");
const { apiLimiter }  = require("./src/middleware/rateLimiter");

const app = express();

// ── Security headers ──────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// ── Global rate limiter ───────────────────────────────────────
app.use("/api", apiLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth",           require("./src/routes/auth"));
app.use("/api/seed",           require("./src/routes/seed"));
app.use("/api/patients",       require("./src/routes/patients"));
app.use("/api/records",        require("./src/routes/records"));
app.use("/api/access-requests", require("./src/routes/access"));
app.use("/api/hospitals",      require("./src/routes/hospitals"));
app.use("/api/audit",          require("./src/routes/audit"));
app.use("/api/performance",    require("./src/routes/performance"));

// ── Health check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Error handler ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Healthcare Blockchain API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app; // for testing
