const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const Flight = require("../models/Flight");

const INACTIVE_STATUSES = new Set(["cancelled", "canceled", "huy", "hủy", "failed", "expired"]);
const ALLOWED_STATUSES = new Set(["pending", "processing", "paid", "issued", "failed", "expired", "cancelled", "booked", "completed"]);

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
    const suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
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
  return {
    ticketCode: ticketDoc.ticketCode,
    flightId: String(ticketDoc.flightId || ""),
    flight: ticketDoc.flight || {},
    passengerInfo: ticketDoc.passengerInfo || {},
    seat: ticketDoc.seat,
    seatType: ticketDoc.seatType || "",
    baggageOption: ticketDoc.baggageOption || null,
    totalAmount: Number(ticketDoc.totalAmount || ticketDoc.totalPrice || 0),
    payment: ticketDoc.payment || {},
    bookingDate: ticketDoc.bookingDate || new Date(ticketDoc.createdAt || Date.now()).toISOString(),
    status: ticketDoc.status || "pending",
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
      payment,
      totalAmount,
      status: "pending",
      bookingDate: payload.bookingDate || new Date().toISOString(),
      departure: String(payload?.flight?.from || flight?.from || ""),
      arrival: String(payload?.flight?.to || flight?.to || ""),
      phone: String(passengerInfo?.phoneNumber || ""),
      email: String(passengerInfo?.email || "").trim().toLowerCase(),
      price: Number(payload?.flight?.price || 0),
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

exports.updateBookingStatus = async (req, res) => {
  try {
    const { ticketCode } = req.params;
    const nextStatusRaw = String(req.body?.status || "").trim().toLowerCase();

    if (!ALLOWED_STATUSES.has(nextStatusRaw)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ." });
    }

    const ticket = await Ticket.findOne({ ticketCode: String(ticketCode || "").trim() });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
    }

    const currentPayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
    const extraPayment = req.body?.paymentData && typeof req.body.paymentData === "object" ? req.body.paymentData : {};

    const mergedPayment = {
      ...currentPayment,
      ...extraPayment,
    };

    if (nextStatusRaw === "paid" || nextStatusRaw === "issued") {
      if (!mergedPayment.paidAt) {
        mergedPayment.paidAt = new Date().toISOString();
      }
    }

    ticket.status = nextStatusRaw;
    ticket.payment = mergedPayment;
    await ticket.save();

    return res.json({ success: true, booking: toBookingResponse(ticket) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendAccountEmail = async (req, res) => {
  try {
    const { ticketCode } = req.params;
    const ticket = await Ticket.findOne({ ticketCode: String(ticketCode || "").trim() });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
    }

    const currentPayment = ticket.payment && typeof ticket.payment === "object" ? ticket.payment : {};
    const payload = req.body && typeof req.body === "object" ? req.body : {};

    ticket.payment = {
      ...currentPayment,
      emailSent: false,
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
