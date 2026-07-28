import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { io } from "socket.io-client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faGear,
  faArrowLeft,
  faUserPlus,
  faEllipsisVertical,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import api from "../api/client";
import { deriveKeyFromPassphrase, encryptMessage, decryptMessage } from "../utils/crypto";
import Logo from "../components/Logo";
import SettingsModal from "../components/SettingsModal";
import AddChatModal from "../components/AddChatModal";
import PassphraseModal from "../components/PassphraseModal";
import "./Chat.css";

function decodeUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

// Builds a stable, unique room id for a 1-on-1 conversation between
// two user ids, regardless of who opens the chat first. Sorting the
// ids means (A, B) and (B, A) always produce the same room name.
function getDirectRoomId(idA, idB) {
  return ["dm", ...[String(idA), String(idB)].sort()].join("_");
}

// Decrypts one raw message from the server ({ content, iv, ... })
// into a display-ready object with `plaintext` (or a decrypt error).
async function toDisplayMessage(raw, cryptoKey) {
  // Already deleted for everyone - server wiped the ciphertext, so
  // there's nothing to decrypt. Show the placeholder immediately.
  if (raw.deletedForEveryone) {
    return { ...raw, plaintext: null, decryptError: false, pending: false };
  }
  if (!cryptoKey) {
    return { ...raw, plaintext: null, decryptError: false, pending: true };
  }
  try {
    const plaintext = await decryptMessage(cryptoKey, raw.content, raw.iv);
    return { ...raw, plaintext, decryptError: false, pending: false };
  } catch {
    // Wrong passphrase, or corrupted/tampered ciphertext - AES-GCM
    // authentication will fail decryption rather than return garbage.
    return { ...raw, plaintext: null, decryptError: true, pending: false };
  }
}

