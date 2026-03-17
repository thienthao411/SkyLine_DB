const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  ticketCode: String,
  userId: mongoose.Schema.Types.ObjectId,
  flightId: mongoose.Schema.Types.ObjectId,
  promotionId: mongoose.Schema.Types.ObjectId,
  seat: String,
  status: String,
  price: Number,
  paymentMethod: String,
  transactionId: String,
  bookingDate: String,
  departure: String,
  arrival: String,
  phone: String,
  email: String,
  complaint: Boolean,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Ticket", ticketSchema);