const Notification = require("../models/Notification");
const { getIO } = require("../socket");

function emitAdminNotification(notification) {
  const io = getIO();
  if (!io) return;
  io.to("admins").emit("admin_notification_created", notification);
}

exports.createSupportRequestNotification = async (req, res) => {
  try {
    const payload = req.body && typeof req.body === "object" ? req.body : {};

    const fullName = String(payload.fullName || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const topic = String(payload.topic || "").trim();
    const content = String(payload.message || "").trim();

    if (!fullName || !email || !topic || !content) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin yêu cầu hỗ trợ." });
    }

    const bookingId = `SUP${Date.now()}`;
    const notification = await Notification.create({
      title: "Yêu cầu hỗ trợ mới",
      message: `[${topic}] ${fullName} (${email}): ${content}`,
      bookingId,
      type: "support_request",
      isRead: false,
      createdAt: new Date(),
    });

    emitAdminNotification(notification.toObject());

    return res.status(201).json({
      success: true,
      bookingId,
      notification,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(30);
    const unreadCount = await Notification.countDocuments({ isRead: false });

    return res.json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, notification: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAllAsRead = async (_req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