function Avatar({ user, size = 44 }) {
  if (user?.avatar) {
    return (
      <img
        className="avatar-img"
        style={{ width: size, height: size }}
        src={user.avatar}
        alt={user.name}
      />
    );
  }
  return (
    <span className="avatar-fallback" style={{ width: size, height: size }}>
      {user?.name?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

function Chat() {
  const [currentUser, setCurrentUser] = useState(decodeUser());

  // Accepted connections = the actual chat list (WhatsApp-style: you
  // only see/chat with people who have accepted your request).
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionsError, setConnectionsError] = useState("");
  const [incomingRequests, setIncomingRequests] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showAddChat, setShowAddChat] = useState(false);

  // Per-conversation encryption keys, derived from a passphrase the
  // user enters the first time they open that specific chat. Kept
  // only in memory (never persisted) - closing/reloading the app
  // means re-entering the passphrase, by design.
  const [roomKeys, setRoomKeys] = useState({});
  const [awaitingPassphraseFor, setAwaitingPassphraseFor] = useState(null); // room id or null

  const [rawMessages, setRawMessages] = useState([]);
  const [displayMessages, setDisplayMessages] = useState([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openMenuMsgId, setOpenMenuMsgId] = useState(null);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const currentRoomRef = useRef(null); // tracks the socket room we're currently joined to
  const navigate = useNavigate();

  // The active 1-on-1 conversation's room id, or null if no chat is open yet.
  const room = selectedUser && currentUser
    ? getDirectRoomId(currentUser.id, selectedUser._id)
    : null;
  const cryptoKey = room ? roomKeys[room] : null;

  const filteredConnections = connections.filter((u) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return u.name?.toLowerCase().includes(term);
  });

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/register");
  }, [navigate]);

  const fetchConnections = async () => {
    try {
      const res = await api.get("/api/connections");
      setConnections(res.data);
    } catch (err) {
      setConnectionsError(err.response?.data?.message || "Failed to load chats");
    } finally {
      setConnectionsLoading(false);
    }
  };

  const fetchIncomingRequests = async () => {
    try {
      const res = await api.get("/api/connections/incoming");
      setIncomingRequests(res.data);
    } catch {
      // Non-critical for the main chat experience - fail silently,
      // the badge just won't show a count.
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchIncomingRequests();
  }, []);

  // Open a single persistent socket connection for the whole session -
  // used for live messages AND live chat-request notifications.
  useEffect(() => {
    if (!currentUser) return;

    const socket = io(import.meta.env.VITE_API_URL, {
      transports: ["websocket"],
    });
    socketRef.current = socket;
    socket.emit("registerUser", currentUser.id);

    socket.on("newMessage", (message) => {
      // Only add it to this view if it belongs to the conversation
      // currently open - other rooms' messages are ignored here since
      // we only ever join one room at a time (see effect below).
      if (message.room === currentRoomRef.current) {
        setRawMessages((prev) => [...prev, message]);
      }
    });

    socket.on("connectionRequest", (request) => {
      setIncomingRequests((prev) => [request, ...prev]);
    });

    socket.on("connectionAccepted", () => {
      // Someone accepted a request WE sent - refresh so they show up
      // in our chat list without needing a manual reload.
      fetchConnections();
    });

    socket.on("messageDeleted", ({ id, room: deletedRoom }) => {
      if (deletedRoom !== currentRoomRef.current) return;
      setRawMessages((prev) =>
        prev.map((m) =>
          m._id === id ? { ...m, deletedForEveryone: true, content: "", iv: "" } : m
        )
      );
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Whenever the selected chat partner changes, leave the previous
  // socket room (if any) and join the new one so real-time messages
  // for the right 1-on-1 conversation come through.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !room) return;

    socket.emit("joinRoom", room);
    currentRoomRef.current = room;
    setOpenMenuMsgId(null);

    return () => {
      socket.emit("leaveRoom", room);
    };
  }, [room]);

  // Load ciphertext history for the currently open conversation. This
  // doesn't require the passphrase - the server only ever stores
  // ciphertext, so history can be fetched immediately; it just won't
  // be readable until the key is unlocked (see the passphrase popup).
  useEffect(() => {
    if (!room) {
      setRawMessages([]);
      return;
    }
    setLoading(true);
    const fetchMessages = async () => {
      try {
        const res = await api.get("/api/messages", { params: { room } });
        setRawMessages(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load messages");
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [room]);

  // The first time a particular room is opened this session (no key
  // cached yet), pop up the passphrase prompt for it.
  useEffect(() => {
    if (room && !roomKeys[room]) {
      setAwaitingPassphraseFor(room);
    } else {
      setAwaitingPassphraseFor(null);
    }
  }, [room, roomKeys]);

  // Whenever raw (encrypted) messages or the room's key change,
  // decrypt everything client-side for display.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const decrypted = await Promise.all(
        rawMessages.map((m) => toDisplayMessage(m, cryptoKey))
      );
      if (!cancelled) setDisplayMessages(decrypted);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawMessages, cryptoKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // Click-outside-to-close for the per-message "..." menu.
  useEffect(() => {
    if (!openMenuMsgId) return;
    const handleClickAway = () => setOpenMenuMsgId(null);
    document.addEventListener("click", handleClickAway);
    return () => document.removeEventListener("click", handleClickAway);
  }, [openMenuMsgId]);

  const handleUnlockPassphrase = async (passphrase) => {
    const key = await deriveKeyFromPassphrase(passphrase, room);
    setRoomKeys((prev) => ({ ...prev, [room]: key }));
  };

  const handleCancelPassphrase = () => {
    setAwaitingPassphraseFor(null);
    setSelectedUser(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !cryptoKey || !room || !selectedUser) return;

    try {
      // Encrypt in the browser BEFORE it ever reaches the network.
      const { ciphertext, iv } = await encryptMessage(cryptoKey, input);
      await api.post("/api/messages", {
        content: ciphertext,
        iv,
        room,
        recipient: selectedUser._id,
      });
      setInput("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/register");
  };

  const handleDeleteMessage = async (msg, mode) => {
    setOpenMenuMsgId(null);
    try {
      await api.delete(`/api/messages/${msg._id}`, { data: { mode } });
      if (mode === "me") {
        // Only affects my own view - just drop it locally.
        setRawMessages((prev) => prev.filter((m) => m._id !== msg._id));
      } else {
        // "everyone" - reflect it locally too (the server also
        // broadcasts this over the socket to the other participant).
        setRawMessages((prev) =>
          prev.map((m) =>
            m._id === msg._id ? { ...m, deletedForEveryone: true, content: "", iv: "" } : m
          )
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete message");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    await api.post(`/api/connections/${requestId}/accept`);
    setIncomingRequests((prev) => prev.filter((r) => r._id !== requestId));
  };

  const handleRejectRequest = async (requestId) => {
    await api.post(`/api/connections/${requestId}/reject`);
    setIncomingRequests((prev) => prev.filter((r) => r._id !== requestId));
  };

  // On mobile, this class swaps which panel (list vs conversation) is visible.
  const mobileStateClass = selectedUser ? "mobile-chat-open" : "mobile-list-open";

  return (
    <div className={`chat-container with-sidebar ${mobileStateClass}`}>
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <div className="sidebar-brand">
              <Logo size={28} />
              <span className="sidebar-brand-text">Secure Chat</span>
            </div>
            <div className="sidebar-header-actions">
              <button
                className="icon-btn"
                onClick={() => setShowAddChat(true)}
                aria-label="Add chat"
                title="Add chat"
              >
                <FontAwesomeIcon icon={faUserPlus} />
                {incomingRequests.length > 0 && (
                  <span className="header-badge">{incomingRequests.length}</span>
                )}
              </button>
              <button
                className="icon-btn"
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                title="Settings"
              >
                <FontAwesomeIcon icon={faGear} />
              </button>
            </div>
          </div>
          <p className="sidebar-username">Hi, {currentUser?.name || "there"}</p>

          <div className="sidebar-search">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="sidebar-search-icon" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="user-list">
          {connectionsLoading ? (
            <p className="chat-loading">Loading chats...</p>
          ) : connectionsError ? (
            <p className="chat-error">{connectionsError}</p>
          ) : filteredConnections.length === 0 ? (
            <div className="chat-empty-state">
              <p className="chat-empty">
                {connections.length === 0
                  ? "No chats yet."
                  : "No matches found."}
              </p>
              {connections.length === 0 && (
                <button className="empty-add-chat-btn" onClick={() => setShowAddChat(true)}>
                  <FontAwesomeIcon icon={faUserPlus} /> Add a chat
                </button>
              )}
            </div>
          ) : (
            filteredConnections.map((u) => (
              <button
                key={u._id}
                className={`user-list-item ${
                  selectedUser?._id === u._id ? "active" : ""
                }`}
                onClick={() => setSelectedUser(u)}
              >
                <Avatar user={u} />
                <span className="user-info">
                  <span className="user-name">{u.name}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="chat-main">
        {!selectedUser ? (
          <div className="chat-no-selection">
            <p>Select someone from the list to start chatting 👋</p>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <button
                className="back-btn"
                onClick={() => setSelectedUser(null)}
                aria-label="Back to chats"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
              <Avatar user={selectedUser} size={34} />
              <h2>{selectedUser.name}</h2>
            </header>

            {error && <div className="chat-error">{error}</div>}

            {awaitingPassphraseFor === room ? (
              <div className="chat-locked">
                <p>🔒 Enter this chat's passphrase to view messages.</p>
              </div>
            ) : (
              <>
                <div className="chat-messages">
                  {loading ? (
                    <p className="chat-loading">Loading messages...</p>
                  ) : displayMessages.length === 0 ? (
                    <p className="chat-empty">No messages yet. Say hello!</p>
                  ) : (
                    displayMessages.map((msg) => {
                      const isOwn = currentUser && msg.sender?._id === currentUser.id;
                      const isDeleted = msg.deletedForEveryone;
                      return (
                        <div
                          key={msg._id}
                          className={`chat-bubble ${isOwn ? "own" : "other"}`}
                        >
                          {!isDeleted && (
                            <button
                              className="bubble-menu-btn"
                              onClick={() =>
                                setOpenMenuMsgId(openMenuMsgId === msg._id ? null : msg._id)
                              }
                              aria-label="Message options"
                            >
                              <FontAwesomeIcon icon={faEllipsisVertical} />
                            </button>
                          )}

                          {openMenuMsgId === msg._id && (
                            <div className="bubble-menu">
                              <button onClick={() => handleDeleteMessage(msg, "me")}>
                                <FontAwesomeIcon icon={faTrash} /> Delete for me
                              </button>
                              {isOwn && (
                                <button onClick={() => handleDeleteMessage(msg, "everyone")}>
                                  <FontAwesomeIcon icon={faTrash} /> Delete for everyone
                                </button>
                              )}
                            </div>
                          )}

                          <p className={`chat-content ${isDeleted ? "deleted" : ""}`}>
                            {isDeleted
                              ? "🚫 This message was deleted"
                              : msg.decryptError
                              ? "🔒 Unable to decrypt (wrong passphrase?)"
                              : msg.plaintext}
                          </p>
                          <span className="chat-time">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <form className="chat-input-box" onSubmit={handleSend}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button type="submit">Send</button>
                </form>
              </>
            )}
          </>
        )}
      </div>

      {awaitingPassphraseFor === room && selectedUser && (
        <PassphraseModal
          chatName={selectedUser.name}
          onSubmit={handleUnlockPassphrase}
          onCancel={handleCancelPassphrase}
        />
      )}

      {showSettings && (
        <SettingsModal
          user={currentUser}
          onClose={() => setShowSettings(false)}
          onUpdated={(updatedUser) => setCurrentUser(updatedUser)}
          onLogout={handleLogout}
        />
      )}

      {showAddChat && (
        <AddChatModal
          onClose={() => setShowAddChat(false)}
          incomingRequests={incomingRequests}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
          onConnectionsChanged={fetchConnections}
        />
      )}
    </div>
  );
}

export default Chat;
