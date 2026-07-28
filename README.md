# 🔐 Secure Chat Platform

A modern real-time chat application built with the **MERN Stack**, featuring secure authentication, real-time messaging using Socket.IO, and a responsive user interface.

## 🌐 Live Demo

* **Frontend (Netlify):** https://securechat-platform.netlify.app/


## ✨ Features

* 🔐 User Authentication
* 💬 Real-time Messaging with Socket.IO
* 👥 One-to-One Chat
* ⚡ Fast React + Vite Frontend
* 📱 Responsive Design
* 🔒 Secure Password Hashing with bcrypt
* 🎫 JWT Authentication
* 🌐 RESTful API
* ☁️ Cloud Deployment (Netlify + Render)

---

## 🛠️ Tech Stack

### Frontend

* React 19
* Vite
* Axios
* React Router
* Bootstrap 5
* Tailwind CSS
* Socket.IO Client
* Font Awesome

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* Socket.IO
* JWT Authentication
* Passport.js
* Google OAuth 2.0
* Express Session
* bcryptjs

---

## 📂 Project Structure

```text
Secure_Chat/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   ├── package.json
│   └── index.js
│
└── README.md
```

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/RameshBandari26/Secure_Chat.git

cd Secure_Chat
```

---

### 2. Backend Setup

```bash
cd backend

npm install

npm run dev
```

Create a `.env` file inside the **backend** folder.

Example:

```env
PORT=5000
MONGO_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_SECRET_KEY
```

---

### 3. Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Create a `.env` file inside the **frontend** folder.

```env
VITE_API_URL=http://localhost:5000
```

---

## 🏗️ Production Deployment

### Frontend

Hosted on **Netlify**

https://securechat-platform.netlify.app/register

### Backend

Hosted on **Render**

https://secure-chat-sp3m.onrender.com

---

## 🔌 API Base URL

Production

```text
https://secure-chat-sp3m.onrender.com
```

Local Development

```text
http://localhost:5000
```

---

## 📦 Available Scripts

### Frontend

```bash
npm run dev
npm run build
npm run preview
```

### Backend

```bash
npm run dev
npm start
```

---

## 🔒 Authentication

* JWT Authentication
* Password Hashing (bcrypt)
* Google OAuth Login
* Express Session Support

---

## 📡 Real-Time Communication

Socket.IO powers instant messaging between connected users, enabling seamless real-time conversations.

---

## 🚀 Deployment Platforms

| Service  | Platform      |
| -------- | ------------- |
| Frontend | Netlify       |
| Backend  | Render        |
| Database | MongoDB Atlas |

---

## 👨‍💻 Author

**Ramesh Bandari**

* GitHub: https://github.com/RameshBandari26

---

## ⭐ Support

If you found this project helpful, consider giving it a ⭐ on GitHub.
