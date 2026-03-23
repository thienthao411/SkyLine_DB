require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const airportRoutes = require("./routes/airportRoutes");
const airlineRoutes = require("./routes/airlineRoutes");
const flightRoutes = require("./routes/flightRoutes");
const baggageOptionRoutes = require("./routes/baggageOptionRoutes");
const promotionRoutes = require("./routes/promotionRoutes");
const blogRoutes = require("./routes/blogRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const recruitmentRoutes = require("./routes/recruitmentRoutes");
const aiChatRoutes = require("./routes/aiChatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const supportRoutes = require("./routes/supportRoutes");
const notificationUserRoutes = require("./routes/notificationUserRoutes");

let isDbInitialized = false;

function ensureDbConnection() {
  if (isDbInitialized) {
    return;
  }

  isDbInitialized = true;
  connectDB().catch((error) => {
    console.error("MongoDB bootstrap error:", error?.message || error);
    isDbInitialized = false;
  });
}

function createApp() {
  ensureDbConnection();

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  app.use("/api/users", userRoutes);
  app.use("/api/airports", airportRoutes);
  app.use("/api/airlines", airlineRoutes);
  app.use("/api/flights", flightRoutes);
  app.use("/api/promotions", promotionRoutes);
  app.use("/api/baggageoptions", baggageOptionRoutes);
  app.use("/api/baggage-options", baggageOptionRoutes);
  app.use("/api/blogs", blogRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/recruitment", recruitmentRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/supports", supportRoutes);
  app.use("/api/notifications-user", notificationUserRoutes);
  app.use("/api/ai", aiChatRoutes);

  app.get("/", (req, res) => {
    res.send("Skyline API running");
  });

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  return app;
}

module.exports = {
  createApp,
};