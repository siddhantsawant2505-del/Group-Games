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

All six games ship their own dedicated server engine — **Impostor**, **Avoid the Word**, **Mafia**,
**Guess the Link**, **Top 100**, and **Reverse Categories**.

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
- **Two Impostor modes** — *Word* (the classic secret word) and *Question*: everyone privately receives the same question, one player was quietly asked a related but different one, and the difference only surfaces on the answer board.
- **Content engine (`server/content/`)** — a reusable provider layer. Words are served from a 2,059-noun corpus through a per-room shuffle bag, so nothing repeats until a room has seen the whole pool; an optional AI top-up is validated locally (commonness, shape, blocklist, room history) before it can ever be used.
- **Host difficulty setting** — Easy / Medium / Any filter the Impostor word pool, plus an optional custom theme and an AI top-up once a real `GEMINI_API_KEY` is configured. Without a key everything silently falls back to the bundled pool.
- **40 taboo cards** — original subjects with 3 forbidden trap words each for Avoid the Word.
- **Live describing turns** — Avoid the Word runs one describer at a time with buzz confirmation.
- **Dedicated Mafia engine** — privately dealt roles, timed night actions, day eliminations, win-condition checks, and scoring.
- **Dedicated Guess the Link engine** — one hidden concept, a different private hint angle per player, a shuffled link board, and simultaneous concept guessing with per-correct points.
- **Dedicated Top 100 engine** — one 1-to-100 spectrum, a unique secret number per player, private example writing, a host-authoritative drag-and-drop ranking phase broadcast live to everyone, and adjacent-pair accuracy scoring.
- **Dedicated Reverse Categories engine** — three deliberately unrelated items shown publicly (no secrets at all), privately invented category names, a shuffled attributed board, and the standard secret ballot repurposed to crown the best category.
- **Extensible phase machine** — lobby, game-select, reveal, input, reveal-answers, guess, rank, discussion, vote, atw-describe, night, day, results, next-round.

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

Party Games features a collection of six multiplayer party games designed for phone controllers. All six are 100% operational with dedicated server game engines.

| Game | Players | Category | Icon | Current Working State |
|---|---|---|---|---|
| **Impostor** | 3–12 | Social Deduction | Mask | 🟢 **Fully Working & Playable** — Dedicated engine with two modes (secret word / different question), clue and answer sanitizers, bot AI, host difficulty + tone settings, and scoring |
| **Avoid the Word** | 3–10 | Taboo / Communication | Ban | 🟢 **Fully Working & Playable** — Dedicated taboo engine with live 45s describing turns, buzz confirmation, bot simulation, and scoring |
| **Mafia** | 4–16 | Social Deduction | Detective | 🟢 **Fully Working & Playable** — Dedicated engine with private role deal, timed night actions, day eliminations, and win-condition scoring |
| **Guess the Link** | 3–8 | Word Association | Link | 🟢 **Fully Working & Playable** — Dedicated engine with one hidden concept, per-player private hint angles, shuffled board, simultaneous guessing, and scoring |
| **Top 100** | 3–10 | Ranking / Spectrum | List-Ordered | 🟢 **Fully Working & Playable** — Dedicated engine with a unique secret number per player, private example writing, a host-authoritative drag-to-rank phase broadcast live, and adjacent-pair accuracy scoring |
| **Reverse Categories** | 3–8 | Trivia / Creative | Shuffle | 🟢 **Fully Working & Playable** — Dedicated engine with unrelated-item triplets, public items (no secrets), privately invented categories, a shuffled attributed board, and a best-category ballot with author and voter scoring |

---

### 1. Impostor — Flagship Game (🟢 Fully Operational)

**Impostor** is the flagship game in Party Games, featuring a fully custom server engine (`server/games/impostor.ts`), simulated bot players, and automated scoring.

