const crypto = require("crypto");
const User = require("../models/User");
const Connection = require("../models/Connection");
const generateToken = require("../utils/generateToken");
const { sendEmail } = require("../utils/sendEmail");

// Shape we always send back to the client for "the current user" -
// centralised here so every endpoint returns the same fields.
function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || "",
  };
}

// POST /api/users  -> register
const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // ✅ Let model handle hashing (see models/User.js pre-save hook)
    const user = new User({ name, email, password });
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: "User created successfully",
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// POST /api/users/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ Use model method for comparison
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user._id);

    res.json({
      message: "Login successful",
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/users/profile (protected)
const getProfile = (req, res) => {
  res.json({
    message: "User profile fetched successfully",
    user: toPublicUser(req.user),
  });
};

// PUT /api/users/profile (protected)
// Lets the logged-in user edit their own name/email/avatar. Password
// changes go through changePassword instead, since those need the
// current password verified first (see below).
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, email, avatar } = req.body;

    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailTaken) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email;
    }

    if (name) user.name = name;

    // avatar is a base64 data URL produced client-side (already resized
    // small before upload - see components/SettingsModal.jsx). An empty
    // string means "remove my profile picture".
    if (typeof avatar === "string") user.avatar = avatar;

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: toPublicUser(user),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PUT /api/users/change-password (protected)
// Requires the user to prove they know their CURRENT password before
// setting a new one - this is the standard "Account Settings" password
// change, as opposed to the forgot-password recovery flow below.
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword; // pre-save hook re-hashes it
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// POST /api/users/forgot-password (public)
// Used when the user does NOT remember their current password, so
// changePassword (above) isn't usable. Generates a one-time, expiring
// reset link and emails it to the account's address.
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond the same way whether or not the email exists, so
    // this endpoint can't be used to check which emails are registered.
    const genericResponse = {
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };

    if (!user) return res.json(genericResponse);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password/${rawToken}`;

    const { devFallback } = await sendEmail({
      to: user.email,
      subject: "Reset your Secure Chat password",
      text: `You requested a password reset. This link expires in 15 minutes:\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
      html: `<p>You requested a password reset. This link expires in 15 minutes:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    });

    // --------------------------------------------------------------
    // DEV-ONLY CONVENIENCE: if no SMTP is configured (see utils/
    // sendEmail.js), the reset link can't actually be emailed, so we
    // include it directly in the API response and print it to the
    // server console instead - purely so you can test the flow
    // locally without setting up a mail provider.
    //
    // ⚠️ REMOVE `resetLink` FROM THIS RESPONSE BEFORE DEPLOYING TO
    // PRODUCTION. Returning it here means anyone who knows an email
    // address could reset that account's password without ever
    // reading the inbox. Once SMTP_* is configured in .env this
    // branch simply won't fire (devFallback will be false).
    // --------------------------------------------------------------
    if (devFallback) {
      return res.json({ ...genericResponse, devResetLink: resetLink });
    }

    res.json(genericResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/users/reset-password (public)
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "This reset link is invalid or has expired" });
    }

    user.password = newPassword;
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Password has been reset. You can now log in." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/users/search?q=... (protected)
// Powers the "Add Chat" search (like WhatsApp's "new chat" search):
// finds users by name/email and tells the frontend the current
// relationship status with each one, so it can show the right
// button (Send Request / Requested / Accept / Message).
const searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);

    const regex = new RegExp(q, "i");
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ name: regex }, { email: regex }],
    })
      .select("name email avatar")
      .limit(20);

    if (users.length === 0) return res.json([]);

    const userIds = users.map((u) => u._id);
    const connections = await Connection.find({
      $or: [
        { requester: req.user._id, recipient: { $in: userIds } },
        { recipient: req.user._id, requester: { $in: userIds } },
      ],
    });

    const statusByUserId = {};
    connections.forEach((c) => {
      const otherId =
        String(c.requester) === String(req.user._id)
          ? String(c.recipient)
          : String(c.requester);
      if (c.status === "accepted") {
        statusByUserId[otherId] = "connected";
      } else if (c.status === "pending") {
        statusByUserId[otherId] =
          String(c.requester) === String(req.user._id)
            ? "outgoing" // I sent it, waiting on them
            : "incoming"; // They sent it, waiting on me
      }
      // rejected connections are treated as "none" so a new request can be sent
    });

    const result = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar || "",
      status: statusByUserId[String(u._id)] || "none",
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createUser,
  loginUser,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  searchUsers,
};
