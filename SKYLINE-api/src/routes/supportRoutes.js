const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Dedicated support domain endpoints
router.post('/', notificationController.createSupportRequestNotification);
router.get('/admin/requests', notificationController.getSupportRequests);
router.patch('/admin/requests/:id/status', notificationController.updateSupportRequestStatus);

module.exports = router;
