const Ticket = require('../models/Ticket');
const Flight = require('../models/Flight');
const User = require('../models/User');
const Promotion = require('../models/Promotion');
const Airline = require('../models/Airline');

// === HELPERS ===

function getDateRange(period, fromDate, toDate) {
  const now = new Date();
  let start, end, prevStart, prevEnd;

  if (period === 'custom' && fromDate && toDate) {
    start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    const diff = end - start;
    prevStart = new Date(start.getTime() - diff - 86400000);
    prevEnd = new Date(start.getTime() - 1);
  } else if (period === 'day') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1);
    prevEnd = new Date(end); prevEnd.setDate(prevEnd.getDate() - 1);
  } else if (period === 'week') {
    const dayOfWeek = now.getDay();
    start = new Date(now); start.setDate(now.getDate() - dayOfWeek); start.setHours(0, 0, 0, 0);
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1); prevEnd.setHours(23, 59, 59, 999);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else {
    // year
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  }

  return { start, end, prevStart, prevEnd };
}

function calcGrowth(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function ticketDateStages(start, end) {
  return [
    {
      $addFields: {
        parsedBookingDate: {
          $dateFromString: { dateString: '$bookingDate', onError: null, onNull: null }
        }
      }
    },
    { $match: { parsedBookingDate: { $gte: start, $lte: end } } }
  ];
}

function ticketRevenueExpr() {
  return {
    $convert: {
      input: {
        $ifNull: [
          '$totalPrice',
          { $ifNull: ['$totalAmount', '$price'] }
        ]
      },
      to: 'double',
      onError: 0,
      onNull: 0
    }
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function daysInclusive(start, end) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / oneDayMs) + 1;
}

function buildCustomTimeline(start, end) {
  const dayCount = daysInclusive(start, end);

  // <= 45 ngày: hiển thị theo ngày; dài hơn: gom theo tháng; quá dài: gom theo năm.
  if (dayCount <= 45) {
    const labels = [];
    const keys = [];
    const cur = new Date(start);
    while (cur <= end) {
      keys.push(dayKey(cur));
      labels.push(`${pad2(cur.getDate())}/${pad2(cur.getMonth() + 1)}`);
      cur.setDate(cur.getDate() + 1);
    }
    return {
      groupId: { $dateToString: { format: '%Y-%m-%d', date: '$parsedBookingDate' } },
      keys,
      labels
    };
  }

  const monthSpan = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  if (monthSpan <= 24) {
    const labels = [];
    const keys = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonth) {
      keys.push(monthKey(cur));
      labels.push(`${pad2(cur.getMonth() + 1)}/${cur.getFullYear()}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return {
      groupId: { $dateToString: { format: '%Y-%m', date: '$parsedBookingDate' } },
      keys,
      labels
    };
  }

  const labels = [];
  const keys = [];
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const ys = String(y);
    keys.push(ys);
    labels.push(ys);
  }

  return {
    groupId: { $dateToString: { format: '%Y', date: '$parsedBookingDate' } },
    keys,
    labels
  };
}

// GET /api/dashboard/core-stats
// Chỉ lấy dữ liệu 5 collection chính: users, promotions, tickets, flights, airlines.
exports.getCoreStats = async (req, res) => {
  try {
    const [users, promotions, tickets, flights, airlines] = await Promise.all([
      User.countDocuments(),
      Promotion.countDocuments(),
      Ticket.countDocuments(),
      Flight.countDocuments(),
      Airline.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        users,
        promotions,
        tickets,
        flights,
        airlines
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// === CONTROLLERS ===

// GET /api/dashboard/overview?period=day|week|month|year|custom&from=&to=
exports.getOverview = async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    const { start, end, prevStart, prevEnd } = getDateRange(period, from, to);

    const [currTickets, prevTickets, currFlights, prevFlights] = await Promise.all([
      Ticket.aggregate([
        ...ticketDateStages(start, end),
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: ticketRevenueExpr() },
            totalTickets: { $sum: 1 },
            cancelledTickets: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
          }
        }
      ]),
      Ticket.aggregate([
        ...ticketDateStages(prevStart, prevEnd),
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: ticketRevenueExpr() },
            totalTickets: { $sum: 1 }
          }
        }
      ]),
      Flight.aggregate([
        {
          $addFields: {
            parsedDate: {
              $dateFromString: { dateString: '$date', onError: null, onNull: null }
            }
          }
        },
        { $match: { parsedDate: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            totalFlights: { $sum: 1 },
            seatsBooked: { $sum: '$seatsBookedTotal' },
            seatsMax: { $sum: '$seatsMax' }
          }
        }
      ]),
      Flight.aggregate([
        {
          $addFields: {
            parsedDate: {
              $dateFromString: { dateString: '$date', onError: null, onNull: null }
            }
          }
        },
        { $match: { parsedDate: { $gte: prevStart, $lte: prevEnd } } },
        {
          $group: {
            _id: null,
            totalFlights: { $sum: 1 }
          }
        }
      ])
    ]);

    const curr = currTickets[0] || { totalRevenue: 0, totalTickets: 0, cancelledTickets: 0 };
    const prev = prevTickets[0] || { totalRevenue: 0, totalTickets: 0 };
    const currF = currFlights[0] || { totalFlights: 0, seatsBooked: 0, seatsMax: 0 };
    const prevF = prevFlights[0] || { totalFlights: 0 };

    res.json({
      success: true,
      data: {
        totalRevenue: curr.totalRevenue,
        totalTickets: curr.totalTickets,
        totalFlights: currF.totalFlights,
        seatFillRate: currF.seatsMax > 0 ? Math.round((currF.seatsBooked / currF.seatsMax) * 100) : 0,
        cancellationRate: curr.totalTickets > 0 ? Math.round((curr.cancelledTickets / curr.totalTickets) * 100) : 0,
        revenueGrowth: calcGrowth(curr.totalRevenue, prev.totalRevenue),
        ticketGrowth: calcGrowth(curr.totalTickets, prev.totalTickets),
        flightGrowth: calcGrowth(currF.totalFlights, prevF.totalFlights)
      }
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/revenue-chart?period=&from=&to=
exports.getRevenueChart = async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    const { start, end } = getDateRange(period, from, to);
    const hasCustomRange = period === 'custom' && Boolean(from) && Boolean(to);

    if (hasCustomRange) {
      const timeline = buildCustomTimeline(start, end);
      const data = await Ticket.aggregate([
        ...ticketDateStages(start, end),
        { $group: { _id: timeline.groupId, revenue: { $sum: ticketRevenueExpr() }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      const values = Array(timeline.keys.length).fill(0);
      const idxMap = new Map(timeline.keys.map((k, i) => [k, i]));
      data.forEach(d => {
        const idx = idxMap.get(String(d._id));
        if (idx !== undefined) values[idx] = d.revenue;
      });

      return res.json({ success: true, data: { labels: timeline.labels, values } });
    }

    let groupId;
    if (period === 'day') groupId = { $hour: '$parsedBookingDate' };
    else if (period === 'week') groupId = { $subtract: [{ $dayOfWeek: '$parsedBookingDate' }, 1] };
    else if (period === 'month') groupId = { $dayOfMonth: '$parsedBookingDate' };
    else groupId = { $month: '$parsedBookingDate' };

    const data = await Ticket.aggregate([
      ...ticketDateStages(start, end),
      { $group: { _id: groupId, revenue: { $sum: ticketRevenueExpr() }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    let labels = [], values = [];

    if (period === 'day') {
      labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      values = Array(24).fill(0);
      data.forEach(d => { if (d._id >= 0 && d._id < 24) values[d._id] = d.revenue; });
    } else if (period === 'week') {
      labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      values = Array(7).fill(0);
      data.forEach(d => { if (d._id >= 0 && d._id < 7) values[d._id] = d.revenue; });
    } else if (period === 'month') {
      const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
      values = Array(daysInMonth).fill(0);
      data.forEach(d => { if (d._id >= 1 && d._id <= daysInMonth) values[d._id - 1] = d.revenue; });
    } else {
      labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      values = Array(12).fill(0);
      data.forEach(d => { if (d._id >= 1 && d._id <= 12) values[d._id - 1] = d.revenue; });
    }

    res.json({ success: true, data: { labels, values } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/tickets-chart?period=&from=&to=
exports.getTicketsChart = async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    const { start, end } = getDateRange(period, from, to);
    const hasCustomRange = period === 'custom' && Boolean(from) && Boolean(to);

    if (hasCustomRange) {
      const timeline = buildCustomTimeline(start, end);
      const data = await Ticket.aggregate([
        ...ticketDateStages(start, end),
        { $group: { _id: timeline.groupId, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      const values = Array(timeline.keys.length).fill(0);
      const idxMap = new Map(timeline.keys.map((k, i) => [k, i]));
      data.forEach(d => {
        const idx = idxMap.get(String(d._id));
        if (idx !== undefined) values[idx] = d.count;
      });

      return res.json({ success: true, data: { labels: timeline.labels, values } });
    }

    let groupId;
    if (period === 'day') groupId = { $hour: '$parsedBookingDate' };
    else if (period === 'week') groupId = { $subtract: [{ $dayOfWeek: '$parsedBookingDate' }, 1] };
    else if (period === 'month') groupId = { $dayOfMonth: '$parsedBookingDate' };
    else groupId = { $month: '$parsedBookingDate' };

    const data = await Ticket.aggregate([
      ...ticketDateStages(start, end),
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    let labels = [], values = [];

    if (period === 'day') {
      labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      values = Array(24).fill(0);
      data.forEach(d => { if (d._id >= 0 && d._id < 24) values[d._id] = d.count; });
    } else if (period === 'week') {
      labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      values = Array(7).fill(0);
      data.forEach(d => { if (d._id >= 0 && d._id < 7) values[d._id] = d.count; });
    } else if (period === 'month') {
      const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
      values = Array(daysInMonth).fill(0);
      data.forEach(d => { if (d._id >= 1 && d._id <= daysInMonth) values[d._id - 1] = d.count; });
    } else {
      labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      values = Array(12).fill(0);
      data.forEach(d => { if (d._id >= 1 && d._id <= 12) values[d._id - 1] = d.count; });
    }

    res.json({ success: true, data: { labels, values } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/top-routes?period=&from=&to=
exports.getTopRoutes = async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    const { start, end } = getDateRange(period, from, to);

    const routes = await Ticket.aggregate([
      ...ticketDateStages(start, end),
      {
        $lookup: {
          from: 'flights',
          localField: 'flightId',
          foreignField: '_id',
          as: 'flight'
        }
      },
      { $unwind: { path: '$flight', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: { from: '$flight.from', to: '$flight.to' },
          tickets: { $sum: 1 },
          revenue: { $sum: ticketRevenueExpr() }
        }
      },
      { $sort: { tickets: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          route: { $concat: ['$_id.from', ' → ', '$_id.to'] },
          tickets: 1,
          revenue: 1
        }
      }
    ]);

    res.json({ success: true, data: routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/top-airlines?period=&from=&to=
exports.getTopAirlines = async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    const { start, end } = getDateRange(period, from, to);

    const airlines = await Ticket.aggregate([
      ...ticketDateStages(start, end),
      {
        $lookup: {
          from: 'flights',
          localField: 'flightId',
          foreignField: '_id',
          as: 'flight'
        }
      },
      { $unwind: { path: '$flight', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'airlines',
          let: { flightAirlineId: '$flight.airlineId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: '$_id' },
                    { $toString: '$$flightAirlineId' }
                  ]
                }
              }
            },
            { $project: { _id: 0, airlineName: 1, airlineCode: 1 } }
          ],
          as: 'airlineMeta'
        }
      },
      {
        $addFields: {
          airlineNameResolved: {
            $ifNull: [
              { $arrayElemAt: ['$airlineMeta.airlineName', 0] },
              {
                $ifNull: [
                  '$flight.airline',
                  {
                    $ifNull: ['$flight.airlineCode', 'Unknown']
                  }
                ]
              }
            ]
          },
          airlineCodeResolved: {
            $ifNull: [
              '$flight.airlineCode',
              {
                $ifNull: [
                  { $arrayElemAt: ['$airlineMeta.airlineCode', 0] },
                  ''
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$airlineNameResolved',
          airlineCode: { $first: '$airlineCodeResolved' },
          tickets: { $sum: 1 },
          revenue: { $sum: ticketRevenueExpr() }
        }
      },
      { $sort: { tickets: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          airline: '$_id',
          airlineCode: 1,
          tickets: 1,
          revenue: 1
        }
      }
    ]);

    res.json({ success: true, data: airlines });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/donut-stats?period=&from=&to=
exports.getDonutStats = async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    const { start, end, prevStart, prevEnd } = getDateRange(period, from, to);

    const [currFlights, currRevenue, prevRevenue] = await Promise.all([
      Flight.aggregate([
        {
          $addFields: {
            parsedDate: { $dateFromString: { dateString: '$date', onError: null, onNull: null } }
          }
        },
        { $match: { parsedDate: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            seatsBooked: { $sum: '$seatsBookedTotal' },
            seatsMax: { $sum: '$seatsMax' },
            revenueTotal: { $sum: '$revenueTotal' }
          }
        }
      ]),
      Ticket.aggregate([
        ...ticketDateStages(start, end),
        { $group: { _id: null, revenue: { $sum: ticketRevenueExpr() } } }
      ]),
      Ticket.aggregate([
        ...ticketDateStages(prevStart, prevEnd),
        { $group: { _id: null, revenue: { $sum: ticketRevenueExpr() } } }
      ])
    ]);

    const f = currFlights[0] || { seatsBooked: 0, seatsMax: 0, revenueTotal: 0 };
    const curr = currRevenue[0] || { revenue: 0 };
    const prev = prevRevenue[0] || { revenue: 0 };

    const seatFillRate = f.seatsMax > 0 ? Math.round((f.seatsBooked / f.seatsMax) * 100) : 0;
    const revenueGrowth = calcGrowth(curr.revenue, prev.revenue);

    // Plan attainment: compare current vs previous period as proxy for "plan"
    const planTarget = prev.revenue > 0 ? prev.revenue * 1.1 : curr.revenue;
    const planAttainment = planTarget > 0 ? Math.min(150, Math.round((curr.revenue / planTarget) * 100)) : 0;

    res.json({
      success: true,
      data: {
        seatFillRate,
        revenueGrowth: Math.min(150, Math.max(-100, revenueGrowth)),
        planAttainment
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
