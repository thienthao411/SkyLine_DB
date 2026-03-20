const Airport = require('../models/Airport');

// helper to remove Vietnamese diacritics for basic matching fallback
function normalizeVietnamese(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

exports.searchAirports = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json([]);
    }

    const normalizedQ = normalizeVietnamese(q);

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Search by code, name, city, and fallback on normalized (no accent) text
    const result = await Airport.find({
      country: { $regex: /^vietnam$/i },
      isActive: true,
      $or: [
        { code: { $regex: `^${q}`, $options: 'i' } },
        { code: regex },
        { name: regex },
        { city: regex },
      ]
    })
      .limit(10)
      .select('code name city province country displayName isActive');

    // If no results and q has accents, fallback by scanning normalized fields
    if (result.length === 0 && normalizedQ !== q.toLowerCase()) {
      const allActive = await Airport.find({ country: { $regex: /^vietnam$/i }, isActive: true })
        .select('code name city province country displayName isActive')
        .lean();

      const filtered = allActive.filter((a) => {
        const haystack = `${normalizeVietnamese(a.code)} ${normalizeVietnamese(a.name)} ${normalizeVietnamese(a.city)}`;
        return haystack.includes(normalizedQ);
      }).slice(0, 10);

      return res.json(filtered);
    }

    res.json(result);
  } catch (error) {
    console.error('Airport search error:', error);
    res.status(500).json({ message: 'Lỗi server khi tìm sân bay', error: error.message });
  }
};
