const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
  {
    notificationId: { type: String, default: "", unique: true, sparse: true, index: true },
    bookingId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, default: "" },
    email: { type: String, default: "", index: true },
    topic: { type: String, default: "" },
    content: { type: String, default: "" },
    status: {
      type: String,
      enum: ["new", "in_progress", "resolved"],
      required: true,
      default: "new",
      index: true,
    },
    adminNote: { type: String, default: "" },
    handledAt: { type: Date, default: null },
    sourceCreatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Support", supportSchema);
