const mongoose = require("mongoose");

function normalizeSeatCode(value) {
  const compact = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!compact) return "";

  const letterFirst = compact.match(/^([A-Z])(\d{1,2})$/);
  if (letterFirst) {
    const [, column, row] = letterFirst;
    return `${column}${row.padStart(2, "0")}`;
  }

  const rowFirst = compact.match(/^(\d{1,2})([A-Z])$/);
  if (rowFirst) {
    const [, row, column] = rowFirst;
    return `${column}${row.padStart(2, "0")}`;
  }

  return compact;
}

const ticketSchema = new mongoose.Schema({
  ticketCode: String,
  seatType: String,
  userId: mongoose.Schema.Types.ObjectId,
  flightId: mongoose.Schema.Types.ObjectId,
  flight: mongoose.Schema.Types.Mixed,
  passengerInfo: mongoose.Schema.Types.Mixed,
  baggageOption: mongoose.Schema.Types.Mixed,
  payment: mongoose.Schema.Types.Mixed,
  promotionId: mongoose.Schema.Types.ObjectId,
  seat: {
    type: String,
    set: normalizeSeatCode,
  },
  status: String,
  paymentStatus: String,
  price: Number,
  totalAmount: Number,
  paymentMethod: String,
  transactionId: String,
  bookingDate: String,
  departure: String,
  arrival: String,
  fare: mongoose.Schema.Types.Mixed,
  baggage: mongoose.Schema.Types.Mixed,
  totalPrice: Number,
  phone: String,
  email: String,
  complaint: Boolean,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Ticket", ticketSchema);
