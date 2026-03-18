const express = require('express');
const router = express.Router();
const airlineController = require('../controllers/airlineController');
const { airlineUpload } = require('../upload');

const handleAirlineLogoUpload = (req, res, next) => {
  airlineUpload.single('img')(req, res, (error) => {
    if (error) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    next();
  });
};

router.get('/', airlineController.getAirlines);
router.post('/', handleAirlineLogoUpload, airlineController.createAirline);
router.put('/:id', handleAirlineLogoUpload, airlineController.updateAirline);

module.exports = router;
