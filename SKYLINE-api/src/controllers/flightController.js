const mongoose = require("mongoose");
const Flight = require("../models/Flight");
const Ticket = require("../models/Ticket");
const Airline = require("../models/Airline");

const KNOWN_AIRLINE_NAME_BY_CODE = {
  VN: "Vietnam Airlines",
  VJ: "Vietjet",
  QH: "Bamboo Airways",
  "0V": "VASCO",
  VU: "Vietravel Airlines",
  BL: "Pacific Airlines",
};

function normalizeDateTime(date, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("T")) return raw;

  if (/^\d{2}:\d{2}$/.test(raw)) {
    return `${date}T${raw}:00+07:00`;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${date}T${raw}+07:00`;
  }

  return raw;
}

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

function pickCabin(raw, requestedCabin) {
  if (requestedCabin) return requestedCabin;
  if (raw?.cabin) return raw.cabin;
  if (raw?.priceEconomy != null) return "Economy";
  if (raw?.priceBusiness != null) return "Business";
  return "Economy";
}

function pickPrice(raw, cabin) {
  if (cabin === "Business") {
    return Number(raw?.priceBusiness ?? raw?.priceEconomy ?? 0);
  }

  return Number(raw?.priceEconomy ?? raw?.priceBusiness ?? 0);
}

function pickSeatsLeft(raw, cabin) {
  if (cabin === "Business") {
    const max = Number(raw?.seatsBusinessMax ?? 0);
    const booked = Number(raw?.seatsBookedBusiness ?? 0);
    return max > 0 ? Math.max(0, max - booked) : 0;
  }

  const max = Number(raw?.seatsEconomyMax ?? raw?.seatsMax ?? 0);
  const booked = Number(raw?.seatsBookedEconomy ?? raw?.seatsBookedTotal ?? 0);
  return max > 0 ? Math.max(0, max - booked) : 0;
}

function buildFareType(fareClass, airlineCode) {
  const cls = String(fareClass || "").trim().toLowerCase();
  const code = String(airlineCode || "").trim().toUpperCase() || "FL";

  if (cls === "business") return `${code} Business`;
  if (cls === "economy") return `${code} Economy`;
  return `${code} Fare`;
}

function mapFlightDetails(raw, context) {
  const rawDetails = raw?.details ?? {};
  const rawSegments = Array.isArray(rawDetails?.itinerary?.segments)
    ? rawDetails.itinerary.segments
    : [];

  const segments = rawSegments.length
    ? rawSegments.map((segment) => ({
        origin: String(segment?.origin || segment?.from || context.from).toUpperCase(),
        destination: String(segment?.destination || segment?.to || context.to).toUpperCase(),
        depart: normalizeDateTime(context.date, segment?.depart || segment?.departTime || context.departTime),
        arrive: normalizeDateTime(context.date, segment?.arrive || segment?.arriveTime || context.arriveTime),
        aircraft: segment?.aircraft || null,
        flightNo: String(segment?.flightNo || context.flightNo),
      }))
    : [
        {
          origin: context.from,
          destination: context.to,
          depart: context.departTime,
          arrive: context.arriveTime,
          aircraft: rawDetails?.aircraft || null,
          flightNo: context.flightNo,
        },
      ];

  const fareOptions = Array.isArray(rawDetails?.fare_options)
    ? rawDetails.fare_options.map((option) => ({
        type: option?.type || buildFareType(option?.class, context.airlineCode),
        baggage: option?.baggage ?? null,
        change_fee: option?.change_fee ?? null,
        refundable: Boolean(option?.refundable),
        price: Number(option?.price ?? 0),
      }))
    : [];

  return {
    ...rawDetails,
    airline_id: context.airlineId,
    airline_code: context.airlineCode,
    logo: context.logo || rawDetails?.logo || null,
    itinerary: { segments },
    perks: Array.isArray(rawDetails?.perks) ? rawDetails.perks : [],
    fare_options: fareOptions,
    fromAirportName: raw?.fromAirportName || rawDetails?.fromAirportName || null,
    toAirportName: raw?.toAirportName || rawDetails?.toAirportName || null,
    stops: raw?.stops ?? rawDetails?.stops ?? 0,
    stopsLabel: raw?.stopsLabel || rawDetails?.stopsLabel || "Bay thang",
  };
}

function mapFlightForClient(doc, requestedCabin = "", airlineMeta = null) {
  const raw = typeof doc?.toObject === "function" ? doc.toObject() : doc;
  const date = String(raw?.date || "").trim();
  const from = String(raw?.from || "").trim().toUpperCase();
  const to = String(raw?.to || "").trim().toUpperCase();
  const flightNo = String(raw?.flightNo || "");
  const inferredAirlineCode = String(flightNo).trim().toUpperCase().slice(0, 2);
  const airlineId = String(raw?.airlineId || raw?.details?.airline_id || airlineMeta?._id || "").trim();
  const airlineCode = String(
    raw?.airlineCode
    || raw?.details?.airline_code
    || airlineMeta?.airlineCode
    || inferredAirlineCode
    || ""
  ).trim().toUpperCase();
  const airlineName = String(
    raw?.airline
    || raw?.details?.airline
    || airlineMeta?.airlineName
    || KNOWN_AIRLINE_NAME_BY_CODE[airlineCode]
    || "Unknown"
  ).trim();
  const cabin = pickCabin(raw, requestedCabin);
  const departTime = normalizeDateTime(date, raw?.departTime);
  const arriveTime = normalizeDateTime(date, raw?.arriveTime);

  return {
    id: String(raw?._id),
    airlineId,
    airlineCode,
    airline: airlineName,
    flightNo,
    from,
    to,
    date,
    departTime,
    arriveTime,
    durationMin: Number(raw?.durationMin ?? 0),
    price: pickPrice(raw, cabin),
    priceEconomy: Number(raw?.priceEconomy ?? 0),
    priceBusiness: Number(raw?.priceBusiness ?? 0),
    economyPrice: Number(raw?.priceEconomy ?? 0),
    businessPrice: Number(raw?.priceBusiness ?? 0),
    currency: String(raw?.currency || "VND"),
    seatsLeft: pickSeatsLeft(raw, cabin),
    cabin,
    details: mapFlightDetails(raw, {
      airlineId,
      airlineCode,
      logo: String(airlineMeta?.img || airlineMeta?.logo || "").trim(),
      from,
      to,
      date,
      flightNo,
      departTime,
      arriveTime,
    }),
    fromAirport: raw?.fromAirportName || raw?.details?.fromAirportName || null,
    toAirport: raw?.toAirportName || raw?.details?.toAirportName || null,
  };
}

exports.searchFlights = async (req, res) => {
  try {
    const { from, to, date } = req.query;

    if (!from || !to || !date) {
      return res.status(400).json({
        message: "Missing required query params: from, to, date"
      });
    }

    const flights = await Flight.find({
      from: String(from).trim().toUpperCase(),
      to: String(to).trim().toUpperCase(),
      date: String(date).trim()
    });

    res.json(flights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFlightById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedCabin = String(req.query.cabin || "").trim();

    let flight = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      flight = await Flight.findById(id);
    }

    if (!flight) {
      flight = await Flight.findOne({ flightId: id });
    }

    if (!flight) {
      return res.status(404).json({
        success: false,
        message: "Flight not found"
      });
    }

    const airlineCodeFromFlightNo = String(flight?.flightNo || "").trim().toUpperCase().slice(0, 2);
    const airlineLookup = {
      _id: flight?.airlineId,
      airlineCode: flight?.airlineCode || flight?.details?.airline_code || airlineCodeFromFlightNo,
    };
    const airlineMeta =
      (airlineLookup._id && await Airline.findById(airlineLookup._id, { airlineName: 1, airlineCode: 1, img: 1, logo: 1 }).lean())
      || (airlineLookup.airlineCode && await Airline.findOne({ airlineCode: airlineLookup.airlineCode }, { airlineName: 1, airlineCode: 1, img: 1, logo: 1 }).lean())
      || null;

    res.json({
      success: true,
      flight: mapFlightForClient(flight, requestedCabin, airlineMeta)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOccupiedSeatsByFlightId = async (req, res) => {
  try {
    const { id } = req.params;

    let flight = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      flight = await Flight.findById(id);
    }

    if (!flight) {
      flight = await Flight.findOne({ flightId: id });
    }

    if (!flight) {
      return res.status(404).json({
        success: false,
        message: "Flight not found",
        occupiedSeats: [],
      });
    }

    const cancelledStatuses = new Set(["cancelled", "canceled", "huy", "hủy"]);

    const tickets = await Ticket.find({ flightId: flight._id }, { seat: 1, status: 1 });

    const seatsFromTickets = tickets
      .filter((ticket) => {
        const status = String(ticket?.status || "").trim().toLowerCase();
        return !status || !cancelledStatuses.has(status);
      })
      .map((ticket) => normalizeSeatCode(ticket?.seat))
      .filter(Boolean);

    const seatsFromFlight = Array.isArray(flight?.details?.bookedSeats)
      ? flight.details.bookedSeats.map((seat) => normalizeSeatCode(seat)).filter(Boolean)
      : [];

    const occupiedSeats = Array.from(new Set([...seatsFromFlight, ...seatsFromTickets]));

    return res.json({
      success: true,
      occupiedSeats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      occupiedSeats: [],
    });
  }
};

exports.getFlights = async (req, res) => {
  try {
    const flights = await Flight.find();
    res.json(flights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createFlight = async (req, res) => {
  try {
    const flight = new Flight(req.body);
    const saved = await flight.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateFlight = async (req, res) => {
  try {
    const updated = await Flight.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ message: 'Flight not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteFlight = async (req, res) => {
  try {
    const deleted = await Flight.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Flight not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
