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
npm run dev          # Dev server on http://localhost:3000 (Express + Socket.IO + Vite middleware)
npm run lint         # TypeScript type checking (tsc --noEmit)
npm run build        # Build client (Vite) + bundle server (esbuild) to dist/
npm run start        # Run production build (node dist/server.cjs)
npm run preview      # Preview Vite client build locally
npm run clean        # Clean build artifacts (dist/ directory)
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

## Games collection, rules & working state

Party Games features a collection of six multiplayer party games designed for phone controllers. The flagship game **Impostor** is 100% operational with a dedicated server game engine, while five additional games are integrated into the selection UI and execute on the generic round framework.

| Game | Players | Category | Icon | Current Working State |
|---|---|---|---|---|
| **Impostor** | 3–12 | Social Deduction | Mask | 🟢 **Fully Working & Playable** — Dedicated engine with clue sanitizer, bot AI, and scoring |
| **Avoid the Word** | 3–10 | Taboo / Communication | Ban | 🟡 **Selectable & Framework-Ready** — Generic clue/vote phase; dedicated taboo cards planned |
| **Mafia** | 4–16 | Social Deduction | Detective | 🟡 **Selectable & Framework-Ready** — Generic clue/vote phase; dedicated night/day elimination planned |
| **Guess the Link** | 3–8 | Word Association | Link | 🟡 **Selectable & Framework-Ready** — Generic clue/vote phase; central connection guessing planned |
| **Top 100** | 3–10 | Ranking / Spectrum | List-Ordered | 🟡 **Selectable & Framework-Ready** — Generic clue/vote phase; drag-and-drop ranking UI planned |
| **Reverse Categories** | 3–8 | Trivia / Creative | Shuffle | 🟡 **Selectable & Framework-Ready** — Generic clue/vote phase; 3-item prompt generation planned |

---

### 1. Impostor — Flagship Game (🟢 Fully Operational)

**Impostor** is the flagship game in Party Games, featuring a fully custom server engine (`server/games/impostor.ts`), simulated bot players, and automated scoring.

- **Objective**:
  - **Crew Members**: Identify and vote out the secret Impostor based on suspicious or diverging clues.
  - **The Impostor**: Blend in by submitting a convincing clue despite not knowing the secret word, avoid detection, and frame innocent crewmates.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 12 players (solo testing supported via "+ Add Bot").
  2. **Role Assignment (`reveal` phase, 10s)**:
     - The server selects a secret word and category from the 100-word curated dictionary (`data/wordlist.json`).
     - Exactly 1 player is secretly designated as **The Impostor**; all others become **Crew Members**.
     - **Crew View**: Sees the secret word (e.g. *"Submarine"*) and category hint (*"Maritime & Vessels"*).
     - **Impostor View**: Sees only the category hint with the secret instruction: *"You're the impostor! You do NOT know the secret word. Blend in!"*
  3. **Clue Submission (`input` phase, 20s)**:
     - Every player privately types a **single-word clue** that demonstrates knowledge of the word without giving it away to the Impostor.
     - Server sanitizes input to ensure single-word compliance.
     - Test bots automatically generate plausible contextual clues (from curated association pools) or convincing bluffs.
  4. **Simultaneous Reveal (`reveal-answers` phase, 15s)**:
     - All clues are revealed simultaneously.
     - Display order is randomized using the Fisher-Yates algorithm to eliminate join-order or alphabetical bias.
     - Any player who failed to submit in time is automatically marked with `"(No answer)"`.
  5. **Discussion (`discussion` phase, 90s)**:
     - Timed group debate where players interrogate word choices, spot inconsistencies, and defend their clues. The host can skip the timer at any time.
  6. **Secret Voting (`vote` phase, 25s)**:
     - Players secretly tap a suspect's card to cast an accusation vote. Bots cast simulated votes.
  7. **Results & Scoring (`results` phase)**:
     - **Win Condition**: The Impostor is caught **if and only if** they are the sole candidate receiving the highest vote count.
     - **Scoring**:
       - **+1 point** awarded to each player who correctly voted for the Impostor.
       - **+1 point** awarded to the Impostor if they successfully evaded detection (majority voted incorrectly or a tie occurred).
     - **Post-Round Standings**:
       - Displays the unmasked Impostor and the secret word.
       - Full vote breakdown showing who voted for whom.
       - Dynamic "why" narrative explaining how the Impostor bluffed or why their clue gave them away.
       - Real-time leaderboard with running cumulative scores.
  8. **Next Round Loop (`next-round`)**:
     - Host advances to the next round with a new secret word and freshly randomized Impostor, preserving cumulative scores.

---

### 2. Catalog Games (🟡 Framework-Integrated & Selectable)

All five additional games are fully registered in `@shared/data/games.ts` and can be selected by the host in the `game-select` screen. They currently run through the generic phase state machine (`server/roomManager.ts`) with dedicated game rule modules planned:

#### Avoid the Word (Taboo / Word Trap)
- **Min/Max Players**: 3–10 | **Icon**: `ban`
- **Tagline**: Speak freely, but mind your traps!
- **Rules**:
  - Each player receives a secret target subject alongside 3 forbidden taboo trap words.
  - Players must describe or hint at their subject within 30 seconds without uttering any of the forbidden words.
  - Other players listen closely and buzz or vote if a taboo trap word is used.
