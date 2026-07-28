const express = require("express");
const {
  createUser,
  loginUser,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  searchUsers,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

// --- Public ---
router.post("/", createUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// --- Protected ---
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
// Search everyone (for the "Add Chat" flow), annotated with connection status
router.get("/search", protect, searchUsers);

module.exports = router;