- **Objective**:
  - **Crew Members**: Identify and vote out the secret Impostor based on suspicious or diverging clues.
  - **The Impostor**: Blend in by submitting a convincing clue despite not knowing the secret word, avoid detection, and frame innocent crewmates.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 12 players (solo testing supported via "+ Add Bot").
  2. **Host Settings (`game-select` phase)**:
     - The host picks a **difficulty** for the next round — *Easy* (everyday words), *Medium* (less common words) or *Any* (the whole pool) — and, when the server has a working AI provider, an optional **custom theme**. Settings are public, never secret, and non-hosts see them read-only.
  3. **Role Assignment (`reveal` phase, 10s)**:
     - The server asks the content engine (`server/content/wordProvider.ts`) for the round's word, drawn from a 2,059-noun corpus (`shared/data/words/commonNouns.json`) through a **per-room shuffle bag**: a word cannot repeat until that room has seen the whole pool, and a reshuffle never starts with any of the last 10 words served.
     - Exactly 1 player is secretly designated as **The Impostor**; all others become **Crew Members**.
     - **Crew View**: Sees the secret word (e.g. *"Submarine"*) and category hint (*"Maritime & Vessels"*).
     - **Impostor View**: Sees only the category hint with the secret instruction: *"You're the impostor! You do NOT know the secret word. Blend in!"*
  4. **Clue Submission (`input` phase, 20s)**:
     - Every player privately types a **single-word clue** that demonstrates knowledge of the word without giving it away to the Impostor.
     - Server sanitizes input to ensure single-word compliance.
     - Test bots automatically generate plausible contextual clues (from curated association pools) or convincing bluffs.
  5. **Simultaneous Reveal (`reveal-answers` phase, 15s)**:
     - All clues are revealed simultaneously.
     - Display order is randomized using the Fisher-Yates algorithm to eliminate join-order or alphabetical bias.
     - Any player who failed to submit in time is automatically marked with `"(No answer)"`.
  6. **Discussion (`discussion` phase, 90s)**:
     - Timed group debate where players interrogate word choices, spot inconsistencies, and defend their clues. The host can skip the timer at any time.
  7. **Secret Voting (`vote` phase, 25s)**:
     - Players secretly tap a suspect's card to cast an accusation vote. Bots cast simulated votes.
  8. **Results & Scoring (`results` phase)**:
     - **Win Condition**: The Impostor is caught **if and only if** they are the sole candidate receiving the highest vote count.
     - **Scoring**:
       - **+1 point** awarded to each player who correctly voted for the Impostor.
       - **+1 point** awarded to the Impostor if they successfully evaded detection (majority voted incorrectly or a tie occurred).
     - **Post-Round Standings**:
       - Displays the unmasked Impostor and the secret word.
       - Full vote breakdown showing who voted for whom.
       - Dynamic "why" narrative explaining how the Impostor bluffed or why their clue gave them away.
       - Real-time leaderboard with running cumulative scores.
  9. **Next Round Loop (`next-round`)**:
     - Host advances to the next round with a new secret word and freshly randomized Impostor, preserving cumulative scores. The word comes straight out of the same room bag, so back-to-back rounds cannot repeat it.

---

### 1b. Impostor — Question Mode (🟢 Fully Operational)

Pick **Question** in the host settings and the same engine plays a different game: everyone gets a question, and one player's question is a related different one.

- **Reveal (10s)**: each player privately sees **only their own question** — the screen never hints that another version exists, and nobody is told they are the impostor.
- **Answer (30s)**: the answer UI follows the question's type — *tap a player*, *a short answer* (max 5 words / 40 characters), *a number* inside the question's range, or *one of the shared options*. Any player may be named, including yourself.
- **Answer board (15s)**: every answer in Fisher-Yates order. Player answers render as that player's chip, late answers as `(No answer)`, and **neither question appears** — that is the puzzle.
- **Discussion / vote**: unchanged flow. Each player can re-open **their own** question in a collapsible card on their own screen.
- **Results**: both questions are revealed side by side, with a one-line "why it showed" note and the same scoring as word mode (+1 per correct voter, +1 for an impostor who evades).
- **Content**: 160 hand-reviewed question pairs across six kinds (`shared/data/questions/impostorQuestions.json`), 34 of which ask about another player (`{target}`, always chosen from the crew — the target sees a "you" phrasing, everybody else sees their name). The AI top-up validates each pair before use (kind/answer-type agreement, shared choices and ranges, 10-120 characters, not a reworded copy, `{target}` on both sides or neither, tone match, blocklist).

