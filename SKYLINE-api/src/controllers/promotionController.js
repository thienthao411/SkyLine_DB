const Promotion = require("../models/Promotion");
const NotificationUser = require("../models/NotificationUser");
const User = require("../models/User");
const { getIO } = require("../socket");

const parseDateSafely = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsedNative = new Date(trimmed);
  if (!Number.isNaN(parsedNative.getTime())) return parsedNative;

  // Supports DD/MM/YYYY and DD-MM-YYYY from admin inputs.
  const normalized = trimmed.replace(/-/g, "/");
  const parts = normalized.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    const candidate = new Date(y, m - 1, d);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }

  return null;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildFeaturedItem = (promotionDoc, item, itemIndex, now) => {
  // Homepage must mirror the admin per-item toggle exactly.
  if (item?.isFeatured !== true) return null;

  const startDate = parseDateSafely(item?.startDate || item?.applyTime?.from);
  const endDate = parseDateSafely(item?.endDate || item?.applyTime?.to);

  const discountValueRaw = item?.discountValueRaw ?? item?.maxDiscountAmount ?? null;
  const discountRuleType = item?.ruleType === "percentage" ? "percentage" : "amount";

  return {
    id: `${promotionDoc._id}_${itemIndex}`,
    promotionId: String(promotionDoc._id),
    category: promotionDoc?.category || "special",
    itemIndex,
    image: item?.image || "",
    title: item?.label || promotionDoc?.title || "Khuyen mai",
    shortDescription: item?.details || "",
    discountValueRaw,
    discountRuleType,
    discountBadge:
      discountValueRaw === null || discountValueRaw === undefined
        ? "Uu dai"
        : discountRuleType === "percentage"
          ? `-${toNumber(discountValueRaw)}%`
          : `-${toNumber(discountValueRaw).toLocaleString("vi-VN")} VND`,
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    createdAt: promotionDoc?.createdAt || null,
    promoCode: item?.promoCode || "",
    target: item?.target || item?.customerTargetType || "all",
    applyChannel: item?.applyChannel || "all",
    isFeatured: true
  };
};

const getFeaturedItemsFromPromotions = (promotions, now) => {
  const featuredItems = [];

  for (const promotionDoc of promotions) {
    const items = Array.isArray(promotionDoc.items) ? promotionDoc.items : [];
    for (let index = 0; index < items.length; index += 1) {
      const mapped = buildFeaturedItem(promotionDoc, items[index], index, now);
      if (mapped) {
        featuredItems.push(mapped);
      }
    }
  }

  return featuredItems;
};

const pickPromotionHighlight = (promotionDoc) => {
  const items = Array.isArray(promotionDoc?.items) ? promotionDoc.items : [];
  if (items.length === 0) {
    return null;
  }

  const featuredIndex = items.findIndex((item) => item && item.isFeatured === true);
  if (featuredIndex >= 0) {
    return {
      item: items[featuredIndex],
      itemIndex: featuredIndex
    };
  }

  return {
    item: items[0],
    itemIndex: 0
  };
};

async function broadcastPromotionNotification(promotionDoc, mode = "created") {
  const promotionId = String(promotionDoc?._id || "").trim();
  if (!promotionId) {
    return;
  }

  const users = await User.find({
    email: { $exists: true, $ne: "" },
    status: { $ne: "inactive" }
  })
    .select("email")
    .lean();

  const emails = users
    .map((user) => String(user?.email || "").trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    return;
  }

  const highlight = pickPromotionHighlight(promotionDoc);
  const highlightItem = highlight?.item || null;
  const promotionItemId = highlightItem
    ? `${promotionId}_${Number(highlight?.itemIndex || 0)}`
    : promotionId;
  const promoTitle = String(highlightItem?.label || promotionDoc?.title || "Khuyến mãi Skyline").trim();
  const promoCode = String(highlightItem?.promoCode || "").trim();
  const title = mode === "updated" ? "Khuyến mãi vừa cập nhật" : "Khuyến mãi mới";
  const messagePrefix = mode === "updated" ? "Skyline vừa cập nhật" : "Skyline vừa có";
  const message = promoCode
    ? `${messagePrefix} khuyến mãi ${promoTitle} (mã: ${promoCode}).`
    : `${messagePrefix} khuyến mãi ${promoTitle}.`;

  const docs = emails.map((email) => ({
    userEmail: email,
    title,
    message,
    bookingId: promotionItemId,
    type: "promotion",
    paymentStatus: mode,
    isRead: false,
    createdAt: new Date()
  }));

  let createdNotifications = [];
  try {
    createdNotifications = await NotificationUser.insertMany(docs, { ordered: false });
  } catch (error) {
    if (Array.isArray(error?.insertedDocs)) {
      createdNotifications = error.insertedDocs;
    } else {
      throw error;
    }
  }

  const io = getIO();
  if (!io) {
    return;
  }

  for (const notification of createdNotifications) {
    const email = String(notification?.userEmail || "").trim().toLowerCase();
    if (!email) continue;
    io.to(`user:${email}`).emit("user_notification_created", notification.toObject ? notification.toObject() : notification);
  }
}

exports.getFeaturedPromotions = async (req, res) => {
  try {
    const sortBy = req.query.sortBy === "highestDiscount" ? "highestDiscount" : "newest";
    const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 4));
    const now = new Date();

    const promotions = await Promotion.find().lean();
    const featuredItems = getFeaturedItemsFromPromotions(promotions, now);

    featuredItems.sort((a, b) => {
      if (sortBy === "highestDiscount") {
        const discountDiff = toNumber(b.discountValueRaw) - toNumber(a.discountValueRaw);
        if (discountDiff !== 0) return discountDiff;
      }

      const aDate = parseDateSafely(a.startDate || a.createdAt)?.getTime() || 0;
      const bDate = parseDateSafely(b.startDate || b.createdAt)?.getTime() || 0;
      return bDate - aDate;
    });

    res.json(featuredItems.slice(0, limit));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFeaturedPromotionById = async (req, res) => {
  try {
    const now = new Date();
    const promotions = await Promotion.find().lean();
    const featuredItems = getFeaturedItemsFromPromotions(promotions, now);
    const found = featuredItems.find((item) => item.id === req.params.itemId);

    if (!found) {
      return res.status(404).json({ message: "Featured promotion not found" });
    }

    return res.json(found);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getPromotions = async (req, res) => {
  try {
    const promotions = await Promotion.find();
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPromotion = async (req, res) => {
  try {
    const promotion = new Promotion(req.body);
    const saved = await promotion.save();

    try {
      await broadcastPromotionNotification(saved, "created");
    } catch (notifyError) {
      console.error("Failed to broadcast promotion notifications:", notifyError);
    }

    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePromotion = async (req, res) => {
  try {
    const updated = await Promotion.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ message: 'Promotion not found' });

    try {
      await broadcastPromotionNotification(updated, "updated");
    } catch (notifyError) {
      console.error("Failed to broadcast promotion update notifications:", notifyError);
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePromotion = async (req, res) => {
  try {
    const deleted = await Promotion.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Promotion not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};