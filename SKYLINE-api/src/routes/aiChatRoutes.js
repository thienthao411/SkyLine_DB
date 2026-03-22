const express = require("express");

const aiChatController = require("../controllers/aiChatController");

const router = express.Router();

router.post("/chat", aiChatController.chat);

module.exports = router;
