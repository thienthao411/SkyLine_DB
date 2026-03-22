const fs = require("fs");
const path = require("path");

const CACHE_TTL_MS = 30000;
const DEFAULT_DATA_DIR = String(process.env.SKYLINE_DATA_DIR || "").trim();

const DATA_FILES = {
  airlines: "skyline.airlines.json",
  airports: "skyline.airports.json",
  flights: "skyline.flights.json",
  promotions: "skyline.promotions.json",
  tickets: "skyline.tickets.json",
  users: "skyline.users.json",
  blogs: "skyline.blogs.json",
  recruitmentJobs: "skyline.recruitmentjobs.json",
};

const SEARCH_STOP_WORDS = new Set([
  "toi", "minh", "cho", "xem", "giup", "duoc", "khong", "nhe", "la", "va", "co", "bao", "nhieu",
  "thong", "tin", "ve", "cua", "trong", "he", "thong", "skyline", "danh", "sach", "cac", "nhung", "vui",
  "long", "kiem", "tra", "tim", "the", "nao", "sao", "nay", "kia", "day", "voi", "den", "tu", "mot"
]);

let cache = {
  loadedAt: 0,
  dirPath: "",
  data: null,
};

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

function toDateString(value) {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  if (typeof value === "object" && value.$date) {
    return toDateString(value.$date);
  }

  return "";
}

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && value.$numberLong) {
    return toNumber(value.$numberLong);
  }
  return 0;
}

function formatCurrencyVnd(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
}

function summarizeFlight(flight) {
  const route = `${String(flight.from || "").toUpperCase()} -> ${String(flight.to || "").toUpperCase()}`;
  const date = toDateString(flight.date) || "N/A";
  const schedule = `${date} ${flight.departTime || ""}`.trim();
  const flightNo = String(flight.flightNo || "N/A").trim();
  const airline = String(flight.airline || flight.airlineCode || "N/A").trim();
  const economy = toNumber(flight.priceEconomy);
  const business = toNumber(flight.priceBusiness);
  return `${flightNo} | ${airline} | ${route} | ${schedule} | Eco ${economy} VND | Biz ${business} VND`;
}

function summarizePromotion(item) {
  const code = String(item?.promoCode || "").trim() || "N/A";
  const label = String(item?.label || item?.details || "Khuyen mai").trim();
  const start = toDateString(item?.startDate) || String(item?.startDate || "").trim();
  const end = toDateString(item?.endDate) || String(item?.endDate || "").trim();
  const period = `${start} - ${end}`.trim();
  return `${label} | Code: ${code} | Thoi gian: ${period || "N/A"}`;
}

function localizeTicketStatus(value) {
  const normalized = normalizeText(value);
  if (/confirmed|xac nhan|da xac nhan/.test(normalized)) return "Đã xác nhận";
  if (/pending|cho xu ly|dang xu ly/.test(normalized)) return "Đang xử lý";
  if (/cancelled|canceled|da huy|huy/.test(normalized)) return "Đã hủy";
  if (/used|da su dung|hoan tat|completed|hoan thanh/.test(normalized)) return "Đã sử dụng";
  return String(value || "Không xác định");
}

function localizePaymentStatus(ticket) {
  const normalizedMethod = normalizeText(ticket?.paymentStatus || "");
  if (/paid|da thanh toan|success/.test(normalizedMethod)) return "Đã thanh toán";
  if (/pending|cho thanh toan/.test(normalizedMethod)) return "Chờ thanh toán";
  if (/failed|that bai|payment failed/.test(normalizedMethod)) return "Thanh toán thất bại";
  if (/refunded|hoan tien/.test(normalizedMethod)) return "Đã hoàn tiền";

  if (ticket?.payment?.paidAt) return "Đã thanh toán";
  return "Không xác định";
}

function detectTicketCode(message) {
  const found = String(message || "").toUpperCase().match(/[A-Z0-9]{6,16}/g);
  if (!found) return "";
  return found.find((token) => /\d/.test(token) && /[A-Z]/.test(token)) || "";
}

