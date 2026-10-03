# Party Games — Real-Time Multiplayer Game Engine

A mobile-first, real-time party and social deduction game engine built with React 19, TypeScript, Tailwind CSS v4, Express, and Socket.IO. Players join a shared room from their mobile phones using a room code or QR code, while the host orchestrates the game through a synchronized, phase-driven state machine.

---

## Project Documentation

| Document | Purpose |
|---|---|
| [README.md](README.md) | This file: overview, quickstart, features, architecture, development guide |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Deep architecture reference: Socket.IO model, room lifecycle, phase state machine, data model, anti-cheat, scaling, hosting |
| [docs/GAME_rules.md](docs/GAME_rules.md) | Current game rules, accepted system rules, phase rules, architecture notes, hardening recommendations |
| [docs/party-game-ideas.md](docs/party-game-ideas.md) | Reference list of fun multiplayer party games for friends: social deduction, word/clue, communication, trivia, and role games |
| [docs/tech-stack.md](docs/tech-stack.md) | Technology stack breakdown, dependency roles, tooling, and environment variables |

---

## Quickstart

```bash
npm install
npm run dev          # Dev server on http://localhost:3000 (Express + Socket.IO + Vite)
npm run lint         # TypeScript type checking (tsc --noEmit)
npm run build        # Build client + bundle server to dist/server.cjs
npm run start        # Run production build (NODE_ENV=production)
```

---

## What "Party Games" is

**Party Games** is a mobile-first, real-time multiplayer **party / social-deduction game engine**.

- All players join from their own phones; there is no shared monitor or TV.
- The server is **authoritative**: it owns the full room state, secret roles, hidden words,
  submitted answers, and the phase state machine.
- Players receive a **masked public** state for the room and a **targeted private** state for
  themselves, so secret roles and hidden words cannot be snooped through dev tools or the network
  inspector.
- A 4-character room code + QR code are used for joining.
- A "next-round" loop lets a host replay a new round with a fresh role assignment.

The flagship game currently implemented is **Impostor**, with additional game ideas documented for
future expansion.

---

## Features

- **Mobile-first UI** — max-width `480px`, touch targets ≥ 48px, spring animations, dark/light/system theme.
- **Real-time sync** — Socket.IO with WebSocket and HTTP long-polling fallback.
- **Server-authoritative state** — room/phase/session state, timers, role assignment, and votes live on the server.
- **Public / private state separation** — `room:update` broadcasts safe public state; `player:private-state` sends targeted secrets.
- **QR + room-code join** — scan a phone camera to open the exact room.
- **Session reconnect** — reconnect by previous name or session token.
- **Host controls** — game selection, phase advancement, skip timers, and bot injection for solo testing.
- **Six built-in games** — Impostor, Avoid the Word, Mafia, Guess the Link, Top 100, Reverse Categories.
- **100-word wordlist** — difficulty-stratified thematic nouns for the Impostor game.
- **Extensible phase machine** — lobby, game-select, reveal, input, reveal-answers, discussion, vote, results, next-round.

---

## Deployed / continuous integration checks

| Metric | Status | Details |
|---|---|---|
| TypeScript / TypeCheck | `PASSING` | `npm run lint` exits with 0 errors |
| Vite Client Build | `PASSING` | React 19 SPA bundled to `dist/` with Tailwind CSS v4 |
| Server Build | `PASSING` | Bundled into standalone CommonJS executable `dist/server.cjs` via esbuild |
| Dev Runtime | `OPERATIONAL` | Express + Socket.IO + Vite middleware on `0.0.0.0:3000` |
| Production Runtime | `OPERATIONAL` | Serves compiled SPA + Socket.IO server |
| Port & Networking | `PORT 3000` | Binds to `0.0.0.0:3000` |

---

## Core architecture

### 1. Dual Development / Production Server (`server.ts`)

- **Development Mode (`NODE_ENV !== 'production'`)**: Express boots Vite programmatically in
  `middlewareMode: true` with `appType: 'spa'`.
- **Production Mode (`NODE_ENV === 'production'`)**: Express serves compiled assets statically
  from `dist/` with a wildcard fallback to `dist/index.html`.
- **Backend entry**: `server.ts` starts the HTTP server, Socket.IO, health endpoint, and Vite/static
  middleware.

### 2. Real-Time State Synchronization (`Socket.IO` & `roomManager.ts`)