- **Current State**: Selectable in game menu; operates on generic clue/vote engine; buzzer and taboo word generation planned for dedicated module.

#### Mafia (Social Deduction & Night Phase)
- **Min/Max Players**: 4–16 | **Icon**: `detective`
- **Tagline**: The village sleeps... who will survive?
- **Rules**:
  - Secret roles are assigned to each phone: Townspeople, Detectives, and Mafia.
  - **Night Phase**: The Mafia secretly chooses a victim to eliminate while the town sleeps.
  - **Day Phase**: Players discuss accusations, defense arguments, and cast votes to exile a suspect.
- **Current State**: Selectable in game menu; runs through generic phase progression; night/day elimination mechanics scheduled.

#### Guess the Link (Lateral Word Association)
- **Min/Max Players**: 3–8 | **Icon**: `link`
- **Tagline**: Connect the mysterious clues!
- **Rules**:
  - Each player receives a unique angle or hint pointing toward an invisible central concept.
  - Every player submits one response that matches their private hint.
  - All revealed answers are displayed together; players collaborate to deduce the secret connection tying them all together.
- **Current State**: Selectable in game menu; utilizes generic prompt/reveal pipeline; central puzzle-matching interface planned.

#### Top 100 (Spectrum Ranking)
- **Min/Max Players**: 3–10 | **Icon**: `list-ordered`
- **Tagline**: Rank the absurd, place your bets!
- **Rules**:
  - Players are given a secret number from 1 to 100 on an outrageous intensity spectrum (e.g. *"Mildly annoying to Absolute catastrophic disaster"*).
  - Each player writes an example scaled to their exact secret number.
  - The group must debate and arrange all submitted answers in ascending order from 1 to 100.
- **Current State**: Selectable in game menu; accepts generic text inputs; drag-and-drop spectrum ordering interface planned.

#### Reverse Categories (Creative Trivia)
- **Min/Max Players**: 3–8 | **Icon**: `shuffle`
- **Tagline**: Answers first, questions later!
- **Rules**:
  - Three bizarre, seemingly unrelated items appear on screen.
  - Players race against the clock to invent the cleverest or funniest category that links all three items.
  - The group reviews submissions and votes on the best category invention.
- **Current State**: Selectable in game menu; runs on generic input/voting phase; multi-item prompt generator and creative voting planned.

---

## Core architecture

### 1. Dual Development / Production Server (`server/index.ts`)

- **Development Mode (`NODE_ENV !== 'production'`)**: Express boots Vite programmatically in
  `middlewareMode: true` with `appType: 'spa'`. Frontend changes update live via Vite HMR on the same port.
- **Production Mode (`NODE_ENV === 'production'`)**: Express serves compiled assets statically
  from `dist/` with a wildcard fallback to `dist/index.html`.
- **Backend entry**: `server/index.ts` initializes the HTTP server, Socket.IO, `/api/health` endpoint, and Vite/static
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

## System build configuration

The application is structured into three distinct layers: `client/` (React SPA), `server/` (Express + Socket.IO), and `shared/` (types, data, and tokens).

```text
┌─────────────────────────────────────────────────────────────────┐
│                      System Build Pipeline                      │
│                                                                 │
│  client/ ─────────► [ vite build ] ─────────► dist/             │
│  (React 19 + v4)    (root: 'client')        (client SPA assets) │
│                                                                 │
│  server/ ─────────► [ esbuild ] ────────────► dist/server.cjs   │
│  (index.ts)         (Node CJS bundle)       (server bundle)     │
│                                                                 │
│  shared/ ─────────► Shared between client & server              │
│  (types, data)      via path alias @shared/*                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Frontend Client Build (`Vite 8`)
- **Root Directory**: `client/` (configured via `root: path.resolve(projectRoot, 'client')` in `vite.config.ts`).
- **HTML Entry Point**: `client/index.html` references `/src/main.tsx` relative to the Vite root.
- **Vite Plugins**:
  - `@vitejs/plugin-react` (`^6.1.1`) for React 19 JSX transformation and Fast Refresh.
  - `@tailwindcss/vite` (`^4.3.3`) for integrated Tailwind CSS v4 styling and theme tokens.
- **Output Directory**: Emits compiled client assets directly to root `dist/` (`emptyOutDir: true`).
- **Path Aliases**:
  - `@` resolves to `<projectRoot>/client`
  - `@shared` resolves to `<projectRoot>/shared`

### 2. Backend Server Bundle (`esbuild`)
- **Source Entry**: `server/index.ts`
- **Output Artifact**: `dist/server.cjs` and source map `dist/server.cjs.map`.
- **Target Platform**: Node.js (`--platform=node`).
- **Bundle Format**: CommonJS (`--format=cjs`).
- **Dependency Strategy**: `--packages=external` keeps `node_modules` external to avoid bundle bloat and ensure native module compatibility.
- **Path Resolution**: Runtime uses `process.cwd()` for root directory resolution, ensuring reliable static file serving across both `tsx` development and bundled production execution.

### 3. TypeScript Configuration (`tsconfig.json`)
- **Target & Module**: Target `ES2022`, module `ESNext`, `moduleResolution: "bundler"`.
- **Path Mappings**:
  - `"@/*": ["./client/*"]`
  - `"@shared/*": ["./shared/*"]`
- **Type Checking**: Unified type validation across client, server, and shared directories with `npm run lint` (`tsc --noEmit`).

### 4. Dual Runtimes: Development vs. Production
- **Development (`npm run dev` / `tsx server/index.ts`)**:
  - Express boots Vite in `middlewareMode: true` with `appType: 'spa'`.
  - Serves API, Socket.IO, and HMR client from a single port (`3000`).
  - Auto-discovers and logs both Local (`http://localhost:3000/`) and Network IPv4 (`http://<LAN_IP>:3000/`) for mobile device testing.
