const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");

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

exports.getTickets = async (req, res) => {
  try {
    const { flightId, email } = req.query;
    const filter = {};

    if (typeof email === 'string' && email.trim()) {
      filter.email = email.trim().toLowerCase();
    }

    if (typeof flightId === 'string' && flightId.trim()) {
      const normalizedFlightId = flightId.trim();
      if (mongoose.Types.ObjectId.isValid(normalizedFlightId)) {
        filter.flightId = new mongoose.Types.ObjectId(normalizedFlightId);
      } else {
        filter.flightId = normalizedFlightId;
      }
    }

    const tickets = await Ticket.find(filter);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.seat != null) {
      payload.seat = normalizeSeatCode(payload.seat);
    }

    const ticket = new Ticket(payload);
    const saved = await ticket.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.seat != null) {
      payload.seat = normalizeSeatCode(payload.seat);
    }

    const updated = await Ticket.findByIdAndUpdate(req.params.id, payload, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ message: 'Ticket not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const deleted = await Ticket.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Ticket not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};