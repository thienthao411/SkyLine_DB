const Notification = require("../models/Notification");
const Support = require("../models/Support");
const { getIO } = require("../socket");

function emitAdminNotification(notification) {
  const io = getIO();
  if (!io) return;
  io.to("admins").emit("admin_notification_created", notification);
}

function parseSupportMessage(message) {
  const raw = String(message || "").trim();
  const matched = raw.match(/^\[(.*?)\]\s+(.*?)\s+\((.*?)\):\s*(.*)$/);

  if (!matched) {
    return {
      fullName: "",
      email: "",
      topic: "",
      content: raw,
    };
  }

  return {
    topic: String(matched[1] || "").trim(),
    fullName: String(matched[2] || "").trim(),
    email: String(matched[3] || "").trim().toLowerCase(),
    content: String(matched[4] || "").trim(),
  };
}

function normalizeSupportRequest(notification) {
  const parsed = parseSupportMessage(notification?.message);
  const support = notification?.supportRequest || {};

  return {
    ...notification,
    supportRequest: {
      fullName: String(support.fullName || parsed.fullName || "").trim(),
      email: String(support.email || parsed.email || "").trim().toLowerCase(),
      topic: String(support.topic || parsed.topic || "").trim(),
      content: String(support.content || parsed.content || "").trim(),
      status: ["new", "in_progress", "resolved"].includes(String(support.status || ""))
        ? support.status
        : "new",
      adminNote: String(support.adminNote || "").trim(),
      handledAt: support.handledAt || null,
    },
  };
}

function mapSupportToRequest(support) {
  const status = ["new", "in_progress", "resolved"].includes(String(support?.status || ""))
    ? support.status
    : "new";

  const notificationId = String(support?.notificationId || "").trim();
  const fallbackId = String(support?._id || "").trim();
  const id = notificationId || fallbackId;

  const topic = String(support?.topic || "").trim();
  const fullName = String(support?.fullName || "").trim();
  const email = String(support?.email || "").trim().toLowerCase();
  const content = String(support?.content || "").trim();

  return {
    _id: id,
    title: "Yêu cầu hỗ trợ mới",
    message: `[${topic}] ${fullName} (${email}): ${content}`,
    bookingId: String(support?.bookingId || "").trim(),
    type: "support_request",
    isRead: status !== "new",
    createdAt: support?.sourceCreatedAt || support?.createdAt || new Date(),
    supportRequest: {
      fullName,
      email,
      topic,
      content,
      status,
      adminNote: String(support?.adminNote || "").trim(),
      handledAt: support?.handledAt || null,
    },
  };
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
    const support = await Support.create({
      bookingId,
      fullName,
      email,
      topic,
      content,
      status: "new",
      adminNote: "",
      handledAt: null,
      sourceCreatedAt: new Date(),
    });

    const notification = await Notification.create({
      title: "Yêu cầu hỗ trợ mới",
      message: `[${topic}] ${fullName} (${email}): ${content}`,
      bookingId,
      type: "support_request",
      supportRequest: {
        fullName,
        email,
        topic,
        content,
        status: "new",
      },
      isRead: false,
      createdAt: new Date(),
    });

    await Support.findByIdAndUpdate(support._id, {
      $set: { notificationId: String(notification._id) }
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

exports.getSupportRequests = async (req, res) => {
  try {
    const statusFilter = String(req.query.status || "all").trim().toLowerCase();
    const supports = await Support.find(
      statusFilter === "all" ? {} : { status: statusFilter }
    )
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const requests = supports.map(mapSupportToRequest);

    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSupportRequestStatus = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const status = String(payload.status || "").trim().toLowerCase();
    const adminNote = String(payload.adminNote || "").trim();

    if (!["new", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái xử lý không hợp lệ." });
    }

    const current = await Support.findOne({
      $or: [{ notificationId: id }, { _id: id }, { bookingId: id }]
    }).lean();
    if (!current) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu hỗ trợ." });
    }

    const updated = await Support.findByIdAndUpdate(
      current._id,
      {
        $set: {
          status,
          adminNote,
          handledAt: status === "resolved" ? new Date() : null,
        },
      },
      { returnDocument: 'after' }
    ).lean();

    if (current.notificationId) {
      await Notification.findByIdAndUpdate(
        current.notificationId,
        {
          $set: {
            isRead: status !== "new",
            supportRequest: {
              fullName: String(updated.fullName || "").trim(),
              email: String(updated.email || "").trim().toLowerCase(),
              topic: String(updated.topic || "").trim(),
              content: String(updated.content || "").trim(),
              status,
              adminNote,
              handledAt: updated.handledAt || null,
            },
          },
        }
      );
    }

    return res.json({ success: true, request: mapSupportToRequest(updated) });
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
      { returnDocument: 'after' }
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
