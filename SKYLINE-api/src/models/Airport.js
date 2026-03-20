const mongoose = require("mongoose");

const airportSchema = new mongoose.Schema(
  {
    code: String,
    name: String,
    city: String,
    icao: String,
    province: String,
    country: String,
    displayName: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: Number,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Airport", airportSchema);
