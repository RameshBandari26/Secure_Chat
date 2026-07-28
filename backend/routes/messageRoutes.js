const express = require("express");
const { getMessages, sendMessage, deleteMessage } = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require a valid JWT (see middleware/authMiddleware.js)
router.get("/", protect, getMessages);
router.post("/", protect, sendMessage);
router.delete("/:id", protect, deleteMessage);

module.exports = router;
