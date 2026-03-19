const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");

router.post("/", bookingController.createBooking);
router.get("/:ticketCode", bookingController.getBooking);
router.patch("/:ticketCode/status", bookingController.updateBookingStatus);
router.post("/:ticketCode/account-email", bookingController.sendAccountEmail);

module.exports = router;
