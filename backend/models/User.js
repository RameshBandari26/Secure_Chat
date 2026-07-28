const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Base64 data-URL of a small (client-resized) profile picture.
    // NOTE: storing images as base64 inside MongoDB is fine for a demo/
    // small app, but does not scale well - a real production app should
    // upload to something like S3/Cloudinary and store just the URL here.
    avatar: { type: String, default: "" },

    // --- Forgot-password support ---
    // We never store the raw reset token, only a SHA-256 hash of it,
    // the same pattern used for session tokens: even if the database
    // leaks, the token itself (which grants a password reset) can't be
    // recovered from the hash.
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// ✅ Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ✅ Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
