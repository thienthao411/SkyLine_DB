const crypto = require("crypto");

const Flight = require("../models/Flight");
const Ticket = require("../models/Ticket");
const Promotion = require("../models/Promotion");
const Airport = require("../models/Airport");
const Airline = require("../models/Airline");
const Blog = require("../models/Blog");
const RecruitmentJob = require("../models/RecruitmentJob");
const User = require("../models/User");
const localSkylineDataService = require("./localSkylineDataService");
const { detectPolicyIntent, getPolicyAnswer, getRelatedQuestions } = require("./cskhKnowledge");

const MAX_SESSION_MESSAGES = 40;
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const DEFAULT_PROVIDER = String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
const CHAT_STOP_WORDS = new Set([
  "toi", "minh", "cho", "xem", "giup", "duoc", "khong", "nhe", "la", "va", "co", "bao", "nhieu",
  "thong", "tin", "ve", "cua", "trong", "he", "thong", "skyline", "danh", "sach", "cac", "nhung", "vui",
  "long", "kiem", "tra", "tim", "the", "nao", "sao", "nay", "kia", "day", "voi", "den", "tu", "mot"
]);

const sessions = new Map();

function now() {
  return Date.now();
}

function cleanupExpiredSessions() {
  const ts = now();
  for (const [id, session] of sessions.entries()) {
    if (!session || ts - Number(session.updatedAt || 0) > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

function ensureSession(sessionId) {
  cleanupExpiredSessions();
  const id = String(sessionId || "").trim() || crypto.randomUUID();
  const existing = sessions.get(id);

  if (existing) {
    existing.updatedAt = now();
    return { id, session: existing };
  }

  const created = { messages: [], updatedAt: now() };
  sessions.set(id, created);
  return { id, session: created };
}

function trimSessionMessages(messages) {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= MAX_SESSION_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_SESSION_MESSAGES);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function summarizeFlight(flight) {
  const route = `${String(flight.from || "").toUpperCase()} -> ${String(flight.to || "").toUpperCase()}`;
  const schedule = `${flight.date || "N/A"} ${flight.departTime || ""}`.trim();
  const flightNo = String(flight.flightNo || "N/A").trim();
  const airline = String(flight.airline || flight.airlineCode || "N/A").trim();
  const economy = Number(flight.priceEconomy || 0);
  const business = Number(flight.priceBusiness || 0);
  return `${flightNo} | ${airline} | ${route} | ${schedule} | Eco ${economy} VND | Biz ${business} VND`;
}

function summarizePromotion(item) {
  const code = String(item?.promoCode || "").trim() || "N/A";
  const label = String(item?.label || item?.details || "Khuyen mai").trim();
  const period = `${String(item?.startDate || "").trim()} - ${String(item?.endDate || "").trim()}`.trim();
  return `${label} | Code: ${code} | Thoi gian: ${period || "N/A"}`;
}

function createRealtimeContextText(context) {
  const parts = [
    "Ngữ cảnh dữ liệu realtime (Skyline):",
    `- Hãng bay đang hoạt động: ${context.activeAirlineCount}`,
    `- Sân bay đang hoạt động: ${context.activeAirportCount}`,
    `- Tổng số vé: ${context.totalTicketCount}`,
    `- Vé đã thanh toán: ${context.paidTicketCount}`,
    `- Vé thanh toán thất bại: ${context.failedTicketCount}`,
  ];

  if (context.recentFlights.length) {
    parts.push("- Chuyến bay gần đây:");
    context.recentFlights.forEach((line) => parts.push(`  * ${line}`));
  }

  if (context.activePromotions.length) {
    parts.push("- Khuyến mãi đang hoạt động:");
    context.activePromotions.forEach((line) => parts.push(`  * ${line}`));
  }

  if (context.ticketLookup) {
    parts.push(`- Tra cứu vé ${context.ticketLookup.code}: ${context.ticketLookup.summary}`);
  }

  return parts.join("\n");
}

function localizeTicketStatus(value) {
  const normalized = normalizeText(value);
  if (/confirmed|xac nhan|da xac nhan/.test(normalized)) return "Đã xác nhận";
  if (/pending|cho xu ly|dang xu ly/.test(normalized)) return "Đang xử lý";
  if (/cancelled|canceled|da huy|huy/.test(normalized)) return "Đã hủy";
  if (/used|da su dung|hoan tat/.test(normalized)) return "Đã sử dụng";
  return String(value || "Không xác định");
}

function localizePaymentStatus(value) {
  const normalized = normalizeText(value);
  if (/paid|da thanh toan|success/.test(normalized)) return "Đã thanh toán";
  if (/pending|cho thanh toan/.test(normalized)) return "Chờ thanh toán";
  if (/failed|that bai|payment failed/.test(normalized)) return "Thanh toán thất bại";
  if (/refunded|hoan tien/.test(normalized)) return "Đã hoàn tiền";
  return String(value || "Không xác định");
}

function buildSystemPrompt(realtimeContext, groundedContext = "", policyContext = "") {
  return [
    "You are Skyline's AI customer service assistant for a Vietnamese flight booking platform.",
    "Your role: Friendly, professional customer service representative helping customers with all flight-related needs.",
    "",
    "Core responsibilities:",
    "1) Answer in natural, conversational Vietnamese - be warm, patient, and helpful",
    "2) ALWAYS prioritize factual data from MongoDB (flights, tickets, promotions, statistics) over general knowledge",
    "3) For policy questions (baggage, check-in, refund, payment), use the provided policy context if available",
    "4) If data is missing or uncertain, be transparent and guide user on what to provide or where to check",
    "5) Proactively suggest next steps and alternatives to help user achieve their goal",
    "6) Keep responses clear, concise, and actionable",
    "",
    "Critical rules:",
    "- NEVER invent flight numbers, prices, schedules, ticket codes, or any data",
    "- When grounded data is provided, you MUST use it in your answer",
    "- For flight searches with concrete results, present them with full details (flight number, route, time, price)",
    "- For statistics questions, provide exact numbers from the data",
    "- Use bullet points or numbered lists for clarity when presenting multiple items",
    "- If user seems frustrated or has an issue, be extra empathetic and offer to escalate to human support",
    "",
    "Response format:",
    "- Start with direct answer to the question",
    "- Provide relevant details or options",
    "- End with helpful suggestion or follow-up question",
    "",
    realtimeContext,
    groundedContext ? `\nGrounded facts from database:\n${groundedContext}` : "",
    policyContext ? `\nPolicy information:\n${policyContext}` : "",
  ].join("\n");
}

function detectTicketCode(message) {
  const found = String(message || "").toUpperCase().match(/[A-Z0-9]{6,16}/g);
  if (!found) return "";
  return found.find((token) => /\d/.test(token) && /[A-Z]/.test(token)) || "";
}

function detectEmail(message) {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = message.match(emailPattern);
  return match ? match[0] : "";
}

function detectPhone(message) {
  const phonePattern = /(?:0|\+84)[3|5|7|8|9][0-9]{8}/;
  const match = message.match(phonePattern);
  return match ? match[0] : "";
}

function isTicketLookupIntent(message) {
  const normalized = normalizeText(message);
  return /(tra cuu|ma ve|ticket|ve cua toi|ve da dat|kiem tra ve)/.test(normalized);
}

async function buildStatisticsContext(message, realtime) {
  const preferFileData = localSkylineDataService.isFileDataOnlyMode();
  if (preferFileData) {
    const localStats = localSkylineDataService.buildStatisticsContext(message, realtime);
    if (localStats) return localStats;
  }

  const normalized = normalizeText(message);
  const route = detectRouteCodes(message);
  const airlineCode = detectAirlineCode(message);
  const dateWindow = detectDateWindow(message);

  const stats = [];

  // Count flights based on filters
  const flightQuery = {};
  if (route.from) flightQuery.from = route.from;
  if (route.to) flightQuery.to = route.to;
  if (airlineCode) {
    flightQuery.$or = [
      { airlineCode },
      { flightNo: new RegExp(`^${airlineCode}`, "i") },
      { airline: new RegExp(airlineCode, "i") },
    ];
  }
  if (dateWindow?.from && dateWindow?.to) {
    flightQuery.date = { $gte: dateWindow.from, $lte: dateWindow.to };
  }

  let flightCount = 0;
  try {
    flightCount = await Flight.countDocuments(flightQuery);
  } catch (_error) {
    const localStats = localSkylineDataService.buildStatisticsContext(message, realtime);
    if (localStats) return localStats;
  }

  let filterDesc = "";
  if (route.from && route.to) {
    filterDesc = `từ ${route.from} đến ${route.to}`;
  } else if (route.from) {
    filterDesc = `từ ${route.from}`;
  } else if (route.to) {
    filterDesc = `đến ${route.to}`;
  }

  if (airlineCode && filterDesc) {
    filterDesc = `${filterDesc} của ${airlineCode}`;
  } else if (airlineCode) {
    filterDesc = `của hãng ${airlineCode}`;
  }

  if (dateWindow?.label && filterDesc) {
    filterDesc = `${filterDesc} ${dateWindow.label}`;
  } else if (dateWindow?.label) {
    filterDesc = dateWindow.label;
  }

  if (filterDesc) {
    stats.push(`- Có ${flightCount} chuyến bay ${filterDesc}`);
  } else {
    stats.push(`- Tổng số chuyến bay trong hệ thống: ${flightCount}`);
  }

  // Add airline and airport info if relevant
  if (/(hang bay|airline|hang)/.test(normalized)) {
    stats.push(`- Số hãng bay đang hoạt động: ${realtime.activeAirlineCount}`);
  }

  if (/(san bay|airport)/.test(normalized)) {
    stats.push(`- Số sân bay đang hoạt động: ${realtime.activeAirportCount}`);
  }

  return stats.length ? stats.join("\n") : "";
}

async function getRealtimeContext(userMessage) {
  if (localSkylineDataService.isFileDataOnlyMode()) {
    return localSkylineDataService.getRealtimeContext(userMessage);
  }

  const normalized = normalizeText(userMessage);
  const needsFlightData = /(chuyen bay|tim chuyen|gia ve|lich bay|flight|dat ve)/.test(normalized);
  const needsTicketData = /(ve|ticket|ma ve|tra cuu|thanh toan|doi ve|hoan ve|huy ve)/.test(normalized);
  const needsPromotionData = /(khuyen mai|uu dai|giam gia|promo|ma giam)/.test(normalized);
  const ticketCode = detectTicketCode(userMessage);
  const email = detectEmail(userMessage);
  const phone = detectPhone(userMessage);

  let activeAirlineCount;
  let activeAirportCount;
  let totalTicketCount;
  let paidTicketCount;
  let failedTicketCount;
  let recentFlightsRaw;
  let promotionsRaw;
  let lookedUpTicket;
  let ticketsByContact;
  let localRealtime = null;

  try {
    [
      activeAirlineCount,
      activeAirportCount,
      totalTicketCount,
      paidTicketCount,
      failedTicketCount,
      recentFlightsRaw,
      promotionsRaw,
      lookedUpTicket,
      ticketsByContact,
    ] = await Promise.all([
      Airline.countDocuments({ $or: [{ status: { $exists: false } }, { status: "" }, { status: /active|dang hop tac/i }] }),
      Airport.countDocuments({ isActive: { $ne: false } }),
      Ticket.countDocuments({}),
      Ticket.countDocuments({ paymentStatus: { $in: ["paid", "da thanh toan", "success"] } }),
      Ticket.countDocuments({ paymentStatus: { $in: ["failed", "that bai", "payment_failed"] } }),
      needsFlightData
        ? Flight.find({ date: { $gte: new Date().toISOString().slice(0, 10) } }, { flightNo: 1, airline: 1, airlineCode: 1, from: 1, to: 1, date: 1, departTime: 1, priceEconomy: 1, priceBusiness: 1 })
            .sort({ date: 1, departTime: 1 })
            .limit(12)
            .lean()
        : Promise.resolve([]),
      needsPromotionData
        ? Promotion.find({}, { items: 1 }).sort({ createdAt: -1 }).limit(5).lean()
        : Promise.resolve([]),
      ticketCode
        ? Ticket.findOne(
            { ticketCode },
            { ticketCode: 1, status: 1, paymentStatus: 1, bookingDate: 1, totalAmount: 1, departure: 1, arrival: 1, flight: 1, passengerEmail: 1, passengerPhone: 1, createdAt: 1 }
          )
            .sort({ createdAt: -1 })
            .lean()
        : Promise.resolve(null),
      (email || phone) && needsTicketData
        ? Ticket.find(
            email ? { passengerEmail: email } : { passengerPhone: phone },
            { ticketCode: 1, status: 1, paymentStatus: 1, bookingDate: 1, totalAmount: 1, departure: 1, arrival: 1, createdAt: 1 }
          )
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
        : Promise.resolve([]),
    ]);
  } catch (_error) {
    return localSkylineDataService.getRealtimeContext(userMessage);
  }

  const shouldUseLocalTicketLookup = Boolean(ticketCode) && !lookedUpTicket;
  const shouldUseLocalTicketsByContact = Boolean(email || phone) && needsTicketData && (!ticketsByContact || !ticketsByContact.length);
  const shouldUseLocalFlights = needsFlightData && (!recentFlightsRaw || !recentFlightsRaw.length);
  const shouldUseLocalPromotions = needsPromotionData && (!promotionsRaw || !promotionsRaw.length);

  if (shouldUseLocalTicketLookup || shouldUseLocalTicketsByContact || shouldUseLocalFlights || shouldUseLocalPromotions) {
    localRealtime = localSkylineDataService.getRealtimeContext(userMessage);
    if (shouldUseLocalFlights && Array.isArray(localRealtime?.recentFlightsRaw)) {
      recentFlightsRaw = localRealtime.recentFlightsRaw;
    }
    if (shouldUseLocalPromotions && Array.isArray(localRealtime?.activePromotions)) {
      promotionsRaw = [];
    }
  }

  const recentFlights = recentFlightsRaw.map(summarizeFlight);

  const activePromotions = [];
  for (const promotion of promotionsRaw) {
    const items = Array.isArray(promotion?.items) ? promotion.items : [];
    for (const item of items) {
      const status = String(item?.status || "active").toLowerCase();
      if (status !== "active") continue;
      activePromotions.push(summarizePromotion(item));
      if (activePromotions.length >= 6) break;
    }
    if (activePromotions.length >= 6) break;
  }

  if (!activePromotions.length && Array.isArray(localRealtime?.activePromotions) && localRealtime.activePromotions.length) {
    activePromotions.push(...localRealtime.activePromotions.slice(0, 6));
  }

  let ticketLookup = null;
  if (lookedUpTicket) {
    const route = `${String(lookedUpTicket.departure || lookedUpTicket?.flight?.from || "?")} -> ${String(lookedUpTicket.arrival || lookedUpTicket?.flight?.to || "?")}`;
    const ticketStatus = localizeTicketStatus(lookedUpTicket.status);
    const paymentStatus = localizePaymentStatus(lookedUpTicket.paymentStatus);
    const total = formatCurrencyVnd(lookedUpTicket.totalAmount || 0);
    ticketLookup = {
      code: String(lookedUpTicket.ticketCode || ticketCode || "N/A"),
      summary: `Trạng thái vé: ${ticketStatus}; Thanh toán: ${paymentStatus}; Tuyến bay: ${route}; Tổng tiền: ${total}`,
    };
  } else if (localRealtime?.ticketLookup) {
    ticketLookup = localRealtime.ticketLookup;
  }

  let ticketsListByContact = [];
  if (ticketsByContact && ticketsByContact.length > 0) {
    ticketsListByContact = ticketsByContact.map(t => {
      const route = `${String(t.departure || "?")} -> ${String(t.arrival || "?")}`;
      const ticketStatus = localizeTicketStatus(t.status);
      const paymentStatus = localizePaymentStatus(t.paymentStatus);
      const total = formatCurrencyVnd(t.totalAmount || 0);
      return {
        code: String(t.ticketCode || "N/A"),
        route,
        status: ticketStatus,
        payment: paymentStatus,
        total,
        date: t.bookingDate || t.createdAt,
      };
    });
  } else if (Array.isArray(localRealtime?.ticketsByContact) && localRealtime.ticketsByContact.length > 0) {
    ticketsListByContact = localRealtime.ticketsByContact;
  }

  return {
    activeAirlineCount,
    activeAirportCount,
    totalTicketCount,
    paidTicketCount,
    failedTicketCount,
    recentFlights,
    recentFlightsRaw,
    activePromotions,
    ticketLookup,
    ticketsByContact: ticketsListByContact,
    searchedEmail: email,
    searchedPhone: phone,
  };
}

function formatCurrencyVnd(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
}

function detectAirlineCode(message) {
  const normalized = normalizeText(message);
  if (/(vietjet|viet jet|\bvj\b)/.test(normalized)) return "VJ";
  if (/(vietnam airlines|vn airlines|vna|\bvn\b)/.test(normalized)) return "VN";
  if (/(bamboo|\bqh\b)/.test(normalized)) return "QH";
  if (/(pacific|\bbl\b)/.test(normalized)) return "BL";
  if (/(vietravel|\bvu\b)/.test(normalized)) return "VU";
  return "";
}

function detectDateWindow(message) {
  const normalized = normalizeText(message);
  const today = new Date();
  const toDateString = (date) => date.toISOString().slice(0, 10);

  // Helper to create date string directly (avoiding timezone issues)
  const makeDateString = (year, month, day) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const startOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  if (/hom nay/.test(normalized)) {
    const d = toDateString(today);
    return { from: d, to: d, label: "hôm nay" };
  }

  if (/ngay mai|mai/.test(normalized)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    const s = toDateString(d);
    return { from: s, to: s, label: "ngày mai" };
  }

  if (/ngay kia|ngay mot/.test(normalized)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    const s = toDateString(d);
    return { from: s, to: s, label: "ngày kia" };
  }

  if (/tuan sau/.test(normalized)) {
    const nextWeekStart = startOfWeek(today);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
    return { from: toDateString(nextWeekStart), to: toDateString(nextWeekEnd), label: "tuần sau" };
  }

  if (/tuan nay/.test(normalized)) {
    const thisWeekStart = startOfWeek(today);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
    return { from: toDateString(thisWeekStart), to: toDateString(thisWeekEnd), label: "tuần này" };
  }

  if (/thang nay/.test(normalized)) {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toDateString(monthStart), to: toDateString(monthEnd), label: "tháng này" };
  }

  if (/thang sau/.test(normalized)) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return { from: toDateString(monthStart), to: toDateString(monthEnd), label: "tháng sau" };
  }

  // Detect specific dates like "23/03", "23-03", "2026-03-23"
  const datePatterns = [
    { regex: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, format: 'dmy' },
    { regex: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, format: 'ymd' },
    { regex: /(\d{1,2})[\/\-](\d{1,2})(?!\d)/, format: 'dm' }
  ];

  for (const pattern of datePatterns) {
    const match = message.match(pattern.regex);
    if (match) {
      let year, month, day;
      if (pattern.format === 'dmy') {
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      } else if (pattern.format === 'ymd') {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else if (pattern.format === 'dm') {
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = today.getFullYear();

        // Check if date is in the past using date string comparison
        const todayStr = toDateString(today);
        const candidateStr = makeDateString(year, month, day);
        if (candidateStr < todayStr) {
          year++;
        }
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        // Use direct string creation to avoid timezone issues
        const s = makeDateString(year, month, day);
        // Validate the date is actually valid
        const testDate = new Date(`${s}T00:00:00Z`);
        if (!isNaN(testDate.getTime())) {
          return { from: s, to: s, label: s };
        }
      }
    }
  }

  return null;
}

function detectSortPreference(message) {
  const normalized = normalizeText(message);
  if (/(re nhat|gia thap nhat|tiet kiem|thap nhat)/.test(normalized)) return "cheapest";
  if (/(som nhat|bay som|khoi hanh som)/.test(normalized)) return "earliest";
  if (/(dep nhat|gio dep|thoi gian bay dep|gio bay dep)/.test(normalized)) return "best-time";
  return "earliest";
}

function detectUpcomingIntent(message) {
  const normalized = normalizeText(message);
  return /(sap toi|sắp tới|tuan sau|tuan nay|ngay mai|hom nay|toi nay|thang toi|thang nay|khoi hanh)/.test(normalized);
}

function detectStatisticsIntent(message) {
  const normalized = normalizeText(message);
  return /(bao nhieu chuyen bay|co bao nhieu|so luong|thong ke|tong cong|tat ca|co may|hien co|dang co|hien tai co)/.test(normalized);
}

function detectBlogIntent(message) {
  const normalized = normalizeText(message);
  return /(blog|bai viet|tin tuc|cam nang|kinh nghiem|meo|huong dan)/.test(normalized);
}

function detectRecruitmentIntent(message) {
  const normalized = normalizeText(message);
  return /(tuyen dung|recruitment|viec lam|job|vi tri|ung tuyen|nhan su|career)/.test(normalized);
}

function detectUserDataIntent(message) {
  const normalized = normalizeText(message);
  return /(nguoi dung|khach hang|user|thanh vien|hoi vien|rank|hang|diem|points|email|so dien thoai)/.test(normalized);
}

function extractKeywords(message, max = 6) {
  const tokens = normalizeText(message)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !CHAT_STOP_WORDS.has(token));
  return [...new Set(tokens)].slice(0, Math.max(1, max));
}

function buildLooseRegex(message) {
  const keywords = extractKeywords(message, 8);
  if (!keywords.length) return null;
  return new RegExp(keywords.join("|"), "i");
}

function formatDateLabel(value) {
  const dt = new Date(String(value || ""));
  if (Number.isNaN(dt.getTime())) return "N/A";
  return dt.toISOString().slice(0, 10);
}

function summarizeBlogItem(item) {
  return {
    title: String(item?.title || "").trim() || "Bài viết",
    category: String(item?.category || "").trim() || "Tổng hợp",
    excerpt: String(item?.excerpt || "").trim() || "",
    publishedAt: formatDateLabel(item?.publishedAt || item?.createdAt),
  };
}

function summarizeRecruitmentItem(item) {
  return {
    title: String(item?.title || "").trim() || "Vị trí tuyển dụng",
    team: String(item?.team || "").trim() || "",
    location: String(item?.location || "").trim() || "",
    type: String(item?.type || "").trim() || "",
    level: String(item?.level || "").trim() || "",
    salaryRange: String(item?.salaryRange || "").trim() || "Thỏa thuận",
    status: String(item?.status || "open").trim(),
  };
}

function formatBlogLines(items, limit = 5) {
  return (items || []).slice(0, limit).map((item, index) => {
    const date = item.publishedAt || "N/A";
    const excerpt = item.excerpt ? ` | ${item.excerpt}` : "";
    return `${index + 1}. ${item.title} | ${item.category} | ${date}${excerpt}`;
  });
}

function formatRecruitmentLines(items, limit = 6) {
  return (items || []).slice(0, limit).map((item, index) => {
    const status = normalizeText(item.status).includes("closed") ? "Đã đóng" : "Đang mở";
    const attrs = [item.team, item.location, item.type, item.level].filter(Boolean).join(" | ");
    return `${index + 1}. ${item.title}${attrs ? ` | ${attrs}` : ""} | Lương: ${item.salaryRange} | ${status}`;
  });
}

async function getBlogGroundedData(message, limit = 5) {
  const regex = buildLooseRegex(message);
  const query = { status: { $ne: "draft" } };
  if (regex) {
    query.$or = [
      { title: regex },
      { excerpt: regex },
      { category: regex },
      { author: regex },
      { highlights: regex },
      { "sections.heading": regex },
      { "sections.paragraphs": regex },
    ];
  }

  try {
    const mongoBlogs = await Blog.find(query, { title: 1, category: 1, excerpt: 1, publishedAt: 1, createdAt: 1 })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    if (mongoBlogs.length) {
      return { source: "mongodb", items: mongoBlogs.map(summarizeBlogItem) };
    }
  } catch (_error) {
    // Fallback to file data below.
  }

  const localBlogs = localSkylineDataService.searchBlogs(message, limit);
  return { source: "file", items: localBlogs.map(summarizeBlogItem) };
}

async function getRecruitmentGroundedData(message, limit = 6) {
  const regex = buildLooseRegex(message);
  const normalized = normalizeText(message);
  const askClosed = /(closed|dong|da dong|het han)/.test(normalized);

  const query = {};
  if (!askClosed) {
    query.$or = [{ status: { $exists: false } }, { status: "" }, { status: { $ne: "closed" } }];
  }

  if (regex) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { title: regex },
        { team: regex },
        { location: regex },
        { type: regex },
        { level: regex },
        { salaryRange: regex },
        { summary: regex },
        { skills: regex },
      ],
    });
  }

  try {
    const mongoJobs = await RecruitmentJob.find(
      query,
      { title: 1, team: 1, location: 1, type: 1, level: 1, salaryRange: 1, status: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    if (mongoJobs.length) {
      return { source: "mongodb", items: mongoJobs.map(summarizeRecruitmentItem) };
    }
  } catch (_error) {
    // Fallback to file data below.
  }

  const localJobs = localSkylineDataService.searchRecruitmentJobs(message, limit);
  return { source: "file", items: localJobs.map(summarizeRecruitmentItem) };
}

async function getUserGroundedData(message) {
  const email = detectEmail(message);
  const phone = detectPhone(message);
  const normalized = normalizeText(message);
  const askTopRank = /(top|hang cao|rank cao|nhieu diem|points cao|diem cao)/.test(normalized);

  let profile = null;
  let totalUsers = 0;
  let activeUsers = 0;
  let topUsers = [];

  try {
    if (email || phone) {
      const userQuery = email ? { email: email.toLowerCase() } : { phone };
      profile = await User.findOne(
        userQuery,
        { fullName: 1, email: 1, phone: 1, currentRank: 1, points: 1, nextRank: 1, nextThreshold: 1, status: 1 }
      ).lean();
    }

    [totalUsers, activeUsers] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ $or: [{ status: { $exists: false } }, { status: "" }, { status: /active/i }] }),
    ]);

    if (askTopRank) {
      topUsers = await User.find(
        {},
        { fullName: 1, email: 1, currentRank: 1, points: 1, status: 1 }
      )
        .sort({ points: -1, createdAt: -1 })
        .limit(5)
        .lean();
    }
  } catch (_error) {
    // Fallback to file data below.
  }

  const needsFallback = !profile && !totalUsers && !activeUsers && !topUsers.length;
  if (needsFallback) {
    return localSkylineDataService.getUserInsights(message);
  }

  if (!profile && (email || phone)) {
    const localUser = localSkylineDataService.getUserInsights(message);
    if (localUser.profile) {
      profile = localUser.profile;
    }
  }

  if ((!totalUsers && !activeUsers) || (askTopRank && !topUsers.length)) {
    const localUser = localSkylineDataService.getUserInsights(message);
    totalUsers = totalUsers || Number(localUser.totalUsers || 0);
    activeUsers = activeUsers || Number(localUser.activeUsers || 0);
    if (!topUsers.length) {
      topUsers = localUser.topUsers || [];
    }
  }

  return {
    source: "mongodb",
    profile,
    totalUsers,
    activeUsers,
    topUsers,
  };
}

