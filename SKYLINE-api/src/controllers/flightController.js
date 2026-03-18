const mongoose = require("mongoose");
const Flight = require("../models/Flight");

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
    airline_code: context.airlineCode,
    itinerary: { segments },
    perks: Array.isArray(rawDetails?.perks) ? rawDetails.perks : [],
    fare_options: fareOptions,
    fromAirportName: raw?.fromAirportName || rawDetails?.fromAirportName || null,
    toAirportName: raw?.toAirportName || rawDetails?.toAirportName || null,
    stops: raw?.stops ?? rawDetails?.stops ?? 0,
    stopsLabel: raw?.stopsLabel || rawDetails?.stopsLabel || "Bay thang",
  };
}

function mapFlightForClient(doc, requestedCabin = "") {
  const raw = typeof doc?.toObject === "function" ? doc.toObject() : doc;
  const date = String(raw?.date || "").trim();
  const from = String(raw?.from || "").trim().toUpperCase();
  const to = String(raw?.to || "").trim().toUpperCase();
  const airlineCode = String(raw?.airlineCode || raw?.details?.airline_code || "").trim().toUpperCase();
  const cabin = pickCabin(raw, requestedCabin);
  const departTime = normalizeDateTime(date, raw?.departTime);
  const arriveTime = normalizeDateTime(date, raw?.arriveTime);
  const flightNo = String(raw?.flightNo || "");

  return {
    id: String(raw?._id),
    airline: String(raw?.airline || "Unknown"),
    flightNo,
    from,
    to,
    date,
    departTime,
    arriveTime,
    durationMin: Number(raw?.durationMin ?? 0),
    price: pickPrice(raw, cabin),
    currency: String(raw?.currency || "VND"),
    seatsLeft: pickSeatsLeft(raw, cabin),
    cabin,
    details: mapFlightDetails(raw, {
      airlineCode,
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

    res.json({
      success: true,
      flight: mapFlightForClient(flight, requestedCabin)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    const updated = await Flight.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
