
// src/api/client.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // e.g., "http://localhost:5000"
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Interceptor to add JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // get token from localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
