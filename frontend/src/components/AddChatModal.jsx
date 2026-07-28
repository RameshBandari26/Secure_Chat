import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faMagnifyingGlass, faCheck } from "@fortawesome/free-solid-svg-icons";
import api from "../api/client";
import "./AddChatModal.css";

function Avatar({ user, size = 40 }) {
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

// `onClose()` closes the modal.
// `incomingRequests` / `onAccept` / `onReject` are passed down from Chat.jsx
// so the request badge count and list stay in sync with the rest of the app.
// `onConnectionsChanged()` is called after an accept, so the parent can
// refresh the main chat list.
function AddChatModal({
  onClose,
  incomingRequests,
  onAccept,
  onReject,
  onConnectionsChanged,
}) {
  const [activeTab, setActiveTab] = useState(
    incomingRequests.length > 0 ? "requests" : "search"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [busyId, setBusyId] = useState(null); // id of the request/user currently being acted on
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const term = searchTerm.trim();
    if (!term) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await api.get("/api/users/search", { params: { q: term } });
        setResults(res.data);
      } catch (err) {
        setSearchError(err.response?.data?.message || "Search failed");
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  const handleSendRequest = async (user) => {
    setBusyId(user._id);
    try {
      await api.post("/api/connections/request", { recipientId: user._id });
      setResults((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, status: "outgoing" } : u))
      );
    } catch (err) {
      setSearchError(err.response?.data?.message || "Failed to send request");
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (request) => {
    setBusyId(request._id);
    try {
      await onAccept(request._id);
      onConnectionsChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (request) => {
    setBusyId(request._id);
    try {
      await onReject(request._id);
    } finally {
      setBusyId(null);
    }
  };

  const statusLabel = {
    connected: "Already chatting",
    outgoing: "Requested",
    incoming: "Check Requests tab",
  };

  return (
    <div className="addchat-overlay" onClick={onClose}>
      <div className="addchat-card" onClick={(e) => e.stopPropagation()}>
        <div className="addchat-header">
          <h2>Add Chat</h2>
          <button className="icon-btn dark" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="addchat-tabs">
          <button
            className={`addchat-tab ${activeTab === "search" ? "active" : ""}`}
            onClick={() => setActiveTab("search")}
          >
            Search
          </button>
          <button
            className={`addchat-tab ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            Requests
            {incomingRequests.length > 0 && (
              <span className="addchat-badge">{incomingRequests.length}</span>
            )}
          </button>
        </div>

        {activeTab === "search" ? (
          <div className="addchat-body">
            <div className="addchat-search-box">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            {searchError && <p className="addchat-error">{searchError}</p>}

            <div className="addchat-list">
              {searching ? (
                <p className="addchat-empty">Searching...</p>
              ) : !searchTerm.trim() ? (
                <p className="addchat-empty">Search for someone by name or email.</p>
              ) : results.length === 0 ? (
                <p className="addchat-empty">No matching users found.</p>
              ) : (
                results.map((u) => (
                  <div key={u._id} className="addchat-list-item">
                    <Avatar user={u} />
                    <span className="addchat-user-name">{u.name}</span>
                    {u.status === "none" ? (
                      <button
                        className="addchat-action-btn"
                        disabled={busyId === u._id}
                        onClick={() => handleSendRequest(u)}
                      >
                        {busyId === u._id ? "Sending..." : "Send Request"}
                      </button>
                    ) : (
                      <span className="addchat-status-label">
                        {statusLabel[u.status] || u.status}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="addchat-body">
            <div className="addchat-list">
              {incomingRequests.length === 0 ? (
                <p className="addchat-empty">No pending chat requests.</p>
              ) : (
                incomingRequests.map((r) => (
                  <div key={r._id} className="addchat-list-item">
                    <Avatar user={r.from} />
                    <span className="addchat-user-name">{r.from.name}</span>
                    <div className="addchat-request-actions">
                      <button
                        className="addchat-icon-action accept"
                        disabled={busyId === r._id}
                        onClick={() => handleAccept(r)}
                        aria-label="Accept"
                        title="Accept"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                      <button
                        className="addchat-icon-action reject"
                        disabled={busyId === r._id}
                        onClick={() => handleReject(r)}
                        aria-label="Reject"
                        title="Reject"
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddChatModal;
