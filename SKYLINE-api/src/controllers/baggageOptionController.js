const BaggageOption = require('../models/BaggageOption');

const DEFAULT_OPTIONS = [
  { code: 'BG15', name: '15kg', price: 120000, priceDisplay: '120.000đ', sortOrder: 1, isActive: true },
  { code: 'BG20', name: '20kg', price: 180000, priceDisplay: '180.000đ', sortOrder: 2, isActive: true },
  { code: 'BG25', name: '25kg', price: 260000, priceDisplay: '260.000đ', sortOrder: 3, isActive: true },
  { code: 'BG30', name: '30kg', price: 340000, priceDisplay: '340.000đ', sortOrder: 4, isActive: true },
];

exports.getBaggageOptions = async (_req, res) => {
  try {
    let options = await BaggageOption.find({ isActive: true })
      .sort({ sortOrder: 1, price: 1 })
      .lean();

    // Provide defaults so the booking flow keeps working even when DB has not been seeded.
    if (!Array.isArray(options) || options.length === 0) {
      options = DEFAULT_OPTIONS;
    }

    return res.json({
      success: true,
      options,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      options: [],
    });
  }
};
