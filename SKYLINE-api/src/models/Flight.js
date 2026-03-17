const mongoose = require("mongoose");

const flightSchema = new mongoose.Schema({
  flightId: String,
  airlineId: mongoose.Schema.Types.ObjectId,
  airlineCode: String,
  airline: String,
  flightNo: String,
  from: String,
  to: String,
  fromAirportName: String,
  toAirportName: String,
  date: String,
  departTime: String,
  arriveTime: String,
  durationMin: Number,
  currency: String,
  priceEconomy: Number,
  priceBusiness: Number,
  seatsMax: Number,
  seatsBusinessMax: Number,
  seatsEconomyMax: Number,
  seatsBookedBusiness: Number,
  seatsBookedEconomy: Number,
  seatsBookedTotal: Number,
  revenueTotal: Number,
  stops: Number,
  stopsLabel: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Flight", flightSchema);