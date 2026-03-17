const express = require('express');
const router = express.Router();
const airlineController = require('../controllers/airlineController');

router.get('/', airlineController.getAirlines);
router.post('/', airlineController.createAirline);
router.put('/:id', airlineController.updateAirline);
router.delete('/:id', airlineController.deleteAirline);

module.exports = router;