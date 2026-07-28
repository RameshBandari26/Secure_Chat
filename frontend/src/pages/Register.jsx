import React, { useState } from "react";
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

const navigate = useNavigate();


  const toggleMode = () => {
    setIsLoginActive(!isLoginActive);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/api/users", registerData);
      alert(response.data.message || "Registration successful!");
      setRegisterData({ name: "", password: "", email: "" });
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Registration failed";
      alert(msg);
    }
  };

  const handleLogin = async (e) => {
  e.preventDefault();
  console.log("Sending login data:", loginData);
  
  try {
    const response = await api.post("/api/users/login", loginData);
    alert(response.data.message || "Login successful!");


    // Save token + user info to localStorage (used by Chat.jsx)
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));

    // Clear form
    setLoginData({ email: "", password: "" });

    navigate("/chat");

  } catch (err) {
    const msg =
      err.response?.data?.message || err.message || "Login failed";
    alert(msg);
  }
};


  return (
    <div className="register-page">
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
            <input type="text" placeholder="email" required 
            value={loginData.email}
            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
            />
            <FontAwesomeIcon icon={faUser} className="icon" />
          </div>
          <div className="input-box">
            <input type="password" placeholder="Password" required
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
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