---

### 2. Avoid the Word — Dedicated Taboo Engine (🟢 Fully Operational)

**Avoid the Word** ships a fully custom server engine (`server/games/avoidTheWord.ts`) with its own phase chain (`reveal → atw-describe → results`), live turn rotation, buzz verification, simulated bots, and scoring. Taboo cards come from 40 original subjects (`shared/data/avoidTheWordPrompts.ts`), each with exactly 3 forbidden words.

- **Objective**: Describe your secret subject out loud without saying any of your 3 trap words while the rest of the room listens for a slip.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 10 players (solo testing supported via "+ Add Bot").
  2. **Taboo Card Reveal (`reveal` phase, 10s)**:
     - Every player privately receives a **unique subject** plus **exactly 3 forbidden trap words** (e.g. *"Submarine"* → `water`, `navy`, `underwater`).
     - Only the card owner sees their subject and traps; nobody else's screen reveals them.
  3. **Live Describing Turns (`atw-describe` phase, 45s per turn)**:
     - Describers rotate **one at a time**; every player describes once per round and the starting describer rotates each round.
     - **Describer View**: subject + trap words + countdown, a live "buzzes against you" meter, and a *Done Describing* button to hand over early.
     - **Listener View**: the subject stays hidden, replaced by a **BUZZ** button, the group buzz meter, and the describer's name.
  4. **Buzz Verification**:
     - Tapping **BUZZ** flags a suspected taboo slip (tap again to withdraw it).
     - A **strict majority** of listeners auto-confirms and ends the turn immediately as a miss.
     - **Host override**: the host can confirm a pending buzz early or dismiss every buzz and let the describer keep going.
  5. **Scoring (`results` phase)**:
     - **+1 point** for a describe that survives its full 45s timer.
     - **+1 point** for every player on a buzz the group confirms; a buzzed-out describer scores nothing.
     - **Per-Turn Breakdown**: each turn lists the describer, subject, trap words, clean/buzzed verdict, buzz count, and who buzzed.
  6. **Bot Simulation**: bot describers resolve their own turn after a short beat, and bot listeners may buzz a human turn partway through — so a solo host can play a full round.
  7. **Next Round Loop (`next-round`)**: fresh subjects and trap words for everyone, with cumulative scores preserved.

---

### 3. Mafia — Dedicated Night/Day Engine (🟢 Fully Operational)

**Mafia** ships a fully custom server engine (`server/games/mafia.ts`) with its own phase chain (`reveal → night → day → discussion → vote → results`), server-side role dealing, private night actions, win-condition checks after every elimination, and scoring.

