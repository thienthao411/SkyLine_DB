const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Ticket = require("../models/Ticket");
const Flight = require("../models/Flight");
const User = require("../models/User");
const Notification = require("../models/Notification");
const NotificationUser = require("../models/NotificationUser");
const { getIO } = require("../socket");
const {
  sendBookingIssuedEmail,
  sendAccountCredentialsEmail,
} = require("../services/bookingEmailService");

const INACTIVE_STATUSES = new Set(["cancelled", "canceled", "huy", "hủy", "failed", "expired"]);
const ALLOWED_STATUSES = new Set([
  "pending",
  "processing",
  "paid",
  "issued",
  "failed",
  "expired",
  "cancelled",
  "booked",
  "completed",
]);

function normalizeSeatCode(value) {
  const compact = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!compact) return "";

  const letterFirst = compact.match(/^([A-Z])(\d{1,2})$/);
  if (letterFirst) {
    const [, column, row] = letterFirst;
    return `${column}${row.padStart(2, "0")}`;
  }

  const rowFirst = compact.match(/^(\d{1,2})([A-Z])$/);
  if (rowFirst) {
    const [, row, column] = rowFirst;
    return `${column}${row.padStart(2, "0")}`;
  }

  return compact;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ALLOWED_STATUSES.has(status) ? status : "pending";
}

function resolveSeatType(seat, seatType) {
  const normalizedType = String(seatType || "").trim().toLowerCase();
  if (normalizedType === "business" || normalizedType === "economy") {
    return normalizedType;
  }

  const normalizedSeat = normalizeSeatCode(seat);
  const matched = normalizedSeat.match(/^[A-Z](\d{2})$/);
  const row = matched ? Number(matched[1]) : null;
  if (row != null && row <= 5) return "business";
  return "economy";
}

function isBusinessSeat(seat) {
  const normalizedSeat = normalizeSeatCode(seat);
  const matched = normalizedSeat.match(/^[A-Z](\d{2})$/);
  if (!matched) return false;
  return Number(matched[1]) <= 5;
}

function parseBookedSeatsFromFlight(flight) {
  const seats = Array.isArray(flight?.details?.bookedSeats) ? flight.details.bookedSeats : [];
  return seats.map((seat) => normalizeSeatCode(seat)).filter(Boolean);
}

function buildFlightSnapshot(flightDoc) {
  return {
    id: String(flightDoc?._id || ""),
    airline: String(flightDoc?.airline || ""),
    flightNo: String(flightDoc?.flightNo || ""),
    from: String(flightDoc?.from || ""),
    to: String(flightDoc?.to || ""),
    date: String(flightDoc?.date || ""),
    departTime: String(flightDoc?.departTime || ""),
    arriveTime: String(flightDoc?.arriveTime || ""),
    durationMin: Number(flightDoc?.durationMin || 0),
    price: Number(flightDoc?.priceEconomy || 0),
    currency: String(flightDoc?.currency || "VND"),
    seatsLeft: Number(flightDoc?.seatsMax || 0) - Number(flightDoc?.seatsBookedTotal || 0),
    cabin: "Economy",
    priceEconomy: Number(flightDoc?.priceEconomy || 0),
    priceBusiness: Number(flightDoc?.priceBusiness || 0),
    economyPrice: Number(flightDoc?.priceEconomy || 0),
    businessPrice: Number(flightDoc?.priceBusiness || 0),
    details: flightDoc?.details || {},
    fromAirport: flightDoc?.fromAirportName || null,
    toAirport: flightDoc?.toAirportName || null,
  };
}

async function findFlightByAnyId(id) {
  if (!id) return null;

  const raw = String(id).trim();
  if (!raw) return null;

  let flight = null;
  if (mongoose.Types.ObjectId.isValid(raw)) {
    flight = await Flight.findById(raw);
  }

  if (!flight) {
    flight = await Flight.findOne({ flightId: raw });
  }

  return flight;
}

async function generateTicketCode() {
  const now = new Date();
  const prefix = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;

  for (let i = 0; i < 5; i += 1) {
    const suffix = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
    const ticketCode = `TCK${prefix}${suffix}`;
    const exists = await Ticket.exists({ ticketCode });
    if (!exists) return ticketCode;
  }

  return `TCK${Date.now()}`;
}

