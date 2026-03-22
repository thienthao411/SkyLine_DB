const NotificationUser = require("../models/NotificationUser");

exports.getNotifications = async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "email is required" });
    }

    const notifications = await NotificationUser.find({ userEmail: email })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await NotificationUser.countDocuments({ userEmail: email, isRead: false });

    return res.json({ success: true, unreadCount, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await NotificationUser.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const email = String(req.body?.email || req.query?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: "email is required" });
    }

    await NotificationUser.updateMany({ userEmail: email, isRead: false }, { isRead: true });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
