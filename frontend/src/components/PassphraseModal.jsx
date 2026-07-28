import React, { useState } from "react";
import Logo from "./Logo";
import "./PassphraseModal.css";

// Shown as an overlay the first time a particular conversation is
// opened in this session. `chatName` personalizes the message;
// `onSubmit(passphrase)` derives and caches the key for that room.
function PassphraseModal({ chatName, onSubmit, onCancel }) {
  const [passphrase, setPassphrase] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!passphrase) return;
    onSubmit(passphrase);
  };

  return (
    <div className="passphrase-overlay">
      <form className="passphrase-modal-box" onSubmit={handleSubmit}>
        <Logo size={40} />
        <h2>🔒 Enter Passphrase</h2>
        <p>
          Your chat with <strong>{chatName}</strong> is end-to-end encrypted.
          You both need to enter the same passphrase (agreed on outside this
          app) to read and send messages here. It's never sent to the server.
        </p>
        <input
          type="password"
          placeholder="Passphrase for this chat"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoFocus
          required
        />
        <div className="passphrase-modal-actions">
          <button type="button" className="passphrase-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="passphrase-unlock-btn">
            Unlock
          </button>
        </div>
      </form>
    </div>
  );
}

export default PassphraseModal;