- **Objective**: The hidden Mafia thin the town out each night; the town must identify and exile them by day before the numbers run out.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 4 to 16 players (solo testing supported via "+ Add Bot").
  2. **Role Assignment (`reveal` phase, 10s)**:
     - Roles are dealt as **roughly 1 Mafia per 4 players (minimum 1)** — 4–7 players get 1 Mafia, 8–11 get 2, 12–15 get 3, and so on.
     - One **Detective** is included when the table is large enough for the role to matter; every remaining player is a **Townsperson**.
     - Each player privately sees **only their own** role on a themed card (Mafia / Detective / Townsperson). Roles are never part of the public state.
  3. **Night (`night` phase, 30s)**:
     - **Mafia** privately pick a player to eliminate; the last standing pick wins, and Mafia cannot target their own members.
     - The **Detective** privately investigates one player and is told whether that player is Mafia. Investigators see an *investigate* list, Mafia see an *eliminate* list.
     - **Townspeople** (and eliminated players) get a simple **"The Town Sleeps…"** waiting screen with a headcount of night actions still in play.
     - The host can end the night early, and bots resolve their own night actions so a solo host can play.
  4. **Day (`day` phase, 10s)**:
     - Everyone learns **who** was eliminated overnight — never who did it.
     - The existing **discussion** and **vote** phases then run unchanged to exile a suspect, and the exiled player is out of the game.
  5. **Win Conditions**: checked after every elimination or exile —
     - **Mafia wins** when living Mafia ≥ living townspeople.
     - **Town wins** when every Mafia member is eliminated.
     - Otherwise the game loops back to `night` with the survivors.
  6. **Results (`results` phase)**:
     - **Final role reveal** for every player, the winning side, the night-by-night game log, and the standings.
     - **+1 point** per surviving Town/Detective on a Town win; **+1 point** per surviving Mafia on a Mafia win. Eliminated players score nothing.
  7. **Next Round Loop (`next-round`)**: a fresh role deal for a brand new game, with cumulative scores preserved.

---

### 4. Guess the Link — Dedicated Link Engine (🟢 Fully Operational)

**Guess the Link** ships a fully custom server engine (`server/games/guessTheLink.ts`) with its own phase chain (`reveal → input → reveal-answers → guess → results`), server-side concept hiding, private per-player hint dealing, a shuffled response board, and simultaneous concept guessing. Concepts and their hint angles live in 44 original entries (`shared/data/guessTheLinkPrompts.ts`).

- **Objective**: Every player holds a different angle on the same hidden concept. Write a response from your angle, read everyone else's, then name the concept.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 8 players (solo testing supported via "+ Add Bot").
  2. **Hint Reveal (`reveal` phase, 10s)**:
     - The server picks one hidden concept and deals every player a **different hint angle** (six distinct angles per concept; larger rooms reuse them).
     - Each player sees **only their own angle**, plus the concept's broad category, its word count, and which angle number they hold. The concept itself never leaves the server.
  3. **Response Submission (`input` phase, 30s)**:
     - Each player privately writes **one word or a short phrase** inspired by their own angle. The server sanitizes it to a maximum of **3 words / 24 characters** and holds it privately.
     - Responses are only ever exposed on the link board — never alongside their author's angle during guessing.
  4. **The Link Board (`reveal-answers` phase, 15s)**:
     - Every response is shown together in **Fisher-Yates shuffled order** (never join order), with each player's own angle kept in view.
  5. **Simultaneous Guessing (`guess` phase, 30s)**:
     - Everyone privately locks in a guess at the hidden concept at the same time, exactly like a secret ballot; the room can see **who** has locked in but never **what** they guessed.
     - The phase closes as soon as every player has locked in, or when the timer expires. The host can reveal early.
  6. **Results (`results` phase)**:
     - The hidden concept is revealed along with every angle that was dealt and everyone's guess.
     - **+1 point** for each player who names the concept correctly (exact answers, plural-insensitive spellings, shipped aliases, and answers that clearly contain the concept all count).
     - A heuristic **"biggest giveaway"** callout names the response that pointed hardest at the concept; it is omitted when nothing resembles it.
  7. **Next Round Loop (`next-round`)**: a fresh concept with new angles, avoiding concepts already played in the room, with cumulative scores preserved.

---

### 5. Top 100 — Dedicated Spectrum Ranking Engine (🟢 Fully Operational)

**Top 100** ships a fully custom server engine (`server/games/top100.ts`) with its own phase chain (`reveal → input → reveal-answers → rank → results`), server-side spectrum picking, unique secret-number dealing, private example collection, a shuffled example board, and host-authoritative ordering validation. Spectra live in 22 original entries (`shared/data/top100Prompts.ts`).

