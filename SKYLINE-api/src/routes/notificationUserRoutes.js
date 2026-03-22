const express = require("express");
const router = express.Router();
const notificationUserController = require("../controllers/notificationUserController");

router.get("/", notificationUserController.getNotifications);
router.patch("/:id/read", notificationUserController.markAsRead);
router.patch("/read-all", notificationUserController.markAllAsRead);

module.exports = router;