function extractUserContext(session) {
  if (!session || !Array.isArray(session.messages)) {
    return { mentionedRoutes: [], mentionedDates: [], mentionedAirlines: [] };
  }

  const mentionedRoutes = [];
  const mentionedDates = [];
  const mentionedAirlines = [];

  for (const msg of session.messages) {
    if (msg.role === 'user') {
      const route = detectRouteCodes(msg.content);
      if (route.from || route.to) {
        mentionedRoutes.push(route);
      }

      const dateWindow = detectDateWindow(msg.content);
      if (dateWindow) {
        mentionedDates.push(dateWindow);
      }

      const airline = detectAirlineCode(msg.content);
      if (airline) {
        mentionedAirlines.push(airline);
      }
    }
  }

  return {
    mentionedRoutes: mentionedRoutes.slice(-3),
    mentionedDates: mentionedDates.slice(-2),
    mentionedAirlines: mentionedAirlines.slice(-2),
  };
}

async function getSmartSuggestions(message, session, realtime) {
  const normalized = normalizeText(message);
  const suggestions = [];

  // Get user context from conversation
  const userContext = extractUserContext(session);

  // Suggest promotions for specific routes
  if (userContext.mentionedRoutes.length && realtime.activePromotions.length) {
    suggestions.push("💡 Gợi ý: Kiểm tra khuyến mãi để được giá tốt hơn cho tuyến bay này");
  }

  // Suggest booking if user found flights
  if (/(tim thay|phu hop|co chu|nay nhe|chon chuyen)/.test(normalized)) {
    suggestions.push("💡 Để đặt vé, bạn chọn chuyến phù hợp rồi làm theo hướng dẫn trên trang");
  }

  // Suggest check-in tips after booking
  if (/(da dat|da thanh toan|nhan duoc ma ve)/.test(normalized)) {
    suggestions.push("💡 Lưu ý: Check-in online 24h trước giờ bay để tiết kiệm thời gian");
  }

  // Suggest alternatives if no results
  if (/(khong co|chua tim thay|khong thay)/.test(normalized)) {
    suggestions.push("💡 Thử tìm với điều kiện linh hoạt hơn: đổi ngày, chọn sân bay gần, hoặc hãng khác");
  }

  return suggestions;
}

