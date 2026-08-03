# 🔒 Secure Chat

A real-time, end-to-end encrypted 1-on-1 chat application with WhatsApp-style
chat requests, profile management, and message deletion controls.

**Live app:** [https://securechat-platform.netlify.app/](https://securechat-platform.netlify.app/)

> ⚠️ The backend (Render free tier) may take **20–30 seconds** to wake up on
> the first request after being idle. If login/register seems stuck, give it
> a moment and try again.

---

## ✨ Features

- **End-to-end encryption** — messages are encrypted client-side (AES-256-GCM)
  before ever leaving the browser. The server only ever stores ciphertext; it
  cannot read your messages.
- **Per-conversation passphrase** — each chat has its own encryption key,
  derived from a passphrase both people agree on outside the app. Nothing is
  stored or sent to the server.
- **Chat requests (invite → accept)** — you can't message someone until they
  accept your chat request, similar to WhatsApp/Instagram.
- **Add Chat** — search for people by name or email, send a request, and
  manage incoming requests from a dedicated tab with a live badge count.
- **Real-time messaging** — powered by Socket.IO, including live delivery of
  new messages, chat requests, and acceptances.
- **Delete for me / Delete for everyone** — WhatsApp-style message deletion.
  "Delete for everyone" (sender only, within 24 hours) removes the message's
  ciphertext from the database for both participants.
- **Profile settings** — edit your name, email, and profile picture (resized
  client-side before upload).
- **Account settings** — change your password (with current-password
  verification), or recover access via a **Forgot Password** email flow.
---

## 🧱 Tech Stack

**Frontend**
- React + Vite
- React Router
- Socket.IO client
- Axios
- FontAwesome icons
- Web Crypto API (AES-256-GCM, PBKDF2)

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- Socket.IO
- JSON Web Tokens (JWT) for auth
- bcryptjs for password hashing
- Nodemailer for password-reset emails

**Deployment**
- Frontend: [Netlify](https://www.netlify.com/)
- Backend: [Render](https://render.com/)
- Database: [MongoDB Atlas](https://www.mongodb.com/atlas)

---

## 📁 Project Structure

```
SecureChat/
├── backend/
│   ├── config/          # MongoDB connection
│   ├── controllers/     # Route logic (auth, messages, connections)
│   ├── middleware/      # JWT auth middleware
│   ├── models/          # Mongoose schemas (User, Message, Connection)
│   ├── routes/          # Express routes
│   ├── utils/            # Token generation, email sending
│   └── index.js           # App entry point (Express + Socket.IO)
└── frontend/
    ├── public/
    │   └── logo.svg
    └── src/
        ├── api/            # Axios client
        ├── components/     # Logo, Settings, Add Chat, Passphrase modals
        ├── pages/           # Register, Chat, Forgot/Reset Password
        └── utils/            # Encryption helpers, image resizing
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- A MongoDB connection string (e.g. free tier on [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/SecureChat.git
cd SecureChat
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (see [Environment Variables](#-environment-variables) below), then:
```bash
npm run dev
```
The API will run at `http://localhost:5000`.

### 3. Frontend setup
```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:
```
VITE_API_URL=http://localhost:5000
```

```bash
npm run dev
```
The app will run at `http://localhost:5173`.

---

## 🔑 Environment Variables

### `backend/.env`
```env
MONGO_URL=your-mongodb-connection-string
PORT=5000
JWT_SECRET=your-random-secret-string

# Used to build the password-reset link emailed to users
FRONTEND_URL=http://localhost:5173

# Optional: real email delivery for "Forgot Password".
# Leave blank to use the console-log dev fallback.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### `frontend/.env`
```env
VITE_API_URL=http://localhost:5000
```

> Never commit `.env` files — they're already excluded via `.gitignore`.

---

## ☁️ Deployment

### Backend → Render
1. Push this repo to GitHub.
2. On [Render](https://render.com/), create a **New Web Service** and connect the repo.
3. Set the **Root Directory** to `backend`.
4. Build command: `npm install`
5. Start command: `node index.js`
6. Add all the `backend/.env` variables above under **Environment**.
7. Once deployed, copy the live URL (e.g. `https://your-backend.onrender.com`).

### Frontend → Netlify
1. On [Netlify](https://app.netlify.com/), create a **New site from Git** and connect the repo.
2. Set the **Base directory** to `frontend`.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Under **Site settings → Environment variables**, add:
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```
6. Deploy. Update `FRONTEND_URL` in the backend's Render environment to match your live Netlify URL (needed for password-reset links).

> **CORS:** the backend currently allows all origins (`origin: '*'`) for
> simplicity. For production, restrict `cors()` and the Socket.IO `cors`
> config in `backend/index.js` to your actual Netlify domain.

---

## ⚠️ Known Limitations

- **Shared-passphrase encryption, not full E2EE key exchange** — each
  conversation's key is derived from a passphrase both users must agree on
  out-of-band. This is not the same guarantee as asymmetric E2EE protocols
  (e.g. Signal), but does mean the server/database never sees plaintext.
- **No forward secrecy** — if a passphrase leaks, past messages encrypted
  with it become readable.
- **Profile pictures are stored as base64 strings in MongoDB** — fine for
  personal projects, but doesn't scale well. For production, use dedicated
  file/object storage (S3, Cloudinary, etc.).
- **Render free tier cold starts** — the backend spins down after
  inactivity and takes ~20–30 seconds to wake up on the next request.

---

## 📄 License

This project is provided as-is for personal/educational use.
