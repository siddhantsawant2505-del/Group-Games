# Tech Stack — Party Games

This document breaks down the technologies used in the Party Games engine, explains each dependency's
role, and describes how the stack is organized for development and production.

---

## Stack summary

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 | UI framework with server-components-adjacent client shell |
| Language | TypeScript 7 | Type-safe code across client, server, and shared types |
| Styling | Tailwind CSS v4 | Utility-first styling + design tokens |
| Icons | Lucide React | Consistent open-source icon set |
| Animation | Motion | Spring/animations for UI feedback |
| Backend | Node.js + Express 4 | HTTP server, static/asset serving, middleware |
| Real-time | Socket.IO 4 | WebSocket + polling transport and room-based events |
| Build | Vite 8 | Frontend bundling, HMR, production build |
| Server bundle | esbuild | Bundles `server/index.ts` to standalone CommonJS |
| Runtime (dev) | tsx | Runs TypeScript server directly during development |
| QR codes | qrcode | Generates phone-join QR codes |
| Confetti | canvas-confetti | Results/celebration effects |
| Secrets | dotenv | Loads `.env` for local development |
| AI | @google/genai | Gemini API client for server-side AI calls |

---

## Dependencies in detail

### Frontend

- **react** (`^19.0.1`) and **react-dom** (`^19.0.1`)
  - The UI framework. Components, hooks, and rendering for the mobile app shell.

- **@types/react** (`^19.3.0`) and **@types/react-dom** (`^19.3.0`)
  - TypeScript type definitions for React.

- **vite** (`^8.3.0`)
  - Development server and production bundler for the React client.

- **@vitejs/plugin-react** (`^6.1.1`)
  - Enables Fast Refresh and JSX handling in Vite.

- **@tailwindcss/vite** (`^4.3.3`) and **tailwindcss** (`^4.3.3`)
  - Tailwind CSS integration for Vite. Provides the `@tailwindcss/vite` plugin used in
    `vite.config.ts`; `tailwindcss` is present for install and compatibility.

- **motion** (`^12.23.24`)
  - Animation library used for springs, fades, and micro-interactions.

- **lucide-react** (`^0.546.0`)
  - Icon library. Used consistently across screens for icons like `Play`, `Users`, `Vote`, `Trophy`.

### Real-time & backend

- **express** (`^4.21.2`)
  - HTTP server framework. Mounts Vite middleware in dev and static assets in production, plus
    API routes like `/api/health`.

- **socket.io** (`^4.8.3`) and **socket.io-client** (`^4.8.3`)
  - Real-time transport. Server emits room updates and private per-player state; client subscribes
    to those events and emits input/vote actions.

- **@types/express** (`^4.17.21`)
  - TypeScript definitions for Express.

- **@types/node** (`^22.14.0`)
  - TypeScript definitions for Node.js APIs.

- **dotenv** (`^17.2.3`)
  - Loads environment variables from `.env` for local dev.

### Game features

- **qrcode** (`^1.5.4`) and **@types/qrcode** (`^1.5.6`)
  - Generates QR codes for instant phone-to-room join.

- **canvas-confetti** (`^1.9.4`) and **@types/canvas-confetti** (`^1.9.0`)
  - Browser confetti effects for results celebration.

- **@google/genai** (`^2.4.0`)
  - Google Gemini client for future server-side AI integrations.

### Build & tooling

- **esbuild** (`^0.25.0`)
  - Fast JavaScript bundler used to bundle `server/index.ts` into `dist/server.cjs`.

- **tsx** (`^4.21.0`)
  - TypeScript execution for development (`tsx server/index.ts`).

- **typescript** (`^7.0.2`)
  - Type checker and compiler.

- **autoprefixer** (`^10.4.21`)
  - Post-processing for Tailwind CSS.

- **@types/canvas-confetti**, **@types/express**, **@types/node**, **@types/qrcode**
  - Type definitions for runtime dependencies.

---

## Configuration files

| File | Purpose |
|---|---|
| `tsconfig.json` | TypeScript compiler options: `JSX: react-jsx`, `resolveJsonModule: true`, bundled module resolution, `noEmit: true` |
| `vite.config.ts` | Vite plugins (`react`, `tailwindcss`), `root: client`, aliases `@` → `client/` and `@shared` → `shared/`, dev server HMR/watch behavior |
| `package.json` | Scripts (`dev`, `build`, `start`, `preview`, `clean`, `lint`), dependency versions |
| `bun.lock` | Lockfile for dependency resolution |
| `client/index.html` | HTML entry, meta tags, fonts, and `<script type="module" src="/src/main.tsx">` (resolved relative to Vite's `client/` root) |

---

## Scripts

```bash
npm run dev      # tsx server/index.ts: dev server with Vite middleware
npm run build    # vite build + esbuild server/index.ts -> dist/server.cjs
npm run start    # node dist/server.cjs: production runtime
npm run preview  # vite preview: local static preview
npm run clean    # remove dist/server.cjs
npm run lint     # tsc --noEmit: TypeScript type check
```

---

## Development tooling

- **tsx**: Run `server/index.ts` directly in dev without a separate build step.
- **Vite + @vitejs/plugin-react**: Hot module replacement for React components.
- **TypeScript**: `tsc --noEmit` checks client and server types from one `tsconfig.json`.
- **Express + Socket.IO**: Single-port development and production server.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP and WebSocket port (see `server/index.ts`) |
| `NODE_ENV` | `development` | `production` enables static `dist/` serving |
| `GEMINI_API_KEY` | — | Gemini API key for server-side AI features |
| `APP_URL` | — | Public app URL for links, callbacks, and reverse-proxy routes |

The repo currently includes placeholder values in `.env` (`MY_GEMINI_API_KEY`, `MY_APP_URL`).
Replace them with real credentials before production use. Secrets should also be injected by the
hosting environment rather than committed.

---

## Deployment shape

```text
Browser (player) ──┐
Browser (host)   ──┼── Express + Socket.IO (port 3000, 0.0.0.0)
Browser (player N) ─┘
        │  HTTP(S)
        ▼
   Vite build (client) + esbuild bundle (server)
```

- **Development:** Express boots Vite in `middlewareMode: true` with `appType: 'spa'`.
- **Production:** Express serves `dist/` statically and falls back to `index.html` for SPA routes.

---

## Notes on dependency choices

- **Socket.IO over raw WebSockets** gives automatic reconnection, room scoping, and long-polling
  fallback, which simplifies the mobile-first experience.
- **esbuild** produces a fast, standalone Node.js server bundle without needing CommonJS interop
  across the rest of the project.
- **Tailwind CSS v4** is integrated through Vite, keeping styling one build step away.

---

## Future stack considerations

- **Database/persistence** — Replace in-memory rooms with Postgres/SQLite/Redis for room
  persistence, leaderboards, and session storage.
- **Multi-instance scaling** — Add a Redis-backed Socket.IO adapter for horizontal scaling.
- **Rate limiting & abuse prevention** — Add middleware for room creation, input, and vote rates.
- **Monitoring** — Structured logs, metrics, and Sentry-style error tracking.