- **Objective**: Every player secretly owns a different number on the same 1-to-100 spectrum. Write an example that fits your number, then get the whole set of examples into the right order.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 10 players (solo testing supported via "+ Add Bot").
  2. **Number Reveal (`reveal` phase, 10s)**:
     - The server picks one spectrum (e.g. *"1 = spotless, 100 = certified biohazard"*) and deals every player a **unique** secret number from 1 to 100. Numbers are never repeated within a round.
     - Each player sees **only their own number** plotted on the spectrum, plus the category. Numbers never reach the public state before results.
  3. **Example Submission (`input` phase, 45s)**:
     - Each player privately writes **one short example/scenario** they believe sits at their own number, sanitized to a maximum of **9 words / 72 characters**.
  4. **The Example Board (`reveal-answers` phase, 20s)**:
     - Every example appears together in **Fisher-Yates shuffled order** (never join order) with the secret numbers still hidden — the table has to infer the order from the examples themselves.
  5. **Ranking (`rank` phase, 120s)**:
     - **Host-authoritative v1**: the host drags the example cards into ascending numeric order (pointer drag on the grip, with arrow-button nudges). The order broadcasts live, and everyone else watches it update read-only.
     - The server only accepts a **complete permutation** of the round's examples, so one bad payload cannot drop or duplicate a card. The phase closes when the host locks the order in or the timer expires.
  6. **Results (`results` phase)**:
     - Every true number is revealed next to its example, along with its position in the real ascending order and the host's slot for it.
     - Accuracy is measured in **correctly-placed adjacent pairs**: each neighbouring pair placed in the right relative order scores **+2**, and a flawless order adds a **+3** bonus. The ordering is collaborative, so the table shares the score.
  7. **Next Round Loop (`next-round`)**: a fresh spectrum with new unique numbers, avoiding spectra already played in the room, with cumulative scores preserved.

---

### 6. Reverse Categories — Dedicated Item-Link Engine (🟢 Fully Operational)

**Reverse Categories** ships a fully custom server engine (`server/games/reverseCategories.ts`) with its own phase chain (`reveal → input → reveal-answers → vote → results`), server-side triplet picking, private category collection, and a shuffled attributed board. Items live in a 66-entry pool across 22 distinct themes (`shared/data/reverseCategoriesItems.ts`).

- **Objective**: Three deliberately unrelated items are on the table. Invent the category that links them best, then vote for the cleverest invention.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 8 players (solo testing supported via "+ Add Bot").
  2. **Item Reveal (`reveal` phase, 10s)**:
     - The server draws **three items that never share a theme** (e.g. *"flamingo", "spreadsheet", "thunderstorm"*) and shows them to **everyone at once**.
     - This game hides nothing: there is no secret role, no hidden word, and no private reveal — the whole table looks at the same board.
  3. **Category Submission (`input` phase, 45s)**:
     - Each player privately invents one category name linking all three items, sanitized to a maximum of **6 words / 48 characters**.
     - Bots are given distinct generic category names so a solo host can walk a full round.
  4. **The Category Board (`reveal-answers` phase, 20s)**:
     - Every invented category is shown together in **Fisher-Yates shuffled order**, attributed to its author (a friend group wants to know who wrote the winner).
  5. **Voting (`vote` phase, 25s)**:
     - The standard secret ballot is reused unchanged: a vote targets the **author** of the category you liked best, exactly as the impostor round votes for a suspect. `castVote` already forbids self-votes, so nobody can crown their own category.
     - Bots vote randomly so a solo host still gets a tally.
  6. **Results (`results` phase)**:
     - The tally is revealed with the winning category (ties included) spotlighted.
     - **+2** to each winning category's author, and **+1** to every voter who backed a winning category.
  7. **Next Round Loop (`next-round`)**: a fresh unrelated triplet, avoiding items this room has already seen, with cumulative scores preserved.

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

### 3. Content Engine (`server/content/`)

One provider layer feeds every word-based game, and later the taboo/link/spectrum decks too.

