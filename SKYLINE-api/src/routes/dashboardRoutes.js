const express = require('express');
const router = express.Router();
const {
  getCoreStats,
  getOverview,
  getRevenueChart,
  getTicketsChart,
  getTopRoutes,
  getTopAirlines,
  getDonutStats
} = require('../controllers/dashboardController');

router.get('/core-stats', getCoreStats);
router.get('/overview', getOverview);
router.get('/revenue-chart', getRevenueChart);
router.get('/tickets-chart', getTicketsChart);
router.get('/top-routes', getTopRoutes);
router.get('/top-airlines', getTopAirlines);
router.get('/donut-stats', getDonutStats);

module.exports = router;
