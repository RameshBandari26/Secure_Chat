const mongoose = require("mongoose");

// ------------------------------------------------------------------
// Mongoose Schema for chat messages.
//
// IMPORTANT (End-to-End Encryption): `content` here is CIPHERTEXT,
// not plaintext. Messages are encrypted client-side (see
// frontend/src/utils/crypto.js) before they are ever sent to this
// server, so the server/database only ever stores an opaque,
// unreadable blob plus the IV needed to decrypt it - it never has
// access to the plaintext message or the encryption key.
// ------------------------------------------------------------------
const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // <-- link to the User model
      required: true,
    },
    // The other participant in this 1-on-1 conversation. Used to check
    // that the two people are an accepted Connection before a message
    // is allowed to be created (see controllers/messageController.js).
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String, // base64 AES-GCM ciphertext - opaque to the server
      required: true,
    },
    iv: {
      type: String, // base64 initialization vector, required to decrypt
      required: true,
    },
    room: {
      type: String,
      default: "global",
      index: true,
    },
    // WhatsApp-style delete options:
    // - "Delete for me": just hide it from MY view (deletedFor lists
    //   the user ids who've done this - the message still exists for
    //   the other participant).
    // - "Delete for everyone": only the sender can do this. It wipes
    //   the actual ciphertext/iv from the database (real deletion,
    //   not just hiding it) and leaves a "message was deleted"
    //   tombstone that both people see.
    deletedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