function detectEmail(message) {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = String(message || "").match(emailPattern);
  return match ? match[0] : "";
}

function detectPhone(message) {
  const phonePattern = /(?:0|\+84)[3|5|7|8|9][0-9]{8}/;
  const match = String(message || "").match(phonePattern);
  return match ? match[0] : "";
}

function parseFlightDateTime(flight) {
  const date = toDateString(flight?.date);
  const time = String(flight?.departTime || "00:00").trim();
  if (!date) return new Date("1970-01-01T00:00:00Z");
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : (time || "00:00:00");
  const dt = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(dt.getTime()) ? new Date("1970-01-01T00:00:00Z") : dt;
}

function extractSearchTokens(message, max = 8) {
  const tokens = normalizeText(message)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !SEARCH_STOP_WORDS.has(token));
  return [...new Set(tokens)].slice(0, Math.max(1, max));
}

function matchesByTokens(fields, tokens) {
  if (!tokens.length) return true;
  const haystack = normalizeText(fields.filter(Boolean).join(" "));
  return tokens.some((token) => haystack.includes(token));
}

function isFileDataOnlyMode() {
  const source = String(process.env.AI_CHAT_DATA_SOURCE || "").trim().toLowerCase();
  return source === "file" || source === "json" || String(process.env.AI_CHAT_FILE_ONLY || "").trim() === "true";
}

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function resolveDataDir(customDirPath = "") {
  const chosen = String(customDirPath || "").trim() || DEFAULT_DATA_DIR;
  return chosen;
}

