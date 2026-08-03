const Message = require("../models/Message");
const Connection = require("../models/Connection");

// How long after sending a message can still be "deleted for everyone",
// mirroring WhatsApp's own time-boxed behaviour rather than allowing
// it forever (which could be used to rewrite history in an open-ended
// way long after a conversation happened.
const DELETE_FOR_EVERYONE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// GET /api/messages?room=...
// Returns raw ciphertext + iv for the room. The server never
// decrypts - decryption happens client-side with that conversation's
// passphrase (see frontend/src/utils/crypto.js).
const getMessages = async (req, res) => {
  try {
    const room = req.query.room;
    if (!room) {
      return res.status(400).json({ message: "room is required" });
    }

    const messages = await Message.find({
      room,
      // Never send back messages this user has "deleted for me" -
      // as far as their client is concerned, they don't exist.
      deletedFor: { $ne: req.user._id },
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate("sender", "name email avatar");

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/messages
// Expects { content, iv, room, recipient } where `content` is already
// AES-GCM ciphertext produced in the browser. The server just stores
// the opaque blob and relays it - it cannot read it. Before accepting
// the message, we make sure the sender and recipient are actually an
// accepted Connection - i.e. you can't message someone who hasn't
// accepted your chat request yet, even if you know their room id.
const sendMessage = async (req, res) => {
  try {
    const { content, iv, room, recipient } = req.body;

    if (!content || !iv || !room || !recipient) {
      return res.status(400).json({
        message: "content, iv, room, and recipient are all required",
      });
    }

    const connection = await Connection.findOne({
      status: "accepted",
      $or: [
        { requester: req.user._id, recipient },
        { requester: recipient, recipient: req.user._id },
      ],
    });

    if (!connection) {
      return res.status(403).json({
        message: "You can only message users who have accepted your chat request",
      });
    }

    const message = await Message.create({
      sender: req.user._id, // set by the `protect` auth middleware
      recipient,
      content,
      iv,
      room,
    });

    const populatedMessage = await message.populate("sender", "name email avatar");

    // Broadcast the still-encrypted message over Socket.IO so other
    // clients get it instantly; they decrypt it themselves.
    const io = req.app.get("io");
    if (io) {
      const summaryUpdate = {
        room,
        createdAt: populatedMessage.createdAt,
        senderId: String(populatedMessage.sender._id),
        deletedForEveryone: populatedMessage.deletedForEveryone,
      };

      io.to(room).emit("newMessage", populatedMessage);
      io.to(`user_${recipient}`).emit("chatSummaryUpdate", {
        ...summaryUpdate,
        isOwnMessage: false,
        shouldIncrementUnread: true,
      });
      io.to(`user_${req.user._id}`).emit("chatSummaryUpdate", {
        ...summaryUpdate,
        isOwnMessage: true,
        shouldIncrementUnread: false,
      });
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/messages/:id   body: { mode: 'me' | 'everyone' }
const deleteMessage = async (req, res) => {
  try {
    const { mode } = req.body;
    if (mode !== "me" && mode !== "everyone") {
      return res.status(400).json({ message: "mode must be 'me' or 'everyone'" });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const isSender = String(message.sender) === String(req.user._id);
    const isRecipient = String(message.recipient) === String(req.user._id);
    if (!isSender && !isRecipient) {
      return res.status(403).json({ message: "You can't delete this message" });
    }

    if (mode === "me") {
      // Just hide it from MY OWN view - doesn't affect the other person.
      if (!message.deletedFor.some((id) => String(id) === String(req.user._id))) {
        message.deletedFor.push(req.user._id);
        await message.save();
      }
      return res.json({ message: "Message deleted for you", mode, id: message._id });
    }

    // mode === 'everyone'
    if (!isSender) {
      return res
        .status(403)
        .json({ message: "Only the sender can delete a message for everyone" });
    }

    const age = Date.now() - new Date(message.createdAt).getTime();
    if (age > DELETE_FOR_EVERYONE_WINDOW_MS) {
      return res.status(400).json({
        message: "This message is too old to delete for everyone",
      });
    }

    // Actually wipe the ciphertext/iv from the database - this isn't
    // just hidden, it's genuinely removed. Using updateOne so Mongoose
    // doesn't re-run the "content/iv required" validators (which would
    // otherwise reject blanking them out).
    await Message.updateOne(
      { _id: message._id },
      {
        $set: {
          content: "",
          iv: "",
          deletedForEveryone: true,
          deletedAt: new Date(),
        },
      }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(message.room).emit("messageDeleted", {
        id: message._id,
        room: message.room,
        mode: "everyone",
      });

      const summaryUpdate = {
        room: message.room,
        createdAt: message.createdAt,
        senderId: String(message.sender),
        deletedForEveryone: true,
        shouldIncrementUnread: false,
      };

      io.to(`user_${message.sender}`).emit("chatSummaryUpdate", {
        ...summaryUpdate,
        isOwnMessage: true,
      });
      io.to(`user_${message.recipient}`).emit("chatSummaryUpdate", {
        ...summaryUpdate,
        isOwnMessage: false,
      });
    }

    res.json({ message: "Message deleted for everyone", mode, id: message._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markMessagesRead = async (req, res) => {
  try {
    const { room } = req.body;
    if (!room) {
      return res.status(400).json({ message: "room is required" });
    }

    await Message.updateMany(
      {
        room,
        recipient: req.user._id,
        deletedFor: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${req.user._id}`).emit("chatRead", { room });
    }

    res.json({ message: "Messages marked read", room });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMessages, sendMessage, deleteMessage, markMessagesRead };
