// filepath: d:\NÄƒm 3\Há»c ká»³ 1\PT WEB\Angular_Ex\SKYLINE\SKYLINE-api\src\server.js
require("dotenv").config();

const http = require("http");
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

const notificationRoutes = require("./routes/notificationRoutes");
const notificationUserRoutes = require("./routes/notificationUserRoutes");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

console.log("SERVER FILE:", __filename);
console.log("Loading routes...");

connectDB();
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
app.use("/api/notifications-user", notificationUserRoutes);

app.get("/", (req, res) => {
  res.send("Skyline API running");
});

// ThÃªm log Ä‘á»ƒ debug
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 5000;
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
