const Airline = require("../models/Airline");
const { uploadBufferToCloudinary } = require("../upload");

function normalizeAirlinePayload(payload = {}, { allowDeleted = false } = {}) {
  const normalized = { ...payload };

  if (typeof normalized.airlineCode === "string") {
    normalized.airlineCode = normalized.airlineCode.trim().toUpperCase();
  }

  if (typeof normalized.status === "string") {
    normalized.status = normalized.status.trim().toLowerCase();
  }

  if (typeof normalized.img === "string") {
    normalized.img = normalized.img.trim();
  }

  if (typeof normalized.logo === "string") {
    normalized.logo = normalized.logo.trim();
  }

  if (!normalized.img && normalized.logo) {
    normalized.img = normalized.logo;
  }

  if (!normalized.logo && normalized.img) {
    normalized.logo = normalized.img;
  }

  if (typeof normalized.commissionRate === "string") {
    const parsedCommissionRate = Number(normalized.commissionRate);
    normalized.commissionRate = Number.isFinite(parsedCommissionRate) ? parsedCommissionRate : 0;
  }

  if (!allowDeleted && normalized.status === "deleted") {
    const error = new Error('Status "deleted" is only for soft delete.');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function handleAirlineError(res, error) {
  const statusCode =
    error.statusCode ||
    (error.name === "ValidationError" || error.name === "CastError" || error.name === "MulterError" ? 400 : 500);

  return res.status(statusCode).json({ error: error.message });
}

async function appendUploadedImage(payload, file) {
  if (!file) {
    return payload;
  }

  const publicId = payload.airlineCode ? `${payload.airlineCode}-${Date.now()}` : undefined;
  const uploadedImage = await uploadBufferToCloudinary(file, {
    folder: "skyline/airlines",
    publicId
  });

  return {
    ...payload,
    img: uploadedImage?.secure_url || uploadedImage?.url || payload.img || payload.logo || "",
    logo: uploadedImage?.secure_url || uploadedImage?.url || payload.logo || payload.img || ""
  };
}

exports.getAirlines = async (req, res) => {
  try {
    const includeDeleted = String(req.query.includeDeleted || "").trim().toLowerCase() === "true";
    const filter = includeDeleted ? {} : { status: { $ne: "deleted" } };
    const airlines = await Airline.find(filter).sort({ createdAt: -1 });
    res.json(airlines);
  } catch (error) {
    handleAirlineError(res, error);
  }
};

exports.createAirline = async (req, res) => {
  try {
    const payload = await appendUploadedImage(normalizeAirlinePayload(req.body), req.file);
    const airline = new Airline(payload);
    const saved = await airline.save();
    res.status(201).json(saved);
  } catch (error) {
    handleAirlineError(res, error);
  }
};

exports.updateAirline = async (req, res) => {
  try {
    const payload = await appendUploadedImage(
      normalizeAirlinePayload(req.body, { allowDeleted: true }),
      req.file
    );

    const updated = await Airline.findByIdAndUpdate(
      req.params.id,
      payload,
      { returnDocument: 'after', runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Airline not found" });
    }

    res.json(updated);
  } catch (error) {
    handleAirlineError(res, error);
  }
};