function detectPastIntent(message) {
  const normalized = normalizeText(message);
  return /(qua khu|qua roi|da bay|thang truoc|tuan truoc|nam ngoai)/.test(normalized);
}

function parseFlightDateTime(flight) {
  const date = String(flight?.date || "").trim();
  const time = String(flight?.departTime || "00:00").trim();
  if (!date) return new Date("1970-01-01T00:00:00Z");

  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : (time || "00:00:00");
  const dt = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(dt.getTime()) ? new Date("1970-01-01T00:00:00Z") : dt;
}

function sortFlightsByPreference(flights, preference) {
  const safe = Array.isArray(flights) ? [...flights] : [];
  if (preference === "cheapest") {
    return safe.sort((a, b) => {
      const pa = Number(a?.priceEconomy || 0);
      const pb = Number(b?.priceEconomy || 0);
      if (pa !== pb) return pa - pb;
      return parseFlightDateTime(a) - parseFlightDateTime(b);
    });
  }

  if (preference === "best-time") {
    const ideal = 10 * 60;
    return safe.sort((a, b) => {
      const da = parseFlightDateTime(a);
      const db = parseFlightDateTime(b);
      const ma = da.getHours() * 60 + da.getMinutes();
      const mb = db.getHours() * 60 + db.getMinutes();
      const sa = Math.abs(ma - ideal);
      const sb = Math.abs(mb - ideal);
      if (sa !== sb) return sa - sb;
      return da - db;
    });
  }

  return safe.sort((a, b) => parseFlightDateTime(a) - parseFlightDateTime(b));
}