- **Production (`npm run build` + `npm run start`)**:
  - `npm run build` runs `vite build && esbuild server/index.ts ...` to compile both client and server into `dist/`.
  - `npm run start` launches `node dist/server.cjs`.
  - Express serves static assets from `dist/` and falls back to `dist/index.html` for SPA routing.

---

## Directory structure

```text
/
├── client/                    # React 19 frontend SPA (Vite root)
│   ├── index.html             # Client HTML entry point
│   └── src/
│       ├── components/        # UI components (QR modal, header, player badges)
│       ├── screens/           # Phase screen components
│       ├── services/
│       │   ├── socket.ts      # Client-side Socket.IO singleton
│       │   └── sound.ts       # Web audio notifications & haptics
│       ├── theme/
│       │   ├── ThemeProvider.tsx  # Theme mode provider
│       │   └── index.ts
│       ├── App.tsx            # Client root & phase routing
│       ├── main.tsx           # React DOM entry
│       └── index.css          # Tailwind CSS v4 styling
├── dist/                      # Production build output (generated by npm run build)
│   ├── assets/                # Bundled client JS and CSS chunks
│   ├── index.html             # Bundled client HTML entry
│   ├── server.cjs             # Bundled standalone Node.js server (esbuild)
│   └── server.cjs.map         # Server sourcemap
├── server/                    # Backend Node.js + Express + Socket.IO server
│   ├── games/
│   │   └── impostor.ts        # Impostor game rules, clue validator, bot logic
│   ├── roomManager.ts         # In-memory room manager, sessions, & state masks
│   └── index.ts               # Server entry point with Vite middleware / static serving
├── shared/                    # Code imported by BOTH client and server (@shared/*)
│   ├── data/
│   │   ├── games.ts           # Game catalog definitions
│   │   └── impostorWords.ts   # Word list helpers (server-side word selection)
│   ├── theme/
│   │   └── tokens.ts          # Player color tokens & palette
│   └── types.ts               # Shared TypeScript models and interfaces
├── data/
│   └── wordlist.json          # 100-word difficulty-stratified dictionary
├── docs/                      # Project documentation
│   ├── ARCHITECTURE.md        # Architecture reference
│   ├── GAME_rules.md          # Game rules & system rules
│   ├── party-game-ideas.md    # Party game ideas for future expansion
│   └── tech-stack.md          # Stack breakdown & environment
├── metadata.json              # Project metadata
├── package.json               # Scripts and dependency definitions
├── tsconfig.json              # TypeScript configuration & path aliases
├── vite.config.ts             # Vite bundler & plugin configuration
└── bun.lock                   # Lockfile for dependency resolution
```

---

## Available commands

```bash
# Start full-stack development server (tsx server/index.ts: Express + Socket.IO + Vite middleware)
npm run dev

# Run TypeScript type validation across client, server, and shared code (tsc --noEmit)
npm run lint

# Build client SPA (vite build) and bundle server (esbuild server/index.ts -> dist/server.cjs)
npm run build

# Run the compiled production build (node dist/server.cjs)
npm run start

# Preview Vite production build locally
npm run preview

# Clean build artifacts (dist/ directory)
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

| Variable | Purpose | Default | Required |
|---|---|---|---|
| `PORT` | HTTP and WebSocket server port | `3000` | No |
| `HOST` | Server host binding address | `0.0.0.0` | No |
| `NODE_ENV` | Environment mode (`development` vs `production`) | `development` | Yes |
| `DISABLE_HMR` | Disable Vite HMR and file watcher during automated edits | `false` | No |
| `GEMINI_API_KEY` | Gemini API key for server-side AI calls (if enabled) | — | No |
| `APP_URL` | Public app URL for self-referential links and QR codes | — | No |

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

- Use `tsx server/index.ts` for local development (TypeScript runtime).
- Use `npm run build` before deploying to production.
- The server is currently an in-memory only store — rooms do not persist across restarts.
- For production-ready scaling, add a database-backed room store and a Socket.IO adapter (see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

---

## Project metadata

- **Name:** Party Games
- **Description:** Mobile-first real-time party and social deduction game engine.
- **Major capability:** Server-side game engine with real-time multiplayer.