async function saveSeatToFlight(flightDoc, normalizedSeat) {
  const currentSeats = new Set(parseBookedSeatsFromFlight(flightDoc));
  const beforeCount = currentSeats.size;

  currentSeats.add(normalizedSeat);
  const afterCount = currentSeats.size;
  const changed = afterCount > beforeCount;

  if (!changed) {
    return { changed: false };
  }

  const nextSeats = Array.from(currentSeats);
  const bookedBusiness = nextSeats.filter((seat) => isBusinessSeat(seat)).length;
  const bookedEconomy = nextSeats.length - bookedBusiness;

  const nextDetails = {
    ...(flightDoc.details || {}),
    bookedSeats: nextSeats,
  };

  await Flight.findByIdAndUpdate(flightDoc._id, {
    $set: {
      details: nextDetails,
      seatsBookedBusiness: bookedBusiness,
      seatsBookedEconomy: bookedEconomy,
      seatsBookedTotal: nextSeats.length,
    },
  });

  return { changed: true };
}

function toBookingResponse(ticketDoc) {
  const payment = ticketDoc.payment && typeof ticketDoc.payment === "object" ? ticketDoc.payment : {};

  return {
    ticketCode: ticketDoc.ticketCode,
    flightId: String(ticketDoc.flightId || ""),
    flight: ticketDoc.flight || {},
    passengerInfo: ticketDoc.passengerInfo || {},
    seat: ticketDoc.seat,
    seatType: ticketDoc.seatType || "",
    baggageOption: ticketDoc.baggageOption || payment.baggageOption || null,
    totalAmount: Number(ticketDoc.totalAmount || ticketDoc.totalPrice || 0),
    payment,
    bookingDate: ticketDoc.bookingDate || new Date(ticketDoc.createdAt || Date.now()).toISOString(),
    status: normalizeStatus(ticketDoc.paymentStatus || ticketDoc.status),
  };
}

async function createVerificationNotification(ticket, payerName) {
  const exists = await Notification.findOne({
    bookingId: ticket.ticketCode,
    type: "payment_verification",
    isRead: false,
  });

  if (exists) {
    return null;
  }

  const customerName = String(payerName || "").trim() || String(ticket.passengerInfo?.fullName || "").trim() || "Khach hang";

  return Notification.create({
    title: "Giao dịch cần xác nhận",
    message: `Khách hàng ${customerName} đã gửi yêu cầu xác nhận thanh toán`,
    bookingId: ticket.ticketCode,
    type: "payment_verification",
    isRead: false,
    createdAt: new Date(),
  });
}

async function createUserPaymentNotification(ticket, paymentStatus) {
  const userEmail = String(ticket.email || ticket.passengerInfo?.email || "")
    .trim()
    .toLowerCase();
  if (!userEmail) {
    return null;
  }

  const normalizedPaymentStatus = normalizeStatus(paymentStatus);
  const statusText = normalizedPaymentStatus === "paid" ? "đã được xác nhận" : "bị từ chối";
  const title = normalizedPaymentStatus === "paid" ? "Thanh toán đã được xác nhận" : "Thanh toán bị từ chối";
  const message = `Yêu cầu thanh toán cho đơn ${ticket.ticketCode} ${statusText}.`;

  const duplicate = await NotificationUser.findOne({
    userEmail,
    bookingId: ticket.ticketCode,
    type: "payment_status",
    paymentStatus: normalizedPaymentStatus,
    isRead: false,
  });

  if (duplicate) {
    return duplicate;
  }

  return NotificationUser.create({
    userEmail,
    title,
    message,
    bookingId: ticket.ticketCode,
    type: "payment_status",
    paymentStatus: normalizedPaymentStatus,
    isRead: false,
    createdAt: new Date(),
  });
}

