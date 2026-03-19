const mongoose = require("mongoose");

const notificationUserSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  bookingId: { type: String, required: true, index: true },
  type: { type: String, required: true, default: "payment_status" },
  paymentStatus: { type: String, default: "" },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("NotificationUser", notificationUserSchema);
