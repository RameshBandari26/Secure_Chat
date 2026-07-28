import React, { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faUser,
  faLock,
  faEnvelope,
  faRightFromBracket,
  faCamera,
} from "@fortawesome/free-solid-svg-icons";
import api from "../api/client";
import { resizeImageToDataUrl } from "../utils/resizeImage";
import "./SettingsModal.css";

// `user` = { id, name, email, avatar } (from localStorage / App state)
// `onClose()` closes the modal
// `onUpdated(updatedUser)` refreshes the parent's copy of the user after a save
// `onLogout()` logs the user out
function SettingsModal({ user, onClose, onUpdated, onLogout }) {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile Settings
          </button>
          <button
            className={`settings-tab ${activeTab === "account" ? "active" : ""}`}
            onClick={() => setActiveTab("account")}
          >
            Account Settings
          </button>
        </div>

        <div className="settings-body">
          {activeTab === "profile" ? (
            <ProfileTab user={user} onUpdated={onUpdated} />
          ) : (
            <AccountTab user={user} />
          )}
        </div>

        <button className="settings-logout-btn" onClick={onLogout}>
          <FontAwesomeIcon icon={faRightFromBracket} />
          Logout
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Profile Settings: name, email, profile picture
// ---------------------------------------------------------------
function ProfileTab({ user, onUpdated }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    try {
      // Resize/compress client-side (like WhatsApp/Instagram do) before
      // it's ever sent anywhere, so we're not shipping multi-MB photos.
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.85);
      setAvatar(dataUrl);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to process image");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await api.put("/api/users/profile", { name, email, avatar });
      const updatedUser = res.data.user;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setSuccess("Profile updated successfully!");
      onUpdated?.(updatedUser);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave}>
      {error && <div className="settings-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}

      <div className="avatar-picker">
        {avatar ? (
          <img className="avatar-preview" src={avatar} alt="Your avatar" />
        ) : (
          <div className="avatar-preview avatar-preview-fallback">
            {name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <button type="button" className="avatar-edit-btn" onClick={handlePickPhoto}>
          <FontAwesomeIcon icon={faCamera} /> Change Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handlePhotoChange}
        />
      </div>

      <label className="settings-label">
        <FontAwesomeIcon icon={faUser} className="settings-label-icon" />
        Name
      </label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />

      <label className="settings-label">
        <FontAwesomeIcon icon={faEnvelope} className="settings-label-icon" />
        Email
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <button type="submit" className="settings-save-btn" disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------
// Account Settings: change password (with current-password check),
// plus a "forgot current password" recovery path.
// ---------------------------------------------------------------
function AccountTab({ user }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [forgotSending, setForgotSending] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [devResetLink, setDevResetLink] = useState("");

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      await api.put("/api/users/change-password", { currentPassword, newPassword });
      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotSending(true);
    setForgotMessage("");
    setDevResetLink("");
    try {
      const res = await api.post("/api/users/forgot-password", { email: user.email });
      setForgotMessage(res.data.message);
      // Only present when SMTP isn't configured on the backend - a local
      // dev convenience so you can test the flow without real email.
      if (res.data.devResetLink) setDevResetLink(res.data.devResetLink);
    } catch (err) {
      setForgotMessage(err.response?.data?.message || "Failed to send reset email");
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleChangePassword}>
        {error && <div className="settings-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}

        <label className="settings-label">
          <FontAwesomeIcon icon={faLock} className="settings-label-icon" />
          Current Password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />

        <label className="settings-label">
          <FontAwesomeIcon icon={faLock} className="settings-label-icon" />
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />

        <label className="settings-label">
          <FontAwesomeIcon icon={faLock} className="settings-label-icon" />
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button type="submit" className="settings-save-btn" disabled={saving}>
          {saving ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="forgot-password-block">
        <p>Don't remember your current password?</p>
        <button
          type="button"
          className="forgot-password-link"
          onClick={handleForgotPassword}
          disabled={forgotSending}
        >
          {forgotSending ? "Sending..." : "Email me a password reset link"}
        </button>
        {forgotMessage && <p className="settings-success">{forgotMessage}</p>}
        {devResetLink && (
          <p className="dev-reset-note">
            <strong>Dev mode</strong> (no email server configured):{" "}
            <a href={devResetLink}>{devResetLink}</a>
          </p>
        )}
      </div>
    </div>
  );
}

export default SettingsModal;