function emitRealtime(event, payload, options = {}) {
  const io = getIO();
  if (!io) return;

  if (options.room) {
    io.to(options.room).emit(event, payload);
    return;
  }

  io.emit(event, payload);
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateTemporaryPassword() {
  return `Sky${Math.random().toString(36).slice(2, 8)}!`;
}

function calculateRewardPoints(ticket) {
  const payment = ticket?.payment && typeof ticket.payment === "object" ? ticket.payment : {};
  const rawTicketCount = Number(payment.ticketCount || payment.passengerCount || ticket?.passengerInfo?.ticketCount || 1);
  const ticketCount = Number.isFinite(rawTicketCount) && rawTicketCount > 0 ? Math.floor(rawTicketCount) : 1;

  const totalAmount = Number(ticket?.totalAmount || ticket?.totalPrice || ticket?.price || 0);
  const amountPoints = Number.isFinite(totalAmount) && totalAmount > 0 ? Math.floor(totalAmount / 10000) : 0;
  const ticketPoints = ticketCount * 100;
  const totalPoints = amountPoints + ticketPoints;

  return {
    totalPoints,
    ticketCount,
    ticketPoints,
    amountPoints,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
  };
}

function computeRankProgress(points) {
  const safePoints = Math.max(0, Number(points || 0));

  if (safePoints >= 5000) {
    return {
      currentRank: "Bạch Kim",
      nextRank: "Bạch Kim",
      nextThreshold: 5000,
    };
  }

  if (safePoints >= 2000) {
    return {
      currentRank: "Vàng",
      nextRank: "Bạch Kim",
      nextThreshold: 5000,
    };
  }

  if (safePoints >= 500) {
    return {
      currentRank: "Bạc",
      nextRank: "Vàng",
      nextThreshold: 2000,
    };
  }

  return {
    currentRank: "Đồng",
    nextRank: "Bạc",
    nextThreshold: 500,
  };
}

async function applyRewardPointsForSuccessfulBooking(ticket) {
  const payment = ticket?.payment && typeof ticket.payment === "object" ? ticket.payment : {};
  if (payment.rewardPointsGranted === true) {
    return { skipped: true, reason: "already-granted" };
  }

  const email = normalizeEmail(ticket?.email || ticket?.passengerInfo?.email);
  if (!email) {
    return { skipped: true, reason: "missing-email" };
  }

  const user = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });
  if (!user) {
    return { skipped: true, reason: "user-not-found", email };
  }

  const reward = calculateRewardPoints(ticket);
  if (!reward.totalPoints || reward.totalPoints <= 0) {
    return { skipped: true, reason: "zero-points", email };
  }

  const nextPoints = Math.max(0, Number(user.points || 0)) + reward.totalPoints;
  const rankProgress = computeRankProgress(nextPoints);

  user.points = nextPoints;
  user.currentRank = rankProgress.currentRank;
  user.nextRank = rankProgress.nextRank;
  user.nextThreshold = rankProgress.nextThreshold;
  await user.save();

  ticket.payment = {
    ...payment,
    rewardPointsGranted: true,
    rewardPointsGrantedAt: new Date().toISOString(),
    rewardPointsAwarded: reward.totalPoints,
    rewardPointsBreakdown: {
      ticketCount: reward.ticketCount,
      ticketPoints: reward.ticketPoints,
      amountPoints: reward.amountPoints,
      totalAmount: reward.totalAmount,
    },
    rewardUserEmail: email,
  };

  await ticket.save();

  return {
    skipped: false,
    email,
    awarded: reward.totalPoints,
    pointsAfterAward: nextPoints,
    rankAfterAward: rankProgress.currentRank,
  };
}

async function ensurePassengerAccountForTicket(ticket) {
  const email = normalizeEmail(ticket?.email || ticket?.passengerInfo?.email);
  if (!email) {
    return { status: "missing-email", email: "" };
  }

  const existingUser = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });
  if (existingUser) {
    return { status: "existing", email: normalizeEmail(existingUser.email) };
  }

  const tempPassword = generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const fullName = String(ticket?.passengerInfo?.fullName || "").trim() || "Khach hang SKYLINE";

  const createdUser = await User.create({
    fullName,
    email,
    password: hashedPassword,
    avatar: "assets/img/AVT1.jpg",
    currentRank: "Đồng",
    points: 0,
    nextRank: "Bạc",
    nextThreshold: 500,
    country: "Việt Nam",
    status: "active",
    phone: String(ticket?.passengerInfo?.phoneNumber || ticket?.passengerInfo?.phone || "").trim(),
    birthday: null,
    gender: "",
    passport: String(ticket?.passengerInfo?.idNumber || "").trim(),
    passportExpiry: null,
    address: String(ticket?.passengerInfo?.address || "").trim(),
  });

  return {
    status: "created",
    email: normalizeEmail(createdUser.email),
    tempPassword,
  };
}

