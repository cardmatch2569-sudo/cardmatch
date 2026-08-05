# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CardMatch** — Thai card game matchmaking platform. Players find opponents online, then play physical card games face-to-face via WebRTC video call. Built with Next.js 16 (client) + Node.js/Express (server) + PostgreSQL, deployed on Vercel (client) and Railway (server).

Production URLs:
- Client: `https://cardmatch-phi.vercel.app`
- Server: `https://cardmatch-at3c-production.up.railway.app`

## Commands

### Root (run both processes)
```bash
npm run server          # starts server with nodemon
npm run client          # starts client (HTTPS with local certs)
npm run install:all     # install dependencies for both
npm run setup-lan       # generate QR code for LAN IP (mobile testing)
npm run setup-https     # generate self-signed certs for local HTTPS
```

### Client (`cd client`)
```bash
npm run dev             # HTTPS dev server on 0.0.0.0 (needs certs/)
npm run dev-http        # HTTP dev server (no certs needed)
npm run build           # production build — run this to catch errors before pushing
npm run start           # production server
```

### Server (`cd server`)
```bash
npm run dev             # nodemon watch
npm start               # production
npm run seed            # seed game types into DB
node create-admin.js    # interactive prompt to create an admin user
```

**Always run `npm run build` in `client/` before committing to catch JSX/import errors.**

## Architecture

### Monorepo layout
```
/
├── client/          Next.js 16 app router (Vercel)
│   ├── app/         Pages (one file per route)
│   ├── components/  Shared React components
│   ├── context/     AuthContext, SocketContext
│   ├── hooks/       useCountdown, useLiveKit
│   └── lib/         api.js (fetch wrapper), translations.js
└── server/          Express + Socket.IO (Railway)
    ├── routes/      REST API handlers
    ├── socket/      handlers.js — all Socket.IO events
    ├── models/      User, Room, GameType, EmailVerification
    ├── middleware/   auth.js (protect, adminOnly)
    ├── config/      db.js — PostgreSQL pool + schema init
    └── utils/       logger, errorLogger, mailer
```

### Data flow

**Authentication**: JWT stored in both `sessionStorage` (per-tab) and `localStorage` (persistence). Key: `cg_token`. Language preference: `cg_lang` in localStorage. Auth state lives in `AuthContext` — all pages use `const { user, lang, loading } = useAuth()`.

**HTTP API**: `client/lib/api.js` wraps fetch with auto-auth headers, 30s timeout, and bilingual error messages. All pages import `{ api }` from `../lib/api` and call `api.get()` / `api.post()` etc.

**Real-time**: `SocketContext` manages a single Socket.IO connection per user. Pages that need sockets call `const { getSocket, connected, socketReady } = useSocket()`. The socket connects only when `user` is set and disconnects on logout. Lobby callbacks are registered via `setLobbyCallbacks()` to avoid stale closure issues.

**Video calls (P2P)**: `room/[id]/page.js` implements WebRTC manually using `RTCPeerConnection`. Signaling goes through Socket.IO (`webrtc_offer`, `webrtc_answer`, `ice_candidate`). Uses `simple-peer` types but raw RTCPeerConnection for control. STUN: `stun:stun.l.google.com:19302`.

**Live streaming (SFU)**: `hooks/useLiveKit.js` — publisher reuses existing P2P stream tracks (no second camera capture). LiveKit room name is always `lk_{roomId}`. Spectators connect via `app/spectate/[roomId]/page.js`. Token endpoint: `POST /api/livekit/token` with `{ roomName, role: 'publisher'|'subscriber' }`.

**Tournament engine**: Entirely in-memory in `server/socket/handlers.js`. Maps: `tournaments` (tournamentId → state), `tourneyMatches` (roomId → match). Persisted to PostgreSQL tables `Tournaments`, `TournamentMatches`, `TournamentPlayers` — restored on server restart via `restoreTournamentsFromDB()`. ELO: K=32, floor at 100.