async function queryFlightsWithFilters({ route, airlineCode, dateWindow, limit = 60, includeAirline = true, includeDateWindow = true, futureFromDate = "" }) {
  if (localSkylineDataService.isFileDataOnlyMode()) {
    return localSkylineDataService.queryFlightsWithFilters({
      route,
      airlineCode,
      dateWindow,
      limit,
      includeAirline,
      includeDateWindow,
      futureFromDate,
    });
  }

  const query = {};
  if (route?.from) query.from = route.from;
  if (route?.to) query.to = route.to;

  if (includeAirline && airlineCode) {
    query.$or = [
      { airlineCode },
      { flightNo: new RegExp(`^${airlineCode}`, "i") },
      { airline: new RegExp(airlineCode, "i") },
    ];
  }

  if (includeDateWindow && dateWindow?.from && dateWindow?.to) {
    query.date = { $gte: dateWindow.from, $lte: dateWindow.to };
  } else if (futureFromDate) {
    query.date = { $gte: futureFromDate };
  }

  try {
    const mongoFlights = await Flight.find(
      query,
      {
        flightNo: 1,
        airline: 1,
        airlineCode: 1,
        from: 1,
        to: 1,
        date: 1,
        departTime: 1,
        arriveTime: 1,
        priceEconomy: 1,
        priceBusiness: 1,
      }
    )
      .sort({ date: 1, departTime: 1 })
      .limit(limit)
      .lean();

    if (mongoFlights.length) {
      return mongoFlights;
    }

    return localSkylineDataService.queryFlightsWithFilters({
      route,
      airlineCode,
      dateWindow,
      limit,
      includeAirline,
      includeDateWindow,
      futureFromDate,
    });
  } catch (_error) {
    return localSkylineDataService.queryFlightsWithFilters({
      route,
      airlineCode,
      dateWindow,
      limit,
      includeAirline,
      includeDateWindow,
      futureFromDate,
    });
  }
}

