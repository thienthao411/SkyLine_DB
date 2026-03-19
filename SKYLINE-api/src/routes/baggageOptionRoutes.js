const express = require('express');
const router = express.Router();
const baggageOptionController = require('../controllers/baggageOptionController');

router.get('/', baggageOptionController.getBaggageOptions);

module.exports = router;
