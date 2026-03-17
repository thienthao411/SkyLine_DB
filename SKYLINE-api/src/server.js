// filepath: d:\Năm 3\Học kỳ 1\PT WEB\Angular_Ex\SKYLINE\SKYLINE-api\src\server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const airlineRoutes = require("./routes/airlineRoutes");
const flightRoutes = require("./routes/flightRoutes");
const promotionRoutes = require("./routes/promotionRoutes");
const ticketRoutes = require("./routes/ticketRoutes");

const app = express();

console.log("SERVER FILE:", __filename);
console.log("Loading routes...");

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/airlines", airlineRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/tickets", ticketRoutes);

app.get("/", (req, res) => {
  res.send("Skyline API running");
});

// Thêm log để debug
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// filepath: d:\Năm 3\Học kỳ 1\PT WEB\Angular_Ex\SKYLINE\SKYLINE-api\src\controllers\userController.js
exports.createUser = async (req, res) => {
  try {
    console.log('=== Creating User ===');
    console.log('Request body:', req.body);
    
    const user = new User(req.body);
    console.log('User object created:', user);
    
    const savedUser = await user.save();
    console.log('User saved successfully:', savedUser);
    
    res.status(201).json(savedUser);
  } catch (error) {
    console.error('=== Error Creating User ===');
    console.error('Error message:', error.message);
    console.error('Error details:', error);
    res.status(500).json({ error: error.message });
  }
};

