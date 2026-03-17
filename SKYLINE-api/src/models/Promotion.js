const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema({
  title: String,
  icon: String,
  items: [{
    image: String,
    label: String,
    date: String,
    details: String,
    target: String,
    applyTime: {
      from: String,
      to: String
    },
    promoCode: String,
    maxDiscountAmount: Number,
    discountValueRaw: Number,
    flightRoutes: String,
    ticketClass: String,
    minTickets: Number,
    ruleType: String,
    additionalCondition: String,
    departureAirport: String,
    arrivalAirport: String,
    minOrderValue: Number,
    territory: String,
    applyCountType: String,
    applyChannel: String,
    customerTargetType: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Promotion", promotionSchema);