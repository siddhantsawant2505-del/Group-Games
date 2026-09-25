# Party Games — Real-Time Multiplayer Game Engine

A mobile-first, real-time party and social deduction game engine built with React 19, TypeScript, Tailwind CSS v4, Express, and Socket.IO. Players join a shared room from their mobile phones using a room code or QR code, while the host orchestrates the game through a synchronized, phase-driven state machine.

---

## Current Build Status

| Metric | Status | Details |
|---|---|---|
| **TypeScript / TypeCheck** | `PASSING` | `tsc --noEmit` exits with 0 errors (`npm run lint`) |
| **Vite Client Build** | `PASSING` | React 19 SPA bundled to `dist/` with Tailwind CSS v4 |
| **Server Build** | `PASSING` | Bundled into standalone CommonJS executable `dist/server.cjs` via `esbuild` |
| **Dev Runtime** | `OPERATIONAL` | Integrated Vite middleware via Express on `0.0.0.0:3000` (`npm run dev`) |
| **Production Runtime** | `OPERATIONAL` | Serves compiled static SPA + Socket.IO server (`npm run start`) |
| **Port & Networking** | `PORT 3000` | Binds to `0.0.0.0:3000` behind reverse-proxy layer |

---

## Key Architecture & Components

### 1. Dual Development / Production Server (`server.ts`)
- **Development Mode (`NODE_ENV !== 'production'`)**:
  - Express boots Vite programmatically in `middlewareMode: true` with `appType: 'spa'`.
  - Enables instant hot code evaluation without needing separate terminal processes for frontend and backend.
- **Production Mode (`NODE_ENV === 'production'`)**:
  - Express serves compiled assets statically from `dist/` with a wildcard fallback to `dist/index.html`.
  - Backend logic is compiled by `esbuild` to `dist/server.cjs`, resolving all Node module boundaries cleanly.

### 2. Real-Time State Synchronization (`Socket.IO` & `roomManager.ts`)
- **Public vs. Private State Separation**:
  - The server maintains full room state (`InternalRoom`) containing secret roles, hidden words, and submitted answers.
  - Clients receive masked public state (`room:update`) while individual players receive targeted private state (`player:private-state`), ensuring secret roles (e.g., Impostor vs. Innocent) cannot be snooped via browser dev tools or network inspects.
- **Session Reconnection**:
  - Each player receives a persistent `sessionToken` upon joining.
  - If a player's browser disconnects or refreshes, the client attempts immediate automatic reconnection by token and previous player name.
- **Solo Testing & Bot Injection**:
  - Hosts can click **"Add Bot"** in preview or development.
  - Bots automatically simulate random word clues, dynamic fallbacks, and realistic voting distributions, enabling single-developer testing.

### 3. Wordlist & Thematic Dictionary (`data/wordlist.json`)
- Includes 100 curated, non-commercial, brand-free thematic nouns.
- Categorized into three tiers:
  - **Easy (35 words)**: Common nouns (e.g., *Backpack, Bicycle, Campfire, Telescope, Waterfall*).
  - **Medium (35 words)**: Scientific & historical objects (e.g., *Catapult, Periscope, Monorail, Kaleidoscope, Trebuchet*).
  - **Hard (30 words)**: Specialized antiquities & instruments (e.g., *Astrolabe, Seismograph, Orrery, Armillary, Bathyscaphe*).
- Imported with `"resolveJsonModule": true` into both client and server word utilities (`src/data/impostorWords.ts`).

### 4. Game Phase State Machine
Games follow an extensible phase progression managed by the server:
1. **`lobby`**: Players join via room code / QR code; host configures bots and launches the session.
2. **`game-select`**: Host chooses which party game to play (e.g., *The Impostor*).
3. **`reveal`**: Private role assignment. Innocents receive the secret noun; the Impostor receives only a thematic hint.
4. **`input`**: Players submit their single-word subtle clues.
5. **`reveal-answers`**: Clues are revealed simultaneously to all players in an animated presentation.
6. **`discussion`**: Timed debate to cross-examine suspects and deliberate over suspicious clues.
7. **`vote`**: Secret ballot where all players cast their vote for the suspected Impostor.
8. **`results`**: Tally reveal, Impostor identity exposure, winner announcement, and option to play again or return to lobby.

---

## Directory Structure

```text
/
├── data/
│   └── wordlist.json          # 100-word difficulty-stratified dictionary
├── server/
│   ├── games/
│   │   └── impostor.ts        # Impostor game rules, clue validator, bot logic
│   └── roomManager.ts         # In-memory room manager, sessions, & state masks
├── server.ts                  # HTTP & Socket.IO entry point with Vite middleware
├── src/
│   ├── components/            # UI components (QR modal, header, player badges)
│   ├── data/
│   │   ├── games.ts           # Game catalog definitions
│   │   └── impostorWords.ts   # Client-side word helpers and type bindings
│   ├── screens/               # Phase screen components (Lobby, Reveal, Vote, etc.)
│   ├── services/
│   │   └── socket.ts          # Client-side Socket.IO singleton and event hooks
│   ├── theme/
│   │   └── tokens.ts          # Color tokens, player avatar palettes, animations
│   ├── types.ts               # Shared TypeScript interfaces & phase types
│   ├── App.tsx                # Client root & phase routing
│   ├── main.tsx               # React DOM entry point
│   └── index.css              # Tailwind CSS v4 styling entry point
├── metadata.json              # Platform application manifest & capabilities
├── package.json               # Dependencies and build scripts
├── tsconfig.json              # TypeScript configuration with JSON module support
└── vite.config.ts             # Vite bundler configuration
```

---

## Available Commands

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

## Technical Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (v12), Lucide React, Canvas Confetti, QRCode.
- **Backend**: Node.js, Express 4, Socket.IO 4, `tsx` (dev runtime), `esbuild` (production bundle).
- **Environment**: Single port 3000 for both HTTP and WebSocket traffic.
