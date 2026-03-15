const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    flightId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    flight: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    passengerInfo: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    seat: {
      type: String,
      required: true,
      trim: true,
    },
    seatType: {
      type: String,
      default: 'standard',
      trim: true,
    },
    baggageOption: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    payment: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      default: 'pending',
      trim: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

bookingSchema.index({ flightId: 1, seat: 1 }, { unique: true });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);