const Connection = require("../models/Connection");
const Message = require("../models/Message");
const User = require("../models/User");

function getDirectRoomId(idA, idB) {
  return ["dm", ...[String(idA), String(idB)].sort()].join("_");
}

function toPublicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || "",
  };
}

// POST /api/connections/request (protected)  body: { recipientId }
const sendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ message: "recipientId is required" });
    }
    if (String(recipientId) === String(requesterId)) {
      return res.status(400).json({ message: "You can't add yourself" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    const existing = await Connection.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ message: "You're already connected" });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ message: "A request is already pending" });
      }
      // A previously rejected request: allow trying again by reusing the doc.
      existing.status = "pending";
      existing.requester = requesterId;
      existing.recipient = recipientId;
      await existing.save();
      return res.status(201).json(existing);
    }

    const connection = await Connection.create({
      requester: requesterId,
      recipient: recipientId,
      status: "pending",
    });

    // Let the recipient know instantly, even if they're not currently
    // looking at any particular conversation.
    const io = req.app.get("io");
    if (io) {
      const requesterUser = await User.findById(requesterId).select("name email avatar");
      io.to(`user_${recipientId}`).emit("connectionRequest", {
        _id: connection._id,
        from: toPublicUser(requesterUser),
        createdAt: connection.createdAt,
      });
    }

    res.status(201).json(connection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/connections/incoming (protected)
// Pending requests sent TO me by other people, waiting on my decision.
const getIncomingRequests = async (req, res) => {
  try {
    const requests = await Connection.find({
      recipient: req.user._id,
      status: "pending",
    })
      .populate("requester", "name email avatar")
      .sort({ createdAt: -1 });

    res.json(
      requests.map((r) => ({
        _id: r._id,
        from: toPublicUser(r.requester),
        createdAt: r.createdAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/connections/outgoing (protected)
// Requests I sent that are still pending (so "Add Chat" search can show
// "Requested" instead of letting me send a duplicate request).
const getOutgoingRequests = async (req, res) => {
  try {
    const requests = await Connection.find({
      requester: req.user._id,
      status: "pending",
    }).select("recipient");

    res.json(requests.map((r) => String(r.recipient)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/connections/:id/accept (protected)
const acceptRequest = async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (String(connection.recipient) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can't accept this request" });
    }
    connection.status = "accepted";
    await connection.save();

    // Let the original requester know right away so the newly-accepted
    // contact appears in their chat list without needing to refresh.
    const io = req.app.get("io");
    if (io) {
      const recipientUser = await User.findById(req.user._id).select("name email avatar");
      io.to(`user_${connection.requester}`).emit("connectionAccepted", {
        by: toPublicUser(recipientUser),
      });
    }

    res.json({ message: "Request accepted", connection });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/connections/:id/reject (protected)
// Also doubles as "cancel" if called by the original requester.
const rejectRequest = async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({ message: "Request not found" });
    }
    const isParticipant =
      String(connection.recipient) === String(req.user._id) ||
      String(connection.requester) === String(req.user._id);
    if (!isParticipant) {
      return res.status(403).json({ message: "You can't modify this request" });
    }
    connection.status = "rejected";
    await connection.save();
    res.json({ message: "Request rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/connections (protected)
// Accepted connections = the actual chat list.
const getConnections = async (req, res) => {
  try {
    const connections = await Connection.find({
      status: "accepted",
      $or: [{ requester: req.user._id }, { recipient: req.user._id }],
    })
      .populate("requester", "name email avatar")
      .populate("recipient", "name email avatar");

    const rooms = connections.map((c) => {
      const isRequester = String(c.requester._id) === String(req.user._id);
      const other = isRequester ? c.recipient : c.requester;
      return getDirectRoomId(req.user._id, other._id);
    });

    const lastMessages = rooms.length
      ? await Message.aggregate([
          { $match: { room: { $in: rooms }, deletedFor: { $ne: req.user._id } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: "$room", doc: { $first: "$$ROOT" } } },
        ])
      : [];

    const unreadCounts = rooms.length
      ? await Message.aggregate([
          {
            $match: {
              room: { $in: rooms },
              recipient: req.user._id,
              deletedFor: { $ne: req.user._id },
              readBy: { $ne: req.user._id },
            },
          },
          { $group: { _id: "$room", count: { $sum: 1 } } },
        ])
      : [];

    const lastMessageByRoom = new Map(lastMessages.map((item) => [item._id, item.doc]));
    const unreadByRoom = new Map(unreadCounts.map((item) => [item._id, item.count]));

    const contacts = connections
      .map((c) => {
        const isRequester = String(c.requester._id) === String(req.user._id);
        const other = isRequester ? c.recipient : c.requester;
        const room = getDirectRoomId(req.user._id, other._id);
        const lastMessage = lastMessageByRoom.get(room);
        const lastMessageAt = lastMessage?.createdAt || c.updatedAt || c.createdAt;
        const lastMessagePreview = lastMessage
          ? lastMessage.deletedForEveryone
            ? String(lastMessage.sender) === String(req.user._id)
              ? "You deleted this message"
              : "This message was deleted"
            : String(lastMessage.sender) === String(req.user._id)
            ? "You sent a secure message"
            : "Encrypted message"
          : "No messages yet";

        return {
          ...toPublicUser(other),
          room,
          lastMessagePreview,
          lastMessageAt,
          unreadCount: unreadByRoom.get(room) || 0,
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptRequest,
  rejectRequest,
  getConnections,
};