async function findFlightsForUserQuery(message, limit = 8) {
  const route = detectRouteCodes(message);
  const airlineCode = detectAirlineCode(message);
  const dateWindow = detectDateWindow(message);
  const sortPreference = detectSortPreference(message);
  const todayDate = new Date().toISOString().slice(0, 10);
  const upcomingIntent = detectUpcomingIntent(message);
  const pastIntent = detectPastIntent(message);

  // Default to future flights unless explicitly asking about past
  const futureFromDate = !pastIntent && !dateWindow ? todayDate : (upcomingIntent && !pastIntent ? todayDate : "");

  const hasRoute = Boolean(route.from || route.to);
  const hasAirline = Boolean(airlineCode);
  const hasDateWindow = Boolean(dateWindow?.from && dateWindow?.to);

  const plans = [
    {
      key: "strict",
      enabled: hasRoute && hasAirline && hasDateWindow,
      description: "đúng tuyến + đúng hãng + đúng khoảng thời gian yêu cầu",
      options: { includeAirline: true, includeDateWindow: true },
    },
    {
      key: "same-route-airline-nearest",
      enabled: hasRoute && hasAirline,
      description: "đúng tuyến + đúng hãng (gần nhất khi không có đủ ngày)",
      options: { includeAirline: true, includeDateWindow: false },
    },
    {
      key: "same-route-time-window",
      enabled: hasRoute && hasDateWindow,
      description: "đúng tuyến + đúng thời gian (không ép hãng)",
      options: { includeAirline: false, includeDateWindow: true },
    },
    {
      key: "same-route-nearest",
      enabled: hasRoute,
      description: "đúng tuyến gần nhất",
      options: { includeAirline: false, includeDateWindow: false },
    },
    {
      key: "date-airline-any-route",
      enabled: !hasRoute && hasDateWindow && hasAirline,
      description: "đúng thời gian + đúng hãng (mọi tuyến)",
      options: { includeAirline: true, includeDateWindow: true },
    },
    {
      key: "date-only-any-route",
      enabled: !hasRoute && hasDateWindow,
      description: "đúng thời gian (mọi tuyến)",
      options: { includeAirline: false, includeDateWindow: true },
    },
    {
      key: "airline-only-future",
      enabled: !hasRoute && !hasDateWindow && hasAirline && upcomingIntent,
      description: "đúng hãng (chuyến sắp tới)",
      options: { includeAirline: true, includeDateWindow: false },
    },
  ];

  for (const plan of plans) {
    if (!plan.enabled) continue;
    const candidates = await queryFlightsWithFilters({
      route,
      airlineCode,
      dateWindow,
      futureFromDate,
      ...plan.options,
      limit: 80,
    });
    if (candidates.length) {
      return {
        flights: sortFlightsByPreference(candidates, sortPreference).slice(0, limit),
        level: plan.key,
        levelDescription: plan.description,
        sortPreference,
        dateWindow,
        airlineCode,
        upcomingIntent,
      };
    }
  }

  return {
    flights: [],
    level: "none",
    levelDescription: "không có dữ liệu phù hợp",
    sortPreference,
    dateWindow,
    airlineCode,
    upcomingIntent,
  };
}

function detectRouteCodes(message) {
  const normalized = normalizeText(message);
  const knownAirportCodes = new Set(["HAN", "SGN", "DAD", "CXR", "VCA", "HPH", "PQC", "HUI", "VII"]);
  const aliasToCode = [
    ["ha noi", "HAN"],
    ["sai gon", "SGN"],
    ["ho chi minh", "SGN"],
    ["tp ho chi minh", "SGN"],
    ["tp hcm", "SGN"],
    ["tan son nhat", "SGN"],
    ["noi bai", "HAN"],
    ["da nang", "DAD"],
    ["nha trang", "CXR"],
    ["can tho", "VCA"],
    ["hai phong", "HPH"],
    ["phu quoc", "PQC"],
    ["hue", "HUI"],
    ["vinh", "VII"],
  ];

  const detected = [];
  for (const [alias, code] of aliasToCode) {
    const index = normalized.indexOf(alias);
    if (index >= 0) detected.push({ code, index });
  }

  const codesInText = String(message || "").toUpperCase().match(/\b[A-Z]{3}\b/g) || [];
  for (const code of codesInText) {
    if (!knownAirportCodes.has(code)) continue;
    const index = normalized.indexOf(code.toLowerCase());
    if (index >= 0) detected.push({ code, index });
  }

  const ordered = detected
    .sort((a, b) => a.index - b.index)
    .map((item) => item.code);

  const unique = [...new Set(ordered)];
  return {
    from: unique[0] || "",
    to: unique[1] || "",
  };
}

async function getMatchingFlights(message) {
  const result = await findFlightsForUserQuery(message, 8);
  return result.flights;
}

async function getNearestFlightsByRoute(message, limit = 8) {
  const result = await findFlightsForUserQuery(message, limit);
  return result.flights;
}

function formatFlightListForReply(flights, limit = 5) {
  return flights.slice(0, limit).map((flight, index) => {
    const airline = String(flight.airline || flight.airlineCode || "N/A");
    return `${index + 1}. ${flight.flightNo} | ${airline} | ${flight.from} -> ${flight.to} | ${flight.date} ${flight.departTime || ""} | Phổ thông: ${formatCurrencyVnd(flight.priceEconomy)} | Thương gia: ${formatCurrencyVnd(flight.priceBusiness)}`;
  });
}

function hasConcreteFlightInfo(text) {
  const value = String(text || "");
  return /\b[A-Z]{1,3}\d{2,5}\b/.test(value) || /\b(HAN|SGN|DAD|CXR|PQC|VCA|HPH|HUI|VII)\b/.test(value);
}

