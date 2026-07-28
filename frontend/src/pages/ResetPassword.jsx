import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import api from "../api/client";
import Logo from "../components/Logo";
import "./AuthCard.css";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const res = await api.post("/api/users/reset-password", {
        token,
        newPassword,
      });
      setMessage(res.data.message || "Password has been reset.");
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-card-page">
      <div className="app-brand">
        <Logo size={40} />
        <span className="app-brand-text">Secure Chat</span>
      </div>
      <div className="auth-card">
        <h1>Reset Password</h1>
        <p>Choose a new password for your account.</p>

        {error && <div className="auth-card-error">{error}</div>}
        {message && <div className="auth-card-success">{message}</div>}

        {!done && (
          <form onSubmit={handleSubmit}>
            <div className="input-box">
              <input
                type="password"
                placeholder="New password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <FontAwesomeIcon icon={faLock} className="icon" />
            </div>
            <div className="input-box">
              <input
                type="password"
                placeholder="Confirm new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <FontAwesomeIcon icon={faLock} className="icon" />
            </div>
            <button type="submit" disabled={saving}>
              {saving ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <button className="auth-card-back-link" onClick={() => navigate("/register")}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default ResetPassword;
