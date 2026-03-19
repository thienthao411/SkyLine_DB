const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/admin', notificationController.getAdminNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/admin/read-all', notificationController.markAllAsRead);

module.exports = router;
