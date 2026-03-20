const mongoose = require('mongoose');

const airportSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true, index: true },
  province: { type: String, trim: true },
  country: { type: String, required: true, trim: true, default: 'Vietnam', index: true },
  displayName: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// For searching by code/name/city with case-insensitive/diacritics-insensitive matching,
// we can use regex on normalized fields later in query.
airportSchema.index({ code: 1, city: 1, name: 1, country: 1, isActive: 1 });

module.exports = mongoose.model('Airport', airportSchema);