**Server state** (in-memory, `socket/handlers.js`):
- `onlineUsers` — userId → socket info
- `matchQueues` — gameTypeId → waiting players
- `activeRooms` — roomId → players
- `tournaments` / `tourneyMatches` — full tournament state
- `pendingChallenges`, `pendingReconnects`, `adminWatching`

### Key server patterns

- `protect` middleware: verifies JWT, attaches `req.user` (calls `User.toPublic()` — no password field).
- `adminOnly` middleware: checks `req.user.isAdmin`.
- All models use raw SQL via `getPool()` (node-postgres). No ORM.
- `initTables()` in `db.js` runs `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` on every startup — safe for re-deploy.
- Schema auto-migrates: just add a new `ALTER TABLE ADD COLUMN IF NOT EXISTS` line.

### Key client patterns

- **All pages are client components** (`'use client'`). Server metadata (for pages that need `<title>`) goes in a sibling `layout.js`.
- **Bilingual**: every user-facing string comes from `client/lib/translations.js` (`const tl = translations[lang]`) or inline ternaries (`lang === 'th' ? '...' : '...'`). Never hardcode UI text.
- **Tailwind opacity fractions**: non-standard values use bracket notation — `bg-white/[0.03]` not `bg-white/3`. The JIT compiler requires this for non-preset steps.
- **`showToast(message, type)`** — available inside room page; other pages use their own local toast state pattern.
- **`PageLoader`** component — use for loading states instead of `return null`.

## Design System

Dark-only UI. CSS variables defined in `client/app/globals.css`:
- Background: `--bg: #07070f`, `--card: #0f0f1e`
- Primary: `--purple: #7c3aed`
- Border: `--border: #1c1c35`

Utility classes available globally: `.card` (card surface + border + radius), `.btn-primary`, `.btn-ghost`, `.badge`.

Dynamic viewport height: use `var(--vh)` (set by `ViewportHeight.jsx`) instead of `100vh` for mobile compatibility. Navbar height: `var(--navbar-h)` = `calc(4rem + var(--safe-top))`.

Icons: `lucide-react` throughout. Font: Inter + Noto Sans Thai (Google Fonts CDN).

## Environment Variables

### Server (`server/.env`)
```
DATABASE_URL=        # PostgreSQL connection string (Railway auto-provides)
JWT_SECRET=          # long random string
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=    # Google OAuth
EMAIL_USER=          # Gmail for OTP emails
EMAIL_PASS=          # Gmail App Password
CLIENT_URL=          # Vercel URL (for CORS)
NODE_ENV=production
PORT=5000
LIVEKIT_API_KEY=     # from cloud.livekit.io
LIVEKIT_API_SECRET=
LIVEKIT_URL=         # wss://xxx.livekit.cloud
```

### Client (`client/.env.local` or Vercel dashboard)
```
NEXT_PUBLIC_SERVER_URL=    # Railway URL
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

## Deployment

- **Client → Vercel**: auto-deploys on push to `main`. No manual step needed.
- **Server → Railway**: auto-deploys on push to `main`.
- **Rule**: always commit + push to production after every fix.

## Game Types

Seeded automatically on startup. The two active games are:
- "Battle of Talingchan" / "แบทเทิลออฟตลิ่งชัน" (`color: #e11d48`)
- "Cardfight!! Vanguard" / "การ์ดไฟต์!! แวนการ์ด" (`color: #1d4ed8`)

Admin can add/edit game types via the Admin panel (`/admin`).

## Admin Access

Create via `node server/create-admin.js` (interactive prompt). Admin users see an extra Admin tab in the navbar and have access to `/admin`. In tournament rooms, admins spectate (no Go Live button) and can declare match results.

## Rank System (ELO tiers)

Bronze < 1100, Silver 1100–1299, Gold 1300–1499, Platinum 1500–1699, Diamond ≥ 1700. Starting ELO: 1000. Floor: 100.
