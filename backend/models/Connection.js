const mongoose = require("mongoose");

// Represents a chat "connection" between two users, WhatsApp-style:
// one user sends a request, the other must accept before either of
// them shows up in the other's chat list or can exchange messages.
const connectionSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Speeds up "find any connection between these two users" lookups.
connectionSchema.index({ requester: 1, recipient: 1 });
connectionSchema.index({ recipient: 1, requester: 1 });

module.exports = mongoose.model("Connection", connectionSchema);
