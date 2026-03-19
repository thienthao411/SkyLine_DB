const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

router.get('/tickets/list', bookingController.getTicketsForUser);
router.get('/tickets/:ticketCode', bookingController.getTicketForUser);
router.post('/', bookingController.createBooking);
router.get('/:ticketCode', bookingController.getBooking);
router.patch('/:ticketCode/status', bookingController.updateBookingStatus);
router.patch('/:ticketCode/payment-status', bookingController.updatePaymentStatusByAdmin);
router.post('/:ticketCode/account-email', bookingController.sendAccountEmail);

module.exports = router;
