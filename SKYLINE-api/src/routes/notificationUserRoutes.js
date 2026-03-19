const express = require("express");
const router = express.Router();
const notificationUserController = require("../controllers/notificationUserController");

router.get("/", notificationUserController.getNotifications);
router.patch("/:id/read", notificationUserController.markAsRead);

module.exports = router;
