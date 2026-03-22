const Airport = require("../models/Airport");

function normalizeAirportPayload(payload = {}) {
  const normalized = { ...payload };

  if (typeof normalized.code === "string") {
    normalized.code = normalized.code.trim().toUpperCase();
  }

  if (typeof normalized.icao === "string") {
    normalized.icao = normalized.icao.trim().toUpperCase();
  }

  if (typeof normalized.name === "string") {
    normalized.name = normalized.name.trim();
  }

  if (typeof normalized.city === "string") {
    normalized.city = normalized.city.trim();
  }

  if (typeof normalized.province === "string") {
    normalized.province = normalized.province.trim();
  }

  if (typeof normalized.country === "string") {
    normalized.country = normalized.country.trim();
  }

  normalized.displayName =
    String(normalized.displayName || "").trim() ||
    `${normalized.code || ""} - ${normalized.name || ""}`.trim();

  normalized.isActive = normalized.isActive !== false;

  if (normalized.sortOrder !== undefined) {
    const parsedSortOrder = Number(normalized.sortOrder);
    normalized.sortOrder = Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0;
  }

  return normalized;
}

exports.getAirports = async (_req, res) => {
  try {
    const airports = await Airport.find({ isActive: { $ne: false } })
      .sort({ sortOrder: 1, code: 1 })
      .lean();

    res.json(airports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAirportsForAdmin = async (_req, res) => {
  try {
    const airports = await Airport.find({})
      .sort({ sortOrder: 1, code: 1 })
      .lean();

    res.json(airports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAirport = async (req, res) => {
  try {
    const payload = normalizeAirportPayload(req.body);
    const airport = new Airport(payload);
    const saved = await airport.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateAirport = async (req, res) => {
  try {
    const payload = normalizeAirportPayload(req.body);
    const updated = await Airport.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Airport not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
