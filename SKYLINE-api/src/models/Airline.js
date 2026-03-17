const mongoose = require("mongoose");

const airlineSchema = new mongoose.Schema({
  airlineCode: String,
  airlineName: String,
  country: String,
  hotline: String,
  commissionRate: Number,
  status: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Airline", airlineSchema);