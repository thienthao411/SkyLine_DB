const express = require('express');
const router = express.Router();
const airportController = require('../controllers/airportController');

router.get('/search', airportController.searchAirports);

module.exports = router;