async function sendTicketEmailForSuccessfulPayment(ticket) {
  const currentPayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
  if (currentPayment.emailSent === true && currentPayment.accountEmailSent !== false) {
    return { sent: true, skipped: true, reason: "already-sent" };
  }

  const accountResult = await ensurePassengerAccountForTicket(ticket);
  let accountMailResult = { sent: false, reason: "not-required" };
  if (accountResult.status === "created") {
    accountMailResult = await sendAccountCredentialsEmail({
      recipient: accountResult.email,
      fullName: String(ticket?.passengerInfo?.fullName || "").trim(),
      tempPassword: accountResult.tempPassword,
    });
  }

  const ticketMailResult = await sendBookingIssuedEmail({ ticket });

  const nextPayment = {
    ...currentPayment,
    emailSent: Boolean(ticketMailResult.sent),
    emailSentAt: ticketMailResult.sent ? new Date().toISOString() : currentPayment.emailSentAt,
    emailMessageId: ticketMailResult.messageId || currentPayment.emailMessageId || "",
    emailRecipient: ticketMailResult.recipient || normalizeEmail(ticket?.email),
    emailError: ticketMailResult.sent ? "" : String(ticketMailResult.reason || "send-failed"),
    accountEmailSent: accountResult.status === "created" ? Boolean(accountMailResult.sent) : true,
    accountEmailSentAt: accountMailResult.sent ? new Date().toISOString() : currentPayment.accountEmailSentAt,
    accountEmailMessageId: accountMailResult.messageId || currentPayment.accountEmailMessageId || "",
    accountEmailError:
      accountResult.status === "created" && !accountMailResult.sent
        ? String(accountMailResult.reason || "send-account-email-failed")
        : "",
    accountStatus: accountResult.status,
    accountEmail: accountResult.email,
    accountCreatedByBookingFlow: accountResult.status === "created",
  };

  ticket.payment = nextPayment;
  await ticket.save();

  return {
    sent: Boolean(ticketMailResult.sent),
    ticketMailResult,
    accountMailResult,
    accountResult,
  };
}