| Module | Responsibility |
|---|---|
| `types.ts` | `ContentProvider<T>` contract (`next(roomId, opts)`, `release(roomId)`), the shared difficulty setting, and the theme/word sanitizers |
| `contentBag.ts` | Per-room shuffle bag: a room's shuffled queue + served set, so nothing repeats until the pool is exhausted. A reshuffle (and a mid-session difficulty switch) can never serve any of the 10 most recent items first, and never re-serves a word while unused words remain |
| `aiClient.ts` | Server-side Gemini wrapper: 8s timeout, one retry, strict JSON output, 20 generation calls per room per hour, and an "unavailable" report that fires **once** — no key, placeholder key or failures all fall back to bundled content silently |
| `wordProvider.ts` | The word provider: bundled corpus via the bag, background AI top-up when the bag drops below 15 items or a theme is set, and local validation of every AI word |
| `index.ts` | Barrel: `releaseRoomContent(roomId)` drops every per-room bag, history and rate-limit counter |

**AI top-up rules.** The AI is only ever asked in the background — a round never waits on the network. Every returned word must be `^[a-z]{3,12}$`, absent from the shipped corpus and the room's history, present in the commonness data, and absent from `data/blocklist.txt`, or it is dropped. Host themes are trimmed to 40 characters, stripped of control characters, and passed to the model as data with an explicit "never an instruction" system rule. The provider also **prefetches** at the start of the discussion phase so the next round's word is already in the bag.

**Difficulty.** `difficulty: 1|2|3` on every corpus entry maps to the host's Easy (tier 1), Medium (tiers 2-3) and Any (everything) settings. Switching difficulty mid-session rebuilds the pool but keeps the room history, so no word is replayed.

**Room cleanup.** Rooms are released when they reset to the lobby and when the idle sweeper drops them (no connected player for two hours); `release(roomId)` clears the bag, the served history and the AI counters.

### 4. Game Phase State Machine

