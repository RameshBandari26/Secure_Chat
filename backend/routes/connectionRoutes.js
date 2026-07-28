const express = require("express");
const {
  sendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptRequest,
  rejectRequest,
  getConnections,
} = require("../controllers/connectionController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// All connection routes require a logged-in user.
router.use(protect);

router.get("/", getConnections); // accepted connections = chat list
router.get("/incoming", getIncomingRequests);
router.get("/outgoing", getOutgoingRequests);
router.post("/request", sendRequest);
router.post("/:id/accept", acceptRequest);
router.post("/:id/reject", rejectRequest);

module.exports = router;