function loadData(customDirPath = "") {
  const dirPath = resolveDataDir(customDirPath);
  if (!dirPath) return null;
  if (!fs.existsSync(dirPath)) return null;

  const now = Date.now();
  if (cache.data && cache.dirPath === dirPath && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const data = {};
  for (const [key, fileName] of Object.entries(DATA_FILES)) {
    const fullPath = path.join(dirPath, fileName);
    data[key] = safeReadJson(fullPath);
  }

  cache = {
    loadedAt: now,
    dirPath,
    data,
  };

  return data;
}

function getActivePromotions(promotions) {
  const activePromotions = [];
  for (const promotion of promotions || []) {
    const items = Array.isArray(promotion?.items) ? promotion.items : [];
    for (const item of items) {
      const status = String(item?.status || "active").toLowerCase();
      if (status !== "active") continue;
      activePromotions.push(summarizePromotion(item));
      if (activePromotions.length >= 6) break;
    }
    if (activePromotions.length >= 6) break;
  }
  return activePromotions;
}

function queryFlightsWithFilters({ route, airlineCode, dateWindow, limit = 60, includeAirline = true, includeDateWindow = true, futureFromDate = "" } = {}) {
  const data = loadData();
  if (!data) return [];

  let flights = [...(data.flights || [])];

  if (route?.from) {
    const fromCode = String(route.from).toUpperCase();
    flights = flights.filter((f) => String(f.from || "").toUpperCase() === fromCode);
  }
  if (route?.to) {
    const toCode = String(route.to).toUpperCase();
    flights = flights.filter((f) => String(f.to || "").toUpperCase() === toCode);
  }

  if (includeAirline && airlineCode) {
    const code = String(airlineCode).toUpperCase();
    flights = flights.filter((f) => {
      const airlineCodeValue = String(f.airlineCode || "").toUpperCase();
      const flightNo = String(f.flightNo || "").toUpperCase();
      const airlineName = String(f.airline || f.airlineName || "").toUpperCase();
      return airlineCodeValue === code || flightNo.startsWith(code) || airlineName.includes(code);
    });
  }

  if (includeDateWindow && dateWindow?.from && dateWindow?.to) {
    flights = flights.filter((f) => {
      const date = toDateString(f.date);
      return date && date >= dateWindow.from && date <= dateWindow.to;
    });
  } else if (futureFromDate) {
    flights = flights.filter((f) => {
      const date = toDateString(f.date);
      return date && date >= futureFromDate;
    });
  }

  flights.sort((a, b) => parseFlightDateTime(a) - parseFlightDateTime(b));

  return flights.slice(0, Math.max(0, Number(limit || 60)));
}

function getRouteHints(limit = 5, options = {}) {
  const data = loadData();
  if (!data) return [];

  const today = new Date().toISOString().slice(0, 10);
  const futureOnly = Boolean(options?.futureOnly);
  const routeSet = new Set();
  const hints = [];

  const flights = [...(data.flights || [])].sort((a, b) => parseFlightDateTime(a) - parseFlightDateTime(b));

  for (const flight of flights) {
    const date = toDateString(flight.date);
    if (futureOnly && date && date < today) continue;

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

function buildStatisticsContext(message, realtime = null) {
  const data = loadData();
  if (!data) return "";

  const normalized = normalizeText(message);
  const routeMatch = String(message || "").toUpperCase().match(/\b[A-Z]{3}\b/g) || [];
  const from = routeMatch[0] || "";
  const to = routeMatch[1] || "";

  let flights = [...(data.flights || [])];
  if (from) flights = flights.filter((f) => String(f.from || "").toUpperCase() === from);
  if (to) flights = flights.filter((f) => String(f.to || "").toUpperCase() === to);

  const lines = [];
  if (from && to) {
    lines.push(`- Có ${flights.length} chuyến bay từ ${from} đến ${to}`);
  } else {
    lines.push(`- Tổng số chuyến bay trong dữ liệu file: ${(data.flights || []).length}`);
  }

  if (/(hang bay|airline|hang)/.test(normalized)) {
    const activeAirlineCount = realtime?.activeAirlineCount ?? (data.airlines || []).filter((a) => {
      const status = normalizeText(a?.status || "active");
      return !status || /active|dang hop tac/.test(status);
    }).length;
    lines.push(`- Số hãng bay đang hoạt động: ${activeAirlineCount}`);
  }

  if (/(san bay|airport)/.test(normalized)) {
    const activeAirportCount = realtime?.activeAirportCount ?? (data.airports || []).filter((a) => a?.isActive !== false).length;
    lines.push(`- Số sân bay đang hoạt động: ${activeAirportCount}`);
  }

  return lines.join("\n");
}

function getRealtimeContext(userMessage) {
  const data = loadData();
  if (!data) {
    return {
      activeAirlineCount: 0,
      activeAirportCount: 0,
      totalTicketCount: 0,
      paidTicketCount: 0,
      failedTicketCount: 0,
      recentFlights: [],
      recentFlightsRaw: [],
      activePromotions: [],
      ticketLookup: null,
      ticketsByContact: [],
      searchedEmail: "",
      searchedPhone: "",
    };
  }

  const normalized = normalizeText(userMessage);
  const needsFlightData = /(chuyen bay|tim chuyen|gia ve|lich bay|flight|dat ve)/.test(normalized);
  const needsTicketData = /(ve|ticket|ma ve|tra cuu|thanh toan|doi ve|hoan ve|huy ve)/.test(normalized);
  const needsPromotionData = /(khuyen mai|uu dai|giam gia|promo|ma giam)/.test(normalized);

  const activeAirlineCount = (data.airlines || []).filter((a) => {
    const status = normalizeText(a?.status || "active");
    return !status || /active|dang hop tac/.test(status);
  }).length;

  const activeAirportCount = (data.airports || []).filter((a) => a?.isActive !== false).length;
  const totalTicketCount = (data.tickets || []).length;

  const paidTicketCount = (data.tickets || []).filter((t) => {
    if (t?.payment?.paidAt) return true;
    const paymentStatus = normalizeText(t?.paymentStatus || "");
    return /paid|da thanh toan|success/.test(paymentStatus);
  }).length;

  const failedTicketCount = (data.tickets || []).filter((t) => {
    const paymentStatus = normalizeText(t?.paymentStatus || "");
    return /failed|that bai|payment failed/.test(paymentStatus);
  }).length;

  const today = new Date().toISOString().slice(0, 10);
  const recentFlightsRaw = needsFlightData
    ? [...(data.flights || [])]
        .filter((f) => {
          const date = toDateString(f.date);
          return date && date >= today;
        })
        .sort((a, b) => parseFlightDateTime(a) - parseFlightDateTime(b))
        .slice(0, 12)
    : [];

  const promotionsRaw = needsPromotionData ? (data.promotions || []).slice(0, 5) : [];
  const activePromotions = getActivePromotions(promotionsRaw);

  const ticketCode = detectTicketCode(userMessage);
  const searchedEmail = detectEmail(userMessage);
  const searchedPhone = detectPhone(userMessage);

  const lookedUpTicket = ticketCode
    ? [...(data.tickets || [])]
        .sort((a, b) => (toDateString(b.bookingDate) || "").localeCompare(toDateString(a.bookingDate) || ""))
        .find((t) => String(t.ticketCode || "").toUpperCase() === ticketCode)
    : null;

  let ticketLookup = null;
  if (lookedUpTicket) {
    const route = `${String(lookedUpTicket.departure || lookedUpTicket?.flight?.from || "?")} -> ${String(lookedUpTicket.arrival || lookedUpTicket?.flight?.to || "?")}`;
    const ticketStatus = localizeTicketStatus(lookedUpTicket.status);
    const paymentStatus = localizePaymentStatus(lookedUpTicket);
    const total = formatCurrencyVnd(lookedUpTicket.totalAmount || lookedUpTicket.totalPrice || 0);
    ticketLookup = {
      code: String(lookedUpTicket.ticketCode || ticketCode || "N/A"),
      summary: `Trạng thái vé: ${ticketStatus}; Thanh toán: ${paymentStatus}; Tuyến bay: ${route}; Tổng tiền: ${total}`,
    };
  }

  const ticketsByContact = ((searchedEmail || searchedPhone) && needsTicketData)
    ? [...(data.tickets || [])]
        .filter((t) => {
          const email = String(t.passengerEmail || t.email || "").toLowerCase();
          const phone = String(t.passengerPhone || t.phone || "");
          if (searchedEmail && email === searchedEmail.toLowerCase()) return true;
          if (searchedPhone && phone === searchedPhone) return true;
          return false;
        })
        .sort((a, b) => (toDateString(b.bookingDate) || "").localeCompare(toDateString(a.bookingDate) || ""))
        .slice(0, 5)
        .map((t) => {
          const route = `${String(t.departure || "?")} -> ${String(t.arrival || "?")}`;
          return {
            code: String(t.ticketCode || "N/A"),
            route,
            status: localizeTicketStatus(t.status),
            payment: localizePaymentStatus(t),
            total: formatCurrencyVnd(t.totalAmount || t.totalPrice || 0),
            date: toDateString(t.bookingDate) || toDateString(t.createdAt),
          };
        })
    : [];

  return {
    activeAirlineCount,
    activeAirportCount,
    totalTicketCount,
    paidTicketCount,
    failedTicketCount,
    recentFlights: recentFlightsRaw.map(summarizeFlight),
    recentFlightsRaw,
    activePromotions,
    ticketLookup,
    ticketsByContact,
    searchedEmail,
    searchedPhone,
  };
}

function searchBlogs(message, limit = 5) {
  const data = loadData();
  if (!data) return [];

  const tokens = extractSearchTokens(message, 8);
  const blogs = (data.blogs || [])
    .filter((blog) => {
      const status = normalizeText(blog?.status || "published");
      if (status && status === "draft") return false;

      const highlights = Array.isArray(blog?.highlights) ? blog.highlights.join(" ") : "";
      const sections = Array.isArray(blog?.sections)
        ? blog.sections.map((section) => `${section?.heading || ""} ${(section?.paragraphs || []).join(" ")}`).join(" ")
        : "";

      return matchesByTokens(
        [blog?.title, blog?.excerpt, blog?.category, blog?.author, highlights, sections],
        tokens
      );
    })
    .sort((a, b) => {
      const da = toDateString(a?.publishedAt || a?.createdAt || "1970-01-01");
      const db = toDateString(b?.publishedAt || b?.createdAt || "1970-01-01");
      return String(db).localeCompare(String(da));
    })
    .slice(0, Math.max(1, Number(limit || 5)))
    .map((blog) => ({
      title: String(blog?.title || "").trim(),
      category: String(blog?.category || "").trim() || "Tổng hợp",
      excerpt: String(blog?.excerpt || "").trim(),
      publishedAt: toDateString(blog?.publishedAt || blog?.createdAt),
      slug: String(blog?.slug || "").trim(),
    }));

  return blogs;
}

function searchRecruitmentJobs(message, limit = 6) {
  const data = loadData();
  if (!data) return [];

  const normalized = normalizeText(message);
  const tokens = extractSearchTokens(message, 8);
  const askClosed = /(closed|dong|da dong|het han)/.test(normalized);

  const jobs = (data.recruitmentJobs || [])
    .filter((job) => {
      const status = normalizeText(job?.status || "open");
      if (!askClosed && status === "closed") return false;
      return matchesByTokens(
        [
          job?.title,
          job?.team,
          job?.location,
          job?.type,
          job?.level,
          job?.salaryRange,
          job?.summary,
          Array.isArray(job?.skills) ? job.skills.join(" ") : "",
        ],
        tokens
      );
    })
    .sort((a, b) => {
      const da = toDateString(a?.createdAt || "1970-01-01");
      const db = toDateString(b?.createdAt || "1970-01-01");
      return String(db).localeCompare(String(da));
    })
    .slice(0, Math.max(1, Number(limit || 6)))
    .map((job) => ({
      title: String(job?.title || "").trim(),
      team: String(job?.team || "").trim(),
      location: String(job?.location || "").trim(),
      type: String(job?.type || "").trim(),
      level: String(job?.level || "").trim(),
      salaryRange: String(job?.salaryRange || "Thỏa thuận").trim(),
      status: String(job?.status || "open").trim(),
    }));

  return jobs;
}

function getUserInsights(message) {
  const data = loadData();
  if (!data) {
    return {
      source: "file",
      profile: null,
      totalUsers: 0,
      activeUsers: 0,
      topUsers: [],
    };
  }

  const users = data.users || [];
  const email = detectEmail(message).toLowerCase();
  const phone = detectPhone(message);
  const normalized = normalizeText(message);
  const askTopRank = /(top|hang cao|rank cao|nhieu diem|points cao|diem cao)/.test(normalized);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => {
    const status = normalizeText(user?.status || "active");
    return !status || status === "active";
  }).length;

  let profile = null;
  if (email || phone) {
    const matched = users.find((user) => {
      const userEmail = String(user?.email || "").toLowerCase();
      const userPhone = String(user?.phone || "");
      if (email && userEmail === email) return true;
      if (phone && userPhone === phone) return true;
      return false;
    });

    if (matched) {
      profile = {
        fullName: String(matched?.fullName || "").trim(),
        email: String(matched?.email || "").trim(),
        phone: String(matched?.phone || "").trim(),
        currentRank: String(matched?.currentRank || "").trim(),
        points: toNumber(matched?.points || 0),
        nextRank: String(matched?.nextRank || "").trim(),
        nextThreshold: toNumber(matched?.nextThreshold || 0),
        status: String(matched?.status || "active").trim(),
      };
    }
  }

  let topUsers = [];
  if (askTopRank) {
    topUsers = [...users]
      .sort((a, b) => toNumber(b?.points || 0) - toNumber(a?.points || 0))
      .slice(0, 5)
      .map((user) => ({
        fullName: String(user?.fullName || "").trim(),
        email: String(user?.email || "").trim(),
        currentRank: String(user?.currentRank || "").trim(),
        points: toNumber(user?.points || 0),
        status: String(user?.status || "active").trim(),
      }));
  }

  return {
    source: "file",
    profile,
    totalUsers,
    activeUsers,
    topUsers,
  };
}

module.exports = {
  loadData,
  isFileDataOnlyMode,
  getRealtimeContext,
  queryFlightsWithFilters,
  getRouteHints,
  buildStatisticsContext,
  searchBlogs,
  searchRecruitmentJobs,
  getUserInsights,
};