1. **`lobby`** — players join via room code/QR; host configures bots and launches.
2. **`game-select`** — host chooses a party game.
3. **`reveal`** — private assignment (impostor role, taboo cards, Mafia roles, a Guess the Link hint angle, or a Top 100 secret number), or the public three items (Reverse Categories). The Impostor word is served asynchronously by the content engine, so this phase finishes in its own method rather than blocking the state machine.
4. **`input`** — players submit clues (Impostor), responses (Guess the Link), examples (Top 100), or invented categories (Reverse Categories).
5. **`reveal-answers`** — clues revealed simultaneously (Impostor), the shuffled link board (Guess the Link), the shuffled example board with its numbers still hidden (Top 100), or the shuffled attributed category board (Reverse Categories).
6. **`guess`** — simultaneous guessing at the hidden concept (Guess the Link).
7. **`rank`** — the host drags the Top 100 examples into ascending numeric order while everyone else watches live.
8. **`discussion`** — timed debate (Impostor; Mafia day phase).
9. **`vote`** — secret ballot (Impostor; Mafia exile vote; Reverse Categories' best-category vote).
10. **`atw-describe`** — Avoid the Word's live describing turns.
11. **`night`** — Mafia and Detective act privately (Mafia).
12. **`day`** — overnight elimination announced, then discussion and vote (Mafia).
13. **`results`** — tally reveal, role exposure, winner, next-round option.
14. **`next-round`** — new round with a fresh secret assignment.

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
│       ├── components/        # UI components (QR modal, header, player badges, game settings panel)
│       ├── screens/           # Phase screens (incl. Atw*, Mafia*, Gtl*, Top100*, RevCat*, and the Impostor question-mode screens)
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
│   ├── content/               # Content engine: bags, AI client, providers
│   │   ├── types.ts           # ContentProvider<T>, difficulty setting, sanitizers
│   │   ├── contentBag.ts      # Per-room shuffle bag with the recent-item reshuffle guard
│   │   ├── aiClient.ts        # Gemini wrapper: timeout, retry, JSON, per-room rate limit
│   │   ├── wordProvider.ts    # Words: corpus bag + validated background AI top-up
│   │   ├── questionProvider.ts # Question pairs: tone-filtered bag + validateQuestionPair
│   │   └── index.ts           # releaseRoomContent(roomId) + provider exports
│   ├── games/
│   │   ├── impostor.ts        # Impostor word mode: clue sanitizer, bots, reveal, scoring
│   │   ├── impostorQuestionMode.ts # Impostor question mode: dealing, 4 answer types, board, results
│   │   ├── avoidTheWord.ts    # Taboo engine: turns, buzz verification, scoring, bot logic
│   │   ├── mafia.ts           # Mafia engine: roles, night actions, win conditions, scoring
│   │   ├── guessTheLink.ts    # Link engine: concept hiding, hint dealing, guessing, scoring
│   │   ├── top100.ts          # Spectrum engine: secret numbers, ordering, pair accuracy
│   │   └── reverseCategories.ts # Item-triplet engine: categories, attribution, best-category ballot
│   ├── roomManager.ts         # In-memory room manager, sessions, & state masks
│   └── index.ts               # Server entry point with Vite middleware / static serving
├── shared/                    # Code imported by BOTH client and server (@shared/*)
│   ├── data/
│   │   ├── games.ts           # Game catalog definitions
│   │   ├── words/
│   │   │   └── commonNouns.json    # 2,059-noun corpus, generated (27 categories, tiers 1-3)
│   │   ├── avoidTheWordPrompts.ts  # 40 subjects × 3 forbidden trap words
│   │   ├── guessTheLinkPrompts.ts  # 44 concepts × 6 hint angles each
│   │   ├── top100Prompts.ts        # 22 spectra with sample examples
│   │   ├── questions/
│   │   │   └── impostorQuestions.json # 160 question pairs (6 kinds, 34 with {target})
│   │   └── reverseCategoriesItems.ts # 66 items across 22 themes
│   ├── theme/
│   │   └── tokens.ts          # Player color tokens & palette
│   └── types.ts               # Shared TypeScript models and interfaces
├── scripts/                   # Development-time tooling (not bundled into the app)
│   ├── commonNouns.source.txt # Authored vocabulary source for the corpus
│   ├── generateCommonNouns.ts # Regenerates commonNouns.json + lints it
│   ├── testContentEngine.ts   # `npm run test:content`
│   └── testImpostorQuestionMode.ts # `npm run test:questions`
├── data/
│   ├── common-words-frequency.txt # 10k most common English words (MIT, FrequencyWords)
│   └── blocklist.txt          # Moderation list applied to AI-generated content
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

# Content-engine suite: 500 rounds in one room, pool exhaustion, the reshuffle guard, AI validation
npm run test:content

# Impostor question-mode suite: all four answer types, {target} dealing, leak checks, scoring
npm run test:questions

# Regenerate shared/data/words/commonNouns.json from scripts/commonNouns.source.txt
npm run generate:words

# Build client SPA (vite build) and bundle server (esbuild server/index.ts -> dist/server.cjs)
npm run build

# Run the compiled production build (node dist/server.cjs)
npm run start

# Preview Vite production build locally
npm run preview

# Cgit lean build artifacts (dist/ directory)
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
| `GEMINI_API_KEY` | Gemini API key for the content engine's AI top-ups and custom themes | — | No |
| `GEMINI_MODEL` | Model used for AI content generation | `gemini-2.5-flash` | No |
| `CONTENT_AI_DISABLED` | Force the content engine to bundled content only | `false` | No |
| `APP_URL` | Public app URL for self-referential links and QR codes | — | No |

> **Note:** The repository currently contains placeholder values in `.env`
> (`GEMINI_API_KEY="MY_GEMINI_API_KEY"`, `APP_URL="MY_APP_URL"`). Treat these as examples —
> replace them with real values before deploying to production. A placeholder (or missing) key is
> detected at boot: the server logs one line and every game keeps running on the bundled content,
> with the custom-theme field hidden in the host UI.

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