async function buildGroundedContext(message, realtime) {
  const normalized = normalizeText(message);
  const isFlightIntent = /(chuyen bay|tim chuyen|gia ve|lich bay|dat ve)/.test(normalized);
  const isTicketIntent = /(tra cuu|ma ve|ticket|ve cua toi|ve da dat)/.test(normalized);
  const isPromoIntent = /(khuyen mai|uu dai|ma giam|giam gia)/.test(normalized);
  const isStatsIntent = detectStatisticsIntent(message);
  const isBlogDataIntent = detectBlogIntent(message);
  const isRecruitmentDataIntent = detectRecruitmentIntent(message);
  const isUserData = detectUserDataIntent(message);

  const result = {
    groundedText: "",
    matchedFlights: [],
    fallbackToNearestFlights: false,
  };

  // Handle statistics questions
  if (isStatsIntent) {
    const statsText = await buildStatisticsContext(message, realtime);
    if (statsText) {
      result.groundedText = [
        "Statistics from MongoDB:",
        statsText,
        "Instruction: Answer based on these statistics with clear numbers.",
      ].join("\n");
      return result;
    }
  }

  if (isFlightIntent) {
    const flights = await getMatchingFlights(message);
    result.matchedFlights = flights;

    if (flights.length) {
      const lines = formatFlightListForReply(flights, 8);
      result.groundedText = [
        "Matched flights from MongoDB:",
        ...lines,
        "Instruction: Answer with specific flights above. Mention at least 3 options if available.",
      ].join("\n");
      return result;
    }

    const nearestFlights = await getNearestFlightsByRoute(message, 8);
    if (nearestFlights.length) {
      result.matchedFlights = nearestFlights;
      result.fallbackToNearestFlights = true;
      const lines = formatFlightListForReply(nearestFlights, 8);
      result.groundedText = [
        "No exact flights found for requested time window.",
        "Nearest available flights from MongoDB by route/airline:",
        ...lines,
        "Instruction: Explain that exact time may be unavailable and present nearest concrete options above.",
      ].join("\n");
      return result;
    }
  }

  if (isTicketIntent && realtime.ticketLookup) {
    result.groundedText = [
      "Ticket lookup from MongoDB:",
      `- ${realtime.ticketLookup.code}: ${realtime.ticketLookup.summary}`,
      "Instruction: Answer based on this ticket data and suggest next action.",
    ].join("\n");
    return result;
  }

  if (isRecruitmentDataIntent) {
    const recruitmentData = await getRecruitmentGroundedData(message, 6);
    if (recruitmentData.items.length) {
      const lines = formatRecruitmentLines(recruitmentData.items, 6);
      result.groundedText = [
        `Recruitment data from ${recruitmentData.source}:`,
        ...lines,
        "Instruction: Answer with concrete hiring positions, team, location, level and salary range above.",
      ].join("\n");
      return result;
    }
  }

  if (isBlogDataIntent) {
    const blogData = await getBlogGroundedData(message, 5);
    if (blogData.items.length) {
      const lines = formatBlogLines(blogData.items, 5);
      result.groundedText = [
        `Blog data from ${blogData.source}:`,
        ...lines,
        "Instruction: Answer with concrete blog topics and summaries above. Do not invent titles.",
      ].join("\n");
      return result;
    }
  }

  if (isUserData) {
    const userData = await getUserGroundedData(message);
    const lines = [
      `- Tổng người dùng: ${Number(userData.totalUsers || 0)}`,
      `- Người dùng đang hoạt động: ${Number(userData.activeUsers || 0)}`,
    ];

    if (userData.profile) {
      const profile = userData.profile;
      lines.push(
        `- Hồ sơ: ${profile.fullName || "N/A"} | ${profile.email || "N/A"} | Hạng ${profile.currentRank || "N/A"} | Điểm ${Number(profile.points || 0)} | Trạng thái ${profile.status || "N/A"}`
      );
      if (profile.nextRank) {
        lines.push(`- Mốc tiếp theo: ${profile.nextRank} (${Number(profile.nextThreshold || 0)} điểm)`);
      }
    }

    if (Array.isArray(userData.topUsers) && userData.topUsers.length) {
      userData.topUsers.slice(0, 5).forEach((user, index) => {
        lines.push(`- Top ${index + 1}: ${user.fullName || user.email || "N/A"} | Hạng ${user.currentRank || "N/A"} | Điểm ${Number(user.points || 0)}`);
      });
    }

    result.groundedText = [
      `User data from ${userData.source || "file"}:`,
      ...lines,
      "Instruction: Answer with these user numbers/profile details only.",
    ].join("\n");
    return result;
  }

  if (isPromoIntent && realtime.activePromotions.length) {
    result.groundedText = [
      "Active promotions from MongoDB:",
      ...realtime.activePromotions.map((item, index) => `${index + 1}. ${item}`),
      "Instruction: Answer with concrete promotion codes/conditions shown above.",
    ].join("\n");
  }

  return result;
}

async function getRouteHints(limit = 5, options = {}) {
  if (localSkylineDataService.isFileDataOnlyMode()) {
    return localSkylineDataService.getRouteHints(limit, options);
  }

  const query = {};
  const futureOnly = Boolean(options.futureOnly);
  if (futureOnly) {
    query.date = { $gte: new Date().toISOString().slice(0, 10) };
  }

  let flights;
  try {
    flights = await Flight.find(query, { from: 1, to: 1, airline: 1, airlineCode: 1, date: 1 })
      .sort({ date: 1 })
      .limit(30)
      .lean();
  } catch (_error) {
    return localSkylineDataService.getRouteHints(limit, options);
  }

  const routeSet = new Set();
  const hints = [];
  for (const flight of flights) {
    const route = `${String(flight.from || "").toUpperCase()} -> ${String(flight.to || "").toUpperCase()}`;
    const airline = String(flight.airline || flight.airlineCode || "N/A");
    const key = `${route}|${airline}`;
    if (routeSet.has(key)) continue;
    routeSet.add(key);
    hints.push(`${route} (${airline})`);
    if (hints.length >= limit) break;
  }

  return hints;
}

async function callOpenAi({ apiKey, model, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return String(content || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq({ apiKey, model, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq request failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return String(content || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

function toGeminiContents(messages) {
  return messages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.content || "") }],
    }));
}