exports.createBooking = async (req, res) => {
  try {
    const payload = req.body || {};
    const requestedFlightId = String(payload.flightId || payload.flight?.id || "").trim();
    const normalizedSeat = normalizeSeatCode(payload.seat);

    if (!requestedFlightId) {
      return res.status(400).json({ success: false, message: "Thiếu flightId." });
    }

    if (!normalizedSeat) {
      return res.status(400).json({ success: false, message: "Thiếu mã ghế." });
    }

    const flight = await findFlightByAnyId(requestedFlightId);
    if (!flight) {
      return res.status(404).json({ success: false, message: "Không tìm thấy chuyến bay." });
    }

    const seatTakenInFlight = parseBookedSeatsFromFlight(flight).includes(normalizedSeat);
    const seatTakenByTicket = await Ticket.exists({
      flightId: flight._id,
      seat: normalizedSeat,
      status: { $nin: Array.from(INACTIVE_STATUSES) },
    });

    if (seatTakenInFlight || seatTakenByTicket) {
      return res.status(409).json({ success: false, message: "Ghế đã được đặt. Vui lòng chọn ghế khác." });
    }

    const ticketCode = await generateTicketCode();
    const seatType = resolveSeatType(normalizedSeat, payload.seatType);
    const passengerInfo = payload.passengerInfo && typeof payload.passengerInfo === "object" ? payload.passengerInfo : {};
    const baggageOption = payload.baggageOption && typeof payload.baggageOption === "object" ? payload.baggageOption : null;
    const payment = payload.payment && typeof payload.payment === "object" ? payload.payment : {};
    const totalAmount = Number(payload.totalAmount || 0);

    const ticket = new Ticket({
      ticketCode,
      flightId: flight._id,
      flight: payload.flight && typeof payload.flight === "object" ? payload.flight : buildFlightSnapshot(flight),
      passengerInfo,
      seat: normalizedSeat,
      seatType,
      baggageOption,
      payment: {
        ...payment,
        baggageOption,
      },
      totalAmount,
      status: "pending",
      paymentStatus: "pending",
      bookingDate: payload.bookingDate || new Date().toISOString(),
      departure: String(payload?.flight?.from || flight?.from || ""),
      arrival: String(payload?.flight?.to || flight?.to || ""),
      phone: String(passengerInfo?.phoneNumber || passengerInfo?.phone || ""),
      email: String(passengerInfo?.email || "")
        .trim()
        .toLowerCase(),
      price: Number(payload?.flight?.price || totalAmount || 0),
      fare: {
        type: seatType,
        price: Number(payload?.flight?.price || 0),
      },
      baggage: baggageOption
        ? {
            code: baggageOption.code,
            name: baggageOption.name,
            price: Number(baggageOption.price || 0),
          }
        : null,
      totalPrice: totalAmount,
      complaint: false,
      paymentMethod: String(payment.method || "").trim(),
      transactionId: String(payment.transactionRef || "").trim(),
    });

    const savedTicket = await ticket.save();

    try {
      await saveSeatToFlight(flight, normalizedSeat);
    } catch (syncError) {
      await Ticket.findByIdAndDelete(savedTicket._id);
      throw syncError;
    }

    return res.status(201).json({
      success: true,
      booking: toBookingResponse(savedTicket),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBooking = async (req, res) => {
  try {
    const { ticketCode } = req.params;
    const ticket = await Ticket.findOne({ ticketCode: String(ticketCode || "").trim() });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
    }

    return res.json({ success: true, booking: toBookingResponse(ticket) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTicketsForUser = async (req, res) => {
  try {
    const email = String(req.query.email || "")
      .trim()
      .toLowerCase();

    const query = email
      ? {
          $or: [
            { email: new RegExp(`^${email}$`, "i") },
            { "passengerInfo.email": new RegExp(`^${email}$`, "i") },
          ],
        }
      : {};

    const tickets = await Ticket.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, tickets: tickets.map(toBookingResponse) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTicketForUser = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketCode: String(req.params.ticketCode || "").trim() });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy vé." });
    }

    return res.json({ success: true, ticket: toBookingResponse(ticket) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const ticketCode = String(req.params.ticketCode || "").trim();
    const nextStatus = normalizeStatus(req.body?.status);
    const paymentData = req.body?.paymentData && typeof req.body.paymentData === "object" ? req.body.paymentData : {};

    const ticket = await Ticket.findOne({ ticketCode });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
    }

    const currentPayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
    const mergedPayment = { ...currentPayment, ...paymentData };

    if (nextStatus === "processing") {
      const adminNotification = await createVerificationNotification(ticket, mergedPayment.payerName);
      if (adminNotification) {
        emitRealtime("admin_notification_created", adminNotification.toObject(), { room: "admins" });
      }
    }

    if (nextStatus === "paid" || nextStatus === "issued") {
      mergedPayment.paidAt = mergedPayment.paidAt || new Date().toISOString();
      delete mergedPayment.failedAt;
    }

    if (nextStatus === "failed") {
      mergedPayment.failedAt = new Date().toISOString();
    }

    ticket.status = nextStatus;
    ticket.paymentStatus = nextStatus;
    ticket.payment = mergedPayment;
    ticket.transactionId = String(mergedPayment.transactionRef || ticket.transactionId || "").trim();
    ticket.paymentMethod = String(mergedPayment.method || ticket.paymentMethod || "").trim();

    await ticket.save();

    emitRealtime(
      "booking_payment_updated",
      {
        ticketCode: ticket.ticketCode,
        paymentStatus: ticket.paymentStatus,
        status: ticket.status,
        updatedAt: new Date().toISOString(),
      },
      { room: `booking:${ticket.ticketCode}` }
    );

    if (nextStatus === "paid" || nextStatus === "issued") {
      try {
        await sendTicketEmailForSuccessfulPayment(ticket);
      } catch (emailError) {
        const safePayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
        ticket.payment = {
          ...safePayment,
          emailSent: false,
          emailError: emailError.message,
          emailSentAt: safePayment.emailSentAt,
        };
        await ticket.save();
      }

      try {
        await applyRewardPointsForSuccessfulBooking(ticket);
      } catch (rewardError) {
        const safePayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
        ticket.payment = {
          ...safePayment,
          rewardPointsGranted: Boolean(safePayment.rewardPointsGranted),
          rewardPointsError: String(rewardError?.message || "reward-points-failed"),
        };
        await ticket.save();
      }
    }

    return res.json({ success: true, booking: toBookingResponse(ticket) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePaymentStatusByAdmin = async (req, res) => {
  try {
    const ticketCode = String(req.params.ticketCode || "").trim();
    const status = normalizeStatus(req.body?.paymentStatus);

    if (status !== "paid" && status !== "failed") {
      return res.status(400).json({ success: false, message: "paymentStatus must be paid or failed" });
    }

    const ticket = await Ticket.findOne({ ticketCode });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
    }

    const currentPayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
    const payment = { ...currentPayment };

    if (status === "paid") {
      payment.paidAt = new Date().toISOString();
      delete payment.failedAt;
    }

    if (status === "failed") {
      payment.failedAt = new Date().toISOString();
    }

    ticket.status = status;
    ticket.paymentStatus = status;
    ticket.payment = payment;

    await ticket.save();

    await Notification.updateMany(
      { bookingId: ticket.ticketCode, type: "payment_verification", isRead: false },
      { isRead: true }
    );

    const userNotification = await createUserPaymentNotification(ticket, status);
    const userEmail = String(ticket.email || ticket.passengerInfo?.email || "")
      .trim()
      .toLowerCase();

    emitRealtime(
      "booking_payment_updated",
      {
        ticketCode: ticket.ticketCode,
        paymentStatus: status,
        status,
        message: status === "paid" ? "Thanh toán thành công" : "Thanh toán thất bại",
        updatedAt: new Date().toISOString(),
      },
      { room: `booking:${ticket.ticketCode}` }
    );

    if (userNotification && userEmail) {
      emitRealtime("user_notification_created", userNotification.toObject(), { room: `user:${userEmail}` });
    }

    if (status === "paid") {
      try {
        await sendTicketEmailForSuccessfulPayment(ticket);
      } catch (emailError) {
        const safePayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
        ticket.payment = {
          ...safePayment,
          emailSent: false,
          emailError: emailError.message,
          emailSentAt: safePayment.emailSentAt,
        };
        await ticket.save();
      }

      try {
        await applyRewardPointsForSuccessfulBooking(ticket);
      } catch (rewardError) {
        const safePayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
        ticket.payment = {
          ...safePayment,
          rewardPointsGranted: Boolean(safePayment.rewardPointsGranted),
          rewardPointsError: String(rewardError?.message || "reward-points-failed"),
        };
        await ticket.save();
      }
    }

    return res.json({ success: true, booking: toBookingResponse(ticket) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendAccountEmail = async (req, res) => {
  try {
    const ticketCode = String(req.params.ticketCode || "").trim();
    const ticket = await Ticket.findOne({ ticketCode });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
    }

    const currentPayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
    const payload = req.body && typeof req.body === "object" ? req.body : {};

    ticket.payment = {
      ...currentPayment,
      emailSent: false,
      accountEmailRequest: payload,
      accountEmailUpdatedAt: new Date().toISOString(),
      emailPayload: {
        accountStatus: payload.accountStatus || "unknown",
        notificationCreated: Boolean(payload.notificationCreated),
      },
      emailSentAt: new Date().toISOString(),
    };

    await ticket.save();

    return res.json({ success: true, booking: toBookingResponse(ticket) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
