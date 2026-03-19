const express = require('express');
const router = express.Router();
const flightController = require('../controllers/flightController');

router.get('/search', flightController.searchFlights);
router.get('/:id/seats', flightController.getOccupiedSeatsByFlightId);
router.get('/:id', flightController.getFlightById);
router.get('/', flightController.getFlights);
router.post('/', flightController.createFlight);
router.put('/:id', flightController.updateFlight);
router.delete('/:id', flightController.deleteFlight);

module.exports = router;