async function callGemini({ apiKey, model, systemPrompt, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.4,
        },
        contents: toGeminiContents(messages),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.map((part) => String(part?.text || "")).join("\n").trim();
    return String(content || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function fallbackReply(message, realtimeContextText, realtime) {
  const normalized = normalizeText(message);
  const ticketCode = detectTicketCode(message);
  const isStatsIntent = detectStatisticsIntent(message);
  const isBlogDataIntent = detectBlogIntent(message);
  const isRecruitmentDataIntent = detectRecruitmentIntent(message);
  const isUserData = detectUserDataIntent(message);

  // Handle statistics questions
  if (isStatsIntent) {
    const statsText = await buildStatisticsContext(message, realtime);
    if (statsText) {
      return [
        "Dựa trên dữ liệu hiện tại trong hệ thống:",
        statsText,
        "Bạn muốn mình lọc theo điều kiện cụ thể hơn không?"
      ].join("\n");
    }
  }

  if (isTicketLookupIntent(message)) {
    if (!ticketCode) {
      return [
        "Để tra cứu vé đã đặt, bạn vui lòng cung cấp mã vé (ví dụ: TCKA000062).",
        "Mình sẽ kiểm tra đúng trạng thái vé theo mã bạn cung cấp trong hệ thống."
      ].join("\n");
    }

    if (!realtime.ticketLookup) {
      return `Mình chưa tìm thấy vé với mã ${ticketCode} trong hệ thống. Bạn kiểm tra lại mã vé giúp mình nhé.`;
    }

    return [
      `Đã tra cứu vé ${realtime.ticketLookup.code}:`,
      realtime.ticketLookup.summary,
      "Nếu bạn cần, mình có thể hướng dẫn bước tiếp theo theo trạng thái vé hiện tại."
    ].join("\n");
  }

  if (/dat ve|mua ve/.test(normalized)) {
    return [
      "Bạn có thể đặt vé theo 4 bước: tìm chuyến bay -> chọn chuyến -> nhập thông tin hành khách -> thanh toán.",
      "Nếu muốn, mình có thể hướng dẫn chi tiết từng bước trên Skyline."
    ].join("\n");
  }

  if (/(khuyen mai|uu dai|ma giam|giam gia)/.test(normalized)) {
    if (!realtime.activePromotions.length) {
      return "Hiện chưa có khuyến mãi phù hợp trong dữ liệu hệ thống. Bạn có thể theo dõi mục Khuyến mãi để cập nhật mới nhất.";
    }

    const top = realtime.activePromotions.slice(0, 4).map((item, index) => `${index + 1}. ${item}`);
    return [
      "Mình tìm thấy một số khuyến mãi đang hoạt động:",
      ...top,
      "Bạn muốn mình lọc theo tuyến bay hoặc thời gian cụ thể không?"
    ].join("\n");
  }

  if (/(chuyen bay|tim chuyen|gia ve|lich bay|dat ve)/.test(normalized)) {
    const searchResult = await findFlightsForUserQuery(message, 8);
    const flights = searchResult.flights;
    if (!flights.length) {
      const hints = await getRouteHints(4, { futureOnly: searchResult.upcomingIntent });
      return [
        searchResult.upcomingIntent
          ? "Hiện chưa có chuyến bay sắp tới khớp chính xác theo điều kiện bạn hỏi."
          : "Mình chưa tìm thấy chuyến bay khớp chính xác theo điều kiện bạn hỏi.",
        "Bạn có thể cung cấp thêm: điểm đi, điểm đến, ngày bay (hoặc 'tuần sau'), và hãng bay mong muốn.",
        hints.length ? `Một số tuyến đang có dữ liệu: ${hints.join(", ")}.` : ""
      ].filter(Boolean).join("\n")
      ;
    }

    const lines = flights.slice(0, 5).map((flight, index) => {
      const airline = String(flight.airline || flight.airlineCode || "N/A");
      return `${index + 1}. ${flight.flightNo} | ${airline} | ${flight.from} -> ${flight.to} | ${flight.date} ${flight.departTime || ""} | Phổ thông: ${formatCurrencyVnd(flight.priceEconomy)} | Thương gia: ${formatCurrencyVnd(flight.priceBusiness)}`;
    });

    const sortLabel = searchResult.sortPreference === "cheapest"
      ? "rẻ nhất"
      : searchResult.sortPreference === "best-time"
        ? "thời gian bay đẹp nhất"
        : "sớm nhất";

    return [
      `Mình tìm thấy các chuyến bay phù hợp (${searchResult.levelDescription}), sắp xếp ${sortLabel}:`,
      ...lines,
      flights.length > 5 ? `Và còn ${flights.length - 5} chuyến khác. Bạn muốn xem thêm hoặc lọc theo điều kiện cụ thể không?` : "Bạn muốn mình gợi ý chuyến nào phù hợp nhất không?"
    ].join("\n");
  }

  if (isRecruitmentDataIntent) {
    const recruitmentData = await getRecruitmentGroundedData(message, 6);
    if (!recruitmentData.items.length) {
      return "Hiện mình chưa tìm thấy vị trí tuyển dụng phù hợp trong dữ liệu. Bạn thử nêu rõ vị trí, team hoặc địa điểm nhé.";
    }
    const lines = formatRecruitmentLines(recruitmentData.items, 6);
    return [
      "Các vị trí tuyển dụng phù hợp:",
      ...lines,
      "Bạn muốn mình lọc thêm theo team, địa điểm hoặc level không?"
    ].join("\n");
  }

  if (isBlogDataIntent) {
    const blogData = await getBlogGroundedData(message, 5);
    if (!blogData.items.length) {
      return "Mình chưa thấy bài viết phù hợp trong dữ liệu hiện tại. Bạn thử nêu chủ đề cụ thể hơn nhé.";
    }
    const lines = formatBlogLines(blogData.items, 5);
    return [
      "Mình tìm thấy các bài viết liên quan:",
      ...lines,
      "Bạn muốn mình tóm tắt chi tiết bài nào?"
    ].join("\n");
  }

  if (isUserData) {
    const userData = await getUserGroundedData(message);
    const lines = [
      `- Tổng người dùng: ${Number(userData.totalUsers || 0)}`,
      `- Người dùng đang hoạt động: ${Number(userData.activeUsers || 0)}`,
    ];
    if (userData.profile) {
      lines.push(`- Hồ sơ: ${userData.profile.fullName || "N/A"} | ${userData.profile.email || "N/A"} | Hạng ${userData.profile.currentRank || "N/A"} | Điểm ${Number(userData.profile.points || 0)}`);
    }
    if (Array.isArray(userData.topUsers) && userData.topUsers.length) {
      userData.topUsers.slice(0, 3).forEach((user, index) => {
        lines.push(`- Top ${index + 1}: ${user.fullName || user.email || "N/A"} | Điểm ${Number(user.points || 0)}`);
      });
    }
    return ["Thông tin người dùng từ dữ liệu hiện có:", ...lines].join("\n");
  }

  return [
    "Hệ thống AI đang tạm thời chưa kết nối đến nhà cung cấp model.",
    "Mình vẫn có thể hỗ trợ bạn dựa trên dữ liệu realtime hiện tại:",
    realtimeContextText,
  ].join("\n\n");
}

async function requestModel(messages, systemPrompt) {
  const provider = DEFAULT_PROVIDER;

  if (provider === "groq") {
    const apiKey = String(process.env.GROQ_API_KEY || "").trim();
    const model = String(process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
    if (!apiKey) {
      return { text: "", provider, model, fallback: true, reason: "Missing GROQ_API_KEY" };
    }

    const payloadMessages = [{ role: "system", content: systemPrompt }, ...messages];
    const text = await callGroq({ apiKey, model, messages: payloadMessages });
    return { text, provider, model, fallback: false };
  }

  if (provider === "gemini") {
    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    const model = String(process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();
    if (!apiKey) {
      return { text: "", provider, model, fallback: true, reason: "Missing GEMINI_API_KEY" };
    }

    const text = await callGemini({ apiKey, model, systemPrompt, messages });
    return { text, provider, model, fallback: false };
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
  if (!apiKey) {
    return { text: "", provider: "openai", model, fallback: true, reason: "Missing OPENAI_API_KEY" };
  }

  const payloadMessages = [{ role: "system", content: systemPrompt }, ...messages];
  const text = await callOpenAi({ apiKey, model, messages: payloadMessages });
  return { text, provider: "openai", model, fallback: false };
}

async function chat({ sessionId, message, resetContext = false }) {
  const cleanedMessage = String(message || "").trim();
  const normalizedMessage = normalizeText(cleanedMessage);
  if (!cleanedMessage) {
    const error = new Error("Message is required");
    error.statusCode = 400;
    throw error;
  }

  const { id, session } = ensureSession(sessionId);
  if (resetContext) {
    session.messages = [];
  }

  const realtime = await getRealtimeContext(cleanedMessage);
  const realtimeContextText = createRealtimeContextText(realtime);
  const grounded = await buildGroundedContext(cleanedMessage, realtime);

  // Check for policy/FAQ questions
  const policyIntents = detectPolicyIntent(cleanedMessage);
  const policyAnswer = policyIntents.length > 0 ? getPolicyAnswer(policyIntents, cleanedMessage) : null;
  const relatedQuestions = policyIntents.length > 0 ? getRelatedQuestions(policyIntents) : [];

  const systemPrompt = buildSystemPrompt(realtimeContextText, grounded.groundedText, policyAnswer || "");
  const routeGuess = detectRouteCodes(cleanedMessage);

  const isDataIntent =
    /(chuyen bay|tim chuyen|gia ve|lich bay|dat ve|tra cuu|ma ve|ticket|khuyen mai|uu dai|ma giam|giam gia|bao nhieu|so luong|thong ke|blog|bai viet|tin tuc|tuyen dung|recruitment|viec lam|job|nguoi dung|user|thanh vien|diem|rank)/.test(normalizedMessage)
    || Boolean(routeGuess.from || routeGuess.to);
  const isTicketIntent = isTicketLookupIntent(cleanedMessage);
  const isStatsIntent = detectStatisticsIntent(cleanedMessage);
  const ticketCode = detectTicketCode(cleanedMessage);

  let deterministicDataReply = "";
  let hasConcreteDataOptions = false;

  // Priority 1: Policy/FAQ questions
  if (policyAnswer) {
    deterministicDataReply = policyAnswer;
    if (relatedQuestions.length > 0) {
      deterministicDataReply += `\n\n📌 Câu hỏi liên quan:\n${relatedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
    }
    hasConcreteDataOptions = true;
  }
  // Priority 2: Ticket lookup by contact info
  else if (isTicketIntent && realtime.ticketsByContact.length > 0) {
    const ticketLines = realtime.ticketsByContact.map((t, i) =>
      `${i + 1}. ${t.code} | ${t.route} | ${t.status} | ${t.payment} | ${t.total}`
    );
    deterministicDataReply = [
      `Mình tìm thấy ${realtime.ticketsByContact.length} vé của ${realtime.searchedEmail || realtime.searchedPhone}:`,
      "",
      ...ticketLines,
      "",
      "Bạn muốn kiểm tra chi tiết vé nào? Vui lòng cung cấp mã vé."
    ].join("\n");
    hasConcreteDataOptions = true;
  }
  // Priority 3: Statistics questions
  else if (isStatsIntent) {
    const statsText = await buildStatisticsContext(cleanedMessage, realtime);
    if (statsText) {
      deterministicDataReply = [
        "Dựa trên dữ liệu hiện tại trong hệ thống:",
        statsText,
        "Bạn muốn mình cung cấp thông tin chi tiết hơn không?"
      ].join("\n");
      hasConcreteDataOptions = true;
    }
  }
  // Priority 4: Recruitment data
  else if (detectRecruitmentIntent(cleanedMessage)) {
    const recruitmentData = await getRecruitmentGroundedData(cleanedMessage, 6);
    if (recruitmentData.items.length) {
      deterministicDataReply = [
        "Mình tìm thấy các vị trí tuyển dụng phù hợp:",
        "",
        ...formatRecruitmentLines(recruitmentData.items, 6),
        "",
        "Bạn muốn mình lọc theo team, địa điểm hoặc level cụ thể không?"
      ].join("\n");
      hasConcreteDataOptions = true;
    }
  }
  // Priority 5: Blog/news data
  else if (detectBlogIntent(cleanedMessage)) {
    const blogData = await getBlogGroundedData(cleanedMessage, 5);
    if (blogData.items.length) {
      deterministicDataReply = [
        "Mình tìm thấy các bài viết liên quan:",
        "",
        ...formatBlogLines(blogData.items, 5),
        "",
        "Bạn muốn mình tóm tắt sâu hơn bài nào?"
      ].join("\n");
      hasConcreteDataOptions = true;
    }
  }
  // Priority 6: User/member data
  else if (detectUserDataIntent(cleanedMessage)) {
    const userData = await getUserGroundedData(cleanedMessage);
    const lines = [
      `- Tổng người dùng: ${Number(userData.totalUsers || 0)}`,
      `- Người dùng đang hoạt động: ${Number(userData.activeUsers || 0)}`,
    ];
    if (userData.profile) {
      lines.push(`- Hồ sơ: ${userData.profile.fullName || "N/A"} | ${userData.profile.email || "N/A"} | Hạng ${userData.profile.currentRank || "N/A"} | Điểm ${Number(userData.profile.points || 0)}`);
      if (userData.profile.nextRank) {
        lines.push(`- Mốc hạng tiếp theo: ${userData.profile.nextRank} (${Number(userData.profile.nextThreshold || 0)} điểm)`);
      }
    }
    if (Array.isArray(userData.topUsers) && userData.topUsers.length) {
      userData.topUsers.slice(0, 5).forEach((user, index) => {
        lines.push(`- Top ${index + 1}: ${user.fullName || user.email || "N/A"} | Hạng ${user.currentRank || "N/A"} | Điểm ${Number(user.points || 0)}`);
      });
    }

    deterministicDataReply = [
      "Thông tin người dùng từ dữ liệu hiện tại:",
      ...lines,
      "Bạn muốn mình tra cứu theo email/số điện thoại cụ thể không?"
    ].join("\n");
    hasConcreteDataOptions = true;
  }
  // Priority 4: Flight search
  else if (isDataIntent && !isTicketIntent) {
    // Try to find flights first
    const searchResult = await findFlightsForUserQuery(cleanedMessage, 8);
    const directFlights = searchResult.flights;

    if (directFlights.length) {
      hasConcreteDataOptions = true;
      const lines = formatFlightListForReply(directFlights, 5);
      const sortLabel = searchResult.sortPreference === "cheapest"
        ? "rẻ nhất"
        : searchResult.sortPreference === "best-time"
          ? "thời gian bay đẹp nhất"
          : "sớm nhất";

      const levelMsg = searchResult.level === "strict"
        ? "Đây là kết quả khớp chính xác với yêu cầu của bạn."
        : searchResult.level === "date-only-any-route" || searchResult.level === "date-airline-any-route"
          ? `Mình tìm thấy ${directFlights.length} chuyến bay phù hợp với thời gian bạn hỏi.`
          : "Mình tìm thấy các chuyến bay gần nhất với yêu cầu của bạn.";

      deterministicDataReply = [
        `Các chuyến bay phù hợp (${searchResult.levelDescription}), sắp xếp theo ${sortLabel}:`,
        "",
        ...lines,
        "",
        levelMsg,
        directFlights.length > 5 ? `\nCòn ${directFlights.length - 5} chuyến khác. Bạn muốn xem thêm hoặc lọc cụ thể hơn không?` : ""
      ].filter(line => line !== "").join("\n");
    } else if (searchResult.upcomingIntent || searchResult.dateWindow) {
      // User asked about specific time but no results
      const hints = await getRouteHints(4, { futureOnly: true });
      deterministicDataReply = [
        "Mình chưa tìm thấy chuyến bay phù hợp chính xác với yêu cầu của bạn.",
        "Bạn có thể:",
        "- Thử đổi ngày bay hoặc nới rộng khoảng thời gian",
        "- Chọn hãng bay khác hoặc sân bay gần đó",
        hints.length ? `\nMột số tuyến đang có chuyến bay: ${hints.join(", ")}` : ""
      ].filter(Boolean).join("\n");
    }
  } else if (isDataIntent && isTicketIntent) {
    // Handle ticket lookup
    deterministicDataReply = await fallbackReply(cleanedMessage, realtimeContextText, realtime);
  } else if ((/(khuyen mai|uu dai|ma giam|giam gia)/.test(normalizedMessage)) && realtime.activePromotions.length) {
    // Handle promotions
    const top = realtime.activePromotions.slice(0, 5).map((item, index) => `${index + 1}. ${item}`);
    deterministicDataReply = [
      "Khuyến mãi đang hoạt động:",
      "",
      ...top,
      "",
      "Bạn muốn biết thêm chi tiết khuyến mãi nào?"
    ].join("\n");
    hasConcreteDataOptions = true;
  }

  session.messages.push({ role: "user", content: cleanedMessage });
  session.messages = trimSessionMessages(session.messages);

  let modelResult;
  try {
    modelResult = await requestModel(session.messages, systemPrompt);
  } catch (error) {
    modelResult = {
      text: "",
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_PROVIDER === "gemini"
        ? String(process.env.GEMINI_MODEL || "gemini-1.5-flash")
        : DEFAULT_PROVIDER === "groq"
          ? String(process.env.GROQ_MODEL || "llama-3.3-70b-versatile")
          : String(process.env.OPENAI_MODEL || "gpt-4.1-mini"),
      fallback: true,
      reason: error.message,
    };
  }

  let assistantReply;

  // If we have concrete data from database, always use it
  if (hasConcreteDataOptions && deterministicDataReply) {
    assistantReply = deterministicDataReply;
  } else if (modelResult.fallback) {
    // Model failed, use deterministic reply or fallback
    assistantReply = deterministicDataReply || await fallbackReply(cleanedMessage, realtimeContextText, realtime);
  } else {
    // Model succeeded, use model response or fallback to deterministic reply
    const modelText = String(modelResult.text || "").trim();
    assistantReply = modelText || deterministicDataReply || await fallbackReply(cleanedMessage, realtimeContextText, realtime);
  }

  // Final safety check: if we have matched flights but AI didn't include them, override
  if (!hasConcreteDataOptions && grounded.matchedFlights.length > 0 && !hasConcreteFlightInfo(assistantReply)) {
    const lines = formatFlightListForReply(grounded.matchedFlights, 5);
    assistantReply = [
      grounded.fallbackToNearestFlights
        ? "Mình chưa thấy chuyến bay khớp chính xác theo thời gian bạn yêu cầu. Dưới đây là các chuyến gần nhất theo dữ liệu hệ thống:"
        : "Mình tìm thấy các chuyến bay phù hợp từ dữ liệu hệ thống:",
      "",
      ...lines,
      "",
      "Bạn muốn mình gợi ý chuyến rẻ nhất hay chuyến bay sớm nhất?",
    ].join("\n");
  }

  // Add smart suggestions
  const suggestions = await getSmartSuggestions(cleanedMessage, session, realtime);
  if (suggestions.length > 0) {
    assistantReply += "\n\n" + suggestions.join("\n");
  }

  const isFlightIntent = /(chuyen bay|tim chuyen|gia ve|lich bay|dat ve)/.test(normalizedMessage);

  let responseProvider = modelResult.provider;
  let responseModel = modelResult.model;
  let responseFallback = Boolean(modelResult.fallback);
  let responseReason = modelResult.reason || "";

  if (hasConcreteDataOptions) {
    responseProvider = "mongodb-grounded";
    responseModel = "rule+db";
    responseFallback = false;
    responseReason = "";
  } else if (isTicketIntent && deterministicDataReply) {
    responseProvider = "mongodb-grounded";
    responseModel = "rule+db";
    responseFallback = false;
    responseReason = "";
  }

  session.messages.push({ role: "assistant", content: assistantReply });
  session.messages = trimSessionMessages(session.messages);
  session.updatedAt = now();

  return {
    sessionId: id,
    reply: assistantReply,
    provider: responseProvider,
    model: responseModel,
    fallback: responseFallback,
    reason: responseReason,
  };
}

module.exports = {
  chat,
};
