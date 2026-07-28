import React, { useState } from "react";
import { useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import api from "../api/client";
import Logo from "../components/Logo";
import "./AuthCard.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devResetLink, setDevResetLink] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setMessage("");
    setError("");
    setDevResetLink("");
    try {
      const res = await api.post("/api/users/forgot-password", { email });
      setMessage(res.data.message);
      if (res.data.devResetLink) setDevResetLink(res.data.devResetLink);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="auth-card-page">
      <div className="app-brand">
        <Logo size={40} />
        <span className="app-brand-text">Secure Chat</span>
      </div>
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p>Enter the email on your account and we'll send you a reset link.</p>

        {error && <div className="auth-card-error">{error}</div>}
        {message && <div className="auth-card-success">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-box">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FontAwesomeIcon icon={faEnvelope} className="icon" />
          </div>
          <button type="submit" disabled={sending}>
            {sending ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {devResetLink && (
          <div className="auth-card-dev-note">
            <strong>Dev mode</strong> (no email server configured on the
            backend yet): <a href={devResetLink}>{devResetLink}</a>
          </div>
        )}

        <button className="auth-card-back-link" onClick={() => navigate("/register")}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default ForgotPassword;
