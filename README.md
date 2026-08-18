# 🎧 Listen Together

A full-stack real-time web app that lets friends who are far apart join the same room and watch/listen to YouTube videos in synchronized playback, with live chat and a shared queue.

**Stack:** React + Vite (frontend) · Node.js + Express + Socket.IO (backend) · MongoDB (persistence, optional but recommended)

---

## 1. Folder structure

```
listen-together/
├── backend/
│   ├── src/
│   │   ├── config/db.js            # MongoDB connection
│   │   ├── models/Room.js          # Mongoose Room schema
│   │   ├── controllers/            # REST controllers (create/get room)
│   │   ├── routes/                 # REST routes
│   │   ├── socket/
│   │   │   ├── roomManager.js      # In-memory room state (source of truth) + persistence
│   │   │   └── socketHandler.js    # All Socket.IO events (join, chat, playback, queue, host actions)
│   │   ├── middleware/             # Rate limiting, error handling
│   │   ├── utils/                  # Validation, sanitization, room code generation
│   │   └── server.js               # App entrypoint
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/             # VideoPlayer, Chat, Queue, MembersList, RoomControls
│   │   ├── pages/                  # Home, CreateRoom, JoinRoom, Room, ErrorPage
│   │   ├── context/                # SocketContext, ToastContext
│   │   ├── services/api.js         # REST calls
│   │   ├── utils/                  # session (userId/name), YouTube URL parsing
│   │   └── App.jsx / main.jsx
│   ├── index.html
│   ├── package.json
│   └── .env.example
│
└── README.md
```

**Why state lives where it does:** Live room state (members, queue, playback position) is kept in-memory on the server for low-latency sync, and mirrored to MongoDB every 60s and on key events so rooms survive a server restart. No video/audio is ever downloaded or stored — only YouTube video IDs and metadata (title/thumbnail via YouTube's public oEmbed endpoint).

---

## 2. Install dependencies

You need **Node.js 18+** and (optionally, but recommended) a **MongoDB** instance — local or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

> If you don't configure MongoDB, the app still fully works — rooms just live in memory and are lost if the server restarts.

---

## 3. Configure environment variables

**Backend** — copy `backend/.env.example` to `backend/.env`:

```bash
cd backend
cp .env.example .env
```

```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/listen-together
CORS_ORIGIN=http://localhost:5173
MAX_ROOM_MEMBERS=25
ROOM_INACTIVITY_MINUTES=180
```

- `MONGODB_URI` — leave blank to run without persistence.
- `CORS_ORIGIN` — comma-separated list of allowed frontend origins.

**Frontend** — copy `frontend/.env.example` to `frontend/.env`:

```bash
cd frontend
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:4000
```

Point this at wherever your backend is running.

---

## 4. Start the app (development)

In two separate terminals:

```bash
# Terminal 1 — backend
cd backend
npm run dev        # nodemon, auto-restarts on changes
# or: npm start

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 5. Test with two users locally

1. Open `http://localhost:5173` in one browser window → **Create a Room** → enter a name → you become the host.
2. Copy the invite link shown (or click "Copy link" inside the room).
3. Open that link in a **second browser window** (or an incognito window, or a different browser like Brave/Firefox) → enter a different display name → **Join Room**.
4. Verify:
   - Both users appear in the "People" tab.
   - Chat messages sent from one appear instantly in the other.
   - Adding a YouTube link to the queue on one client updates the queue on both.
   - Play / pause / seek from the host is mirrored on the guest's player within ~1 second.
   - Closing one tab shows a "left the room" system message on the other after a short grace period (this allows brief reconnects without spamming leave/join messages).
   - If the host closes their tab, host privileges automatically transfer to the next member.

To test across **two physical devices** (e.g. desktop + Android phone), replace `localhost` with your machine's LAN IP in both `.env` files (e.g. `VITE_API_URL=http://192.168.1.20:4000`, and `CORS_ORIGIN=http://192.168.1.20:5173`), restart both servers, and open `http://192.168.1.20:5173` on the second device (same Wi-Fi network).

---

## 6. Production build

**Frontend:**

```bash
cd frontend
npm run build       # outputs static files to frontend/dist
npm run preview     # optional local preview of the production build
```

Serve the contents of `frontend/dist` from any static host (see deployment options below).

**Backend:**

```bash
cd backend
npm start           # runs node src/server.js directly, no build step needed
```

Set `NODE_ENV=production` and a real `MONGODB_URI` in your production `.env`.

---

## 7. Deployment options

**Backend (Node + Socket.IO — needs a persistent process, not a serverless function):**
- [Render](https://render.com) or [Railway](https://railway.app) — easiest, free tiers available, native WebSocket support.
- A VPS (DigitalOcean, Linode, EC2) behind Nginx as a reverse proxy, run with `pm2` or a `systemd` service for resilience.
- Set `CORS_ORIGIN` to your deployed frontend's URL and `MONGODB_URI` to your Atlas connection string.

**Frontend (static files):**
- [Vercel](https://vercel.com) or [Netlify](https://netlify.com) — connect your repo, set build command `npm run build`, output directory `dist`, and set `VITE_API_URL` to your deployed backend's URL.

**Database:**
- [MongoDB Atlas](https://www.mongodb.com/atlas) free tier is sufficient for this app's data volume.

**HTTPS note:** Browsers require secure WebSocket (`wss://`) when the page is served over `https://`. Both Render/Railway and Vercel/Netlify provide HTTPS automatically — just make sure `VITE_API_URL` uses `https://` in production, Socket.IO will upgrade to `wss://` automatically.

---

## 8. Feature notes

- **Host permissions are enforced server-side** — every play/pause/seek/queue-management/kick/lock event is validated against the room's `hostUserId` on the socket handler; the frontend UI hiding buttons is a convenience, not the security boundary.
- **Sync strategy** — the host's client drives state; other clients receive `playback:update` on explicit actions (play/pause/seek/video change) and a lightweight `playback:heartbeat` every ~3-4s for drift correction, rather than streaming position continuously.
- **YouTube compliance** — the app only embeds YouTube's official IFrame Player API and fetches title/thumbnail via YouTube's public oEmbed endpoint (no API key required). It never downloads, proxies, or attempts to bypass ads, DRM, or regional restrictions.
- **Reconnection** — Socket.IO reconnects automatically; on reconnect the client re-emits `room:join`, which returns the latest full room state so chat, queue, members, and playback resync.
- **Security** — input sanitized with `xss`, REST rate-limited with `express-rate-limit`, per-socket rate limits on chat/queue actions, `.env`-based config, no secrets in the frontend bundle.
