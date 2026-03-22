const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  bookingId: { type: String, required: true, index: true },
  type: { type: String, required: true, default: "payment_verification" },
  supportRequest: {
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    topic: { type: String, default: "" },
    content: { type: String, default: "" },
    status: {
      type: String,
      enum: ["new", "in_progress", "resolved"],
      default: "new"
    },
    adminNote: { type: String, default: "" },
    handledAt: { type: Date, default: null }
  },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);