- **Public vs. Private State Separation**:
  - The server maintains full room state (`InternalRoom`) containing secret roles, hidden words,
    and submitted answers.
  - Clients receive masked public state (`room:update`) while individual players receive targeted
    private state (`player:private-state`), ensuring secret roles cannot be snooped.
- **Session Reconnection**: Each player receives a persistent `sessionToken` upon joining.
- **Solo Testing & Bot Injection**: Hosts can click **"+ Add Bot"** in preview or development.

### 3. Game Phase State Machine

1. **`lobby`** — players join via room code/QR; host configures bots and launches.
2. **`game-select`** — host chooses a party game.
3. **`reveal`** — private role assignment.
4. **`input`** — players submit one-word clues.
5. **`reveal-answers`** — clues revealed simultaneously.
6. **`discussion`** — timed debate.
7. **`vote`** — secret ballot.
8. **`results`** — tally reveal, impostor exposure, winner, next-round option.
9. **`next-round`** — new round with a new secret assignment.

---

## Directory structure

```text
/
├── data/
│   └── wordlist.json          # 100-word difficulty-stratified dictionary
├── docs/                      # Project documentation
│   ├── ARCHITECTURE.md        # Architecture reference
│   ├── GAME_rules.md          # Game rules & system rules
│   ├── party-game-ideas.md    # Party game ideas for future expansion
│   └── tech-stack.md          # Stack breakdown & environment
├── server/
│   ├── games/
│   │   └── impostor.ts        # Impostor game rules, clue validator, bot logic
│   └── roomManager.ts         # In-memory room manager, sessions, & state masks
├── server.ts                  # HTTP & Socket.IO entry point with Vite middleware
├── src/
│   ├── components/            # UI components (QR modal, header, player badges)
│   ├── data/
│   │   ├── games.ts           # Game catalog definitions
│   │   └── impostorWords.ts   # Client-side word helpers
│   ├── screens/               # Phase screen components
│   ├── services/
│   │   ├── socket.ts          # Client-side Socket.IO singleton
│   │   └── sound.ts           # Web audio notifications & haptics
│   ├── theme/
│   │   ├── tokens.ts          # Color tokens, player palettes, animations
│   │   └── ThemeProvider.tsx  # Theme mode provider
│   ├── types.ts               # Shared TypeScript interfaces
│   ├── App.tsx                # Client root & phase routing
│   ├── main.tsx               # React DOM entry
│   └── index.css              # Tailwind CSS v4 styling
├── index.html
├── metadata.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── bun.lock
```

---

## Available commands

```bash
# Start full-stack development server (Express + Socket.IO + Vite middleware)
npm run dev

# Run TypeScript type validation across all client and server files
npm run lint

# Build client for production (Vite) and bundle server for Node.js (esbuild)
npm run build

# Run the compiled production build
npm run start

# Clean build artifacts
npm run clean
```

---

## Technical stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React, QRCode, Canvas Confetti.
- **Backend**: Node.js, Express 4, Socket.IO 4, `tsx` (dev runtime), `esbuild` (production bundle).
- **Bundler**: Vite 8.
- **Package manager**: `bun.lock` is bundled; `package.json` scripts target `npm`-style commands.

---

## Environment

| Variable | Purpose | Required |
|---|---|---|
| `NODE_ENV` | `development` vs `production` | Yes |
| `PORT` | HTTP/WS port (default `3000`) | No |
| `GEMINI_API_KEY` | Gemini API key for server-side AI calls (if enabled) | No |
| `APP_URL` | Public URL for self-referential links, OAuth callbacks, API endpoints | No |

> **Note:** The repository currently contains placeholder values in `.env`
> (`GEMINI_API_KEY="MY_GEMINI_API_KEY"`, `APP_URL="MY_APP_URL"`). Treat these as examples —
> replace them with real values before deploying to production.

---

## Security & anti-cheat

- Server-authoritative state means clients cannot read hidden roles or words from the network.
- The server validates transitions, phase changes, and input before applying state.
- Players receive private state only for their own session (`player:private-state`).
- Reconnection is by session token or name; the server updates `connected` flags and may reassign
  the host if the host disconnects.

---

## Development notes

- Use `tsx server.ts` for local development (TypeScript runtime).
- Use `npm run build` before deploying to production.
- The server is currently an in-memory only store — rooms do not persist across restarts.
- For production-ready scaling, add a database-backed room store and a Socket.IO adapter (see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

---

## Project metadata

- **Name:** Party Games
- **Description:** Mobile-first real-time party and social deduction game engine.
- **Major capability:** Server-side game engine with real-time multiplayer.
