import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router";
import {
  faGoogle,
  faFacebook,
  faInstagram,
} from "@fortawesome/free-brands-svg-icons";
import "./Register.css";
import api from "../api/client";
import Logo from "../components/Logo";

// How long a toast stays on screen before it fades out on its own.
const TOAST_DURATION = 2200;
// For a success login, give the toast just enough time to be seen
// before navigating away - this is what replaces the old alert().
const REDIRECT_DELAY = 900;

function Toast({ toast }) {
  if (!toast) return null;

  const isError = toast.type === "error";

  // Inline styles on purpose: this guarantees the toast is visible
  // regardless of any global CSS (e.g. a Bootstrap ".toast" class
  // that defaults to display:none until a ".show" class is added).
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "min(90vw, 420px)",
        padding: "14px 22px",
        borderRadius: 10,
        fontSize: 14.5,
        fontWeight: 500,
        color: "#fff",
        textAlign: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        zIndex: 9999,
        background: isError
          ? "#c0392b"
          : "linear-gradient(40deg, #ff6a00, #5f10d5)",
      }}
    >
      {toast.message}
    </div>
  );
}

function Register() {
  const [isLoginActive, setIsLoginActive] = useState(true);

  const [registerData, setRegisterData] = useState({
    name: "",
    password: "",
    email: "",
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Non-blocking popup replacement for alert(). { message, type } or null.
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const navigate = useNavigate();

  const showToast = (message, type = "success", duration = TOAST_DURATION) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const toggleMode = () => {
    setIsLoginActive(!isLoginActive);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/api/users", registerData);
      showToast(response.data.message || "Registration successful!", "success");
      setRegisterData({ name: "", password: "", email: "" });
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Registration failed";
      showToast(msg, "error");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("Sending login data:", loginData);

    try {
      const response = await api.post("/api/users/login", loginData);

      // Save token + user info to localStorage (used by Chat.jsx)
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Show the toast and clear the form immediately, then move on -
      // no blocking popup, no waiting for the user to click anything.
      showToast(response.data.message || "Login successful!", "success");
      setLoginData({ email: "", password: "" });

      setTimeout(() => navigate("/chat"), REDIRECT_DELAY);
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Login failed";
      showToast(msg, "error");
    }
  };

  return (
    <div className="register-page">
      <Toast toast={toast} />

      <div className="app-brand">
        <Logo size={40} />
        <span className="app-brand-text">Secure Chat</span>
      </div>
      <div className={`container ${!isLoginActive ? "active" : ""}`}>
        {/* Toggle Panels */}
        <div className="toggle-box">
          <div className="toggle-panel toggle-left">
            <h1>Hello, Welcome</h1>
            <p>New to our platform?</p>
            <button
              className="btn register-btn"
              onClick={() => setIsLoginActive(false)}
            >
              Register
            </button>
          </div>

          <div className="toggle-panel toggle-right">
            <h1>Welcome Back!</h1>
            <p>Already have an account?</p>
            <button
              className="btn login-btn"
              onClick={() => setIsLoginActive(true)}
            >
              Login
            </button>
          </div>
        </div>

        {/* Login Form */}
        <div className="form-box login">
          <form onSubmit={handleLogin}>
            <h1>Login</h1>
            <div className="input-box">
              <input
                type="text"
                placeholder="email"
                required
                value={loginData.email}
                onChange={(e) =>
                  setLoginData({ ...loginData, email: e.target.value })
                }
              />
              <FontAwesomeIcon icon={faUser} className="icon" />
            </div>
            <div className="input-box">
              <input
                type="password"
                placeholder="Password"
                required
                value={loginData.password}
                onChange={(e) =>
                  setLoginData({ ...loginData, password: e.target.value })
                }
              />
              <FontAwesomeIcon icon={faLock} className="icon" />
            </div>
            <div className="forgot-link">
              <a
                href="/forgot-password"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/forgot-password");
                }}
              >
                Forgot Password?
              </a>
            </div>
            <button type="submit" className="btn">
              Login
            </button>
            <p>or login with social platforms</p>
            <div className="social-icons">
              <a href="#">
                <FontAwesomeIcon icon={faGoogle} size="2x" />
              </a>
              <a href="#">
                <FontAwesomeIcon icon={faFacebook} size="2x" />
              </a>
              <a href="#">
                <FontAwesomeIcon icon={faInstagram} size="2x" />
              </a>
            </div>
          </form>
        </div>

        {/* Register Form */}
        <div className="form-box register">
          <form onSubmit={handleRegister}>
            <h1>Register</h1>
            <div className="input-box">
              <input
                type="text"
                placeholder="Username"
                required
                value={registerData.name}
                onChange={(e) =>
                  setRegisterData({ ...registerData, name: e.target.value })
                }
              />
              <FontAwesomeIcon icon={faUser} className="icon" />
            </div>
            <div className="input-box">
              <input
                type="password"
                placeholder="Password"
                required
                value={registerData.password}
                onChange={(e) =>
                  setRegisterData({ ...registerData, password: e.target.value })
                }
              />
              <FontAwesomeIcon icon={faLock} className="icon" />
            </div>
            <div className="input-box">
              <input
                type="email"
                placeholder="Email"
                required
                value={registerData.email}
                onChange={(e) =>
                  setRegisterData({ ...registerData, email: e.target.value })
                }
              />
              <FontAwesomeIcon icon={faEnvelope} className="icon" />
            </div>
            <button type="submit" className="btn">
              Register
            </button>
            <p>or register with social platforms</p>
            <div className="social-icons">
              <a href="#">
                <FontAwesomeIcon icon={faGoogle} size="2x" />
              </a>
              <a href="#">
                <FontAwesomeIcon icon={faFacebook} size="2x" />
              </a>
              <a href="#">
                <FontAwesomeIcon icon={faInstagram} size="2x" />
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;