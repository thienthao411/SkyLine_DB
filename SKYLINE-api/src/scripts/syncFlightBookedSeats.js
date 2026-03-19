require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Flight = require("../models/Flight");
const Ticket = require("../models/Ticket");

const INACTIVE_STATUSES = new Set(["cancelled", "canceled", "huy", "hủy", "failed", "expired"]);

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

function isBusinessSeat(seat) {
  const normalized = normalizeSeatCode(seat);
  const matched = normalized.match(/^[A-Z](\d{2})$/);
  if (!matched) return false;
  return Number(matched[1]) <= 5;
}

function buildBusinessSeatPool() {
  const pool = [];
  for (let row = 1; row <= 5; row += 1) {
    for (const col of ["A", "B", "C"]) {
      pool.push(`${col}${String(row).padStart(2, "0")}`);
    }
  }
  return pool;
}

function buildEconomySeatPool() {
  const pool = [];
  for (let row = 6; row <= 29; row += 1) {
    for (const col of ["A", "B", "C", "D"]) {
      pool.push(`${col}${String(row).padStart(2, "0")}`);
    }
  }
  return pool;
}

function shuffle(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function pickRandomUnique(pool, targetCount, existingSet) {
  if (targetCount <= 0) return [];

  const available = shuffle(pool.filter((seat) => !existingSet.has(seat)));
  return available.slice(0, targetCount);
}

async function run() {
  await connectDB();

  const businessPool = buildBusinessSeatPool();
  const economyPool = buildEconomySeatPool();
  const mapPool = [...businessPool, ...economyPool];
  const mapPoolSet = new Set(mapPool);

  const flights = await Flight.find({}, { _id: 1, details: 1, seatsBookedBusiness: 1, seatsBookedEconomy: 1, seatsBookedTotal: 1 }).lean();
  let updatedFlights = 0;

  for (const flight of flights) {
    const tickets = await Ticket.find({ flightId: flight._id }, { seat: 1, status: 1 }).lean();

    const ticketSeats = tickets
      .filter((ticket) => {
        const status = String(ticket?.status || "").trim().toLowerCase();
        return !status || !INACTIVE_STATUSES.has(status);
      })
      .map((ticket) => normalizeSeatCode(ticket?.seat))
      .filter((seat) => mapPoolSet.has(seat));

    const existingBookedSeats = Array.isArray(flight?.details?.bookedSeats)
      ? flight.details.bookedSeats.map((seat) => normalizeSeatCode(seat)).filter((seat) => mapPoolSet.has(seat))
      : [];

    const targetBusinessRaw = Number(flight?.seatsBookedBusiness || 0);
    const targetEconomyRaw = Number(flight?.seatsBookedEconomy || 0);
    const targetTotalRaw = Number(flight?.seatsBookedTotal || 0);

    let targetBusiness = Math.max(targetBusinessRaw, ticketSeats.filter((seat) => isBusinessSeat(seat)).length);
    let targetEconomy = Math.max(targetEconomyRaw, ticketSeats.filter((seat) => !isBusinessSeat(seat)).length);
    let targetTotal = Math.max(targetTotalRaw, ticketSeats.length);

    targetBusiness = Math.min(targetBusiness, businessPool.length);
    targetEconomy = Math.min(targetEconomy, economyPool.length);
    targetTotal = Math.min(targetTotal, mapPool.length);

    if (targetBusiness + targetEconomy < targetTotal) {
      const remain = targetTotal - (targetBusiness + targetEconomy);
      const extraEconomyCapacity = economyPool.length - targetEconomy;
      const extraBusinessCapacity = businessPool.length - targetBusiness;

      const addEconomy = Math.min(remain, extraEconomyCapacity);
      targetEconomy += addEconomy;

      const stillRemain = remain - addEconomy;
      const addBusiness = Math.min(stillRemain, extraBusinessCapacity);
      targetBusiness += addBusiness;
    }

    const chosen = new Set([...existingBookedSeats, ...ticketSeats]);

    const chosenBusiness = Array.from(chosen).filter((seat) => isBusinessSeat(seat)).length;
    const chosenEconomy = Array.from(chosen).filter((seat) => !isBusinessSeat(seat)).length;

    const needBusiness = Math.max(0, targetBusiness - chosenBusiness);
    const needEconomy = Math.max(0, targetEconomy - chosenEconomy);

    for (const seat of pickRandomUnique(businessPool, needBusiness, chosen)) {
      chosen.add(seat);
    }

    for (const seat of pickRandomUnique(economyPool, needEconomy, chosen)) {
      chosen.add(seat);
    }

    if (chosen.size < targetTotal) {
      const extra = pickRandomUnique(mapPool, targetTotal - chosen.size, chosen);
      for (const seat of extra) chosen.add(seat);
    }

    const finalSeats = Array.from(chosen);
    const finalBusiness = finalSeats.filter((seat) => isBusinessSeat(seat)).length;
    const finalEconomy = finalSeats.length - finalBusiness;

    const details = {
      ...(flight.details || {}),
      bookedSeats: finalSeats,
    };

    await Flight.findByIdAndUpdate(flight._id, {
      $set: {
        details,
        seatsBookedBusiness: finalBusiness,
        seatsBookedEconomy: finalEconomy,
        seatsBookedTotal: finalSeats.length,
      },
    });

    updatedFlights += 1;
  }

  console.log(`Synchronized booked seats for ${updatedFlights} flights.`);
  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("syncFlightBookedSeats failed:", error.message);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
