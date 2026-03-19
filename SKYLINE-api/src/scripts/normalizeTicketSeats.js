require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Ticket = require("../models/Ticket");

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

async function run() {
  await connectDB();

  const tickets = await Ticket.find({}, { _id: 1, seat: 1 }).lean();
  const operations = [];

  for (const ticket of tickets) {
    const current = String(ticket?.seat || "");
    const normalized = normalizeSeatCode(current);

    if (normalized && normalized !== current) {
      operations.push({
        updateOne: {
          filter: { _id: ticket._id },
          update: { $set: { seat: normalized } },
        },
      });
    }
  }

  if (operations.length === 0) {
    console.log("No ticket seat values needed normalization.");
  } else {
    const result = await Ticket.bulkWrite(operations);
    console.log(`Normalized ${result.modifiedCount || 0} ticket seat values.`);
  }

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("Seat normalization failed:", error.message);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
