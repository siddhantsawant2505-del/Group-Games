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

Copy `.env.example` to `.env` to configure local environment variables. `.env` is ignored by Git;
keep real credentials in `.env` or your deployment environment, never in `.env.example`.

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
- **Room settings gear (lobby)** — one gear next to the player list opens the room-wide settings: **Solo / Team** play mode, team count (2-4), tap-to-join teams, team rename, auto-balance and shuffle, and the number of rounds per session.
- **Per-game settings gear (game select)** — every game card carries its own gear, so each game is tuned separately: Impostor mode/difficulty/tone/theme, Guess the Link's custom round, and a read-only summary for everyone else.
- **Team mode** — individual scores are kept and every award also rolls up to the player's team through one central `awardPoints()`; team totals survive team switches and reconnects, the lobby blocks a bad split (and warns about lopsided ones), and results/post-game lead with the team leaderboard.
- **Five live games, one on the way** — Impostor, Avoid the Word, Mafia, Top 100 and Reverse Categories are playable today; Guess the Link is listed as **Coming Soon** and cannot be launched yet.
- **Two Impostor modes** — *Word* (the classic secret word) and *Question*: everyone privately receives the same question, one player was quietly asked a related but different one, and the difference only surfaces on the answer board.
- **Content engine (`server/content/`)** — a reusable provider layer. Words are served from a 2,059-noun corpus through a per-room shuffle bag, so nothing repeats until a room has seen the whole pool; an optional AI top-up is validated locally (commonness, shape, blocklist, room history) before it can ever be used.
- **Host difficulty setting** — Easy / Medium / Any filter the Impostor word pool, plus an optional custom theme and an AI top-up once a real `GEMINI_API_KEY` is configured. Without a key everything silently falls back to the bundled pool.
- **123-question Avoid the Word deck** — four answer types (open text, 8+ options, numeric ranges, "who here" player picks) in `shared/data/questions/avoidTheWordQuestions.json`, validated by the provider before use.
- **Hidden-answer elimination rounds** — one anchor answers a question privately, everyone else answers it one at a time, and any answer that matches the anchor is announced live (never the answer itself) and knocked out on the host's Continue.
- **Dedicated Mafia engine** — server-dealt Mafia / Detective / Doctor / Townsperson roles, a hold-to-reveal role card, one identical-timer night screen for every role (including a harmless decoy for townspeople), live Mafia teammate picks, doctor protection with a no-repeat rule, private detective findings, day discussion with a ready-to-vote majority, hidden exile ballots with tie/skip rules, narrated mornings, a full recap, and win-condition checks after every death.
- **Dedicated Guess the Link engine** — one hidden concept, a different private hint angle per player, a shuffled link board, and simultaneous concept guessing with per-correct points.
- **Dedicated Top 100 engine** — a hidden 100-item ranked list per round, one free-text guess per player (or per team captain), position-exact scoring (a match at position N is worth N), host overrules, duplicate policies, region/category filters, and only positions 1-10 and 90-100 ever revealed.
- **Dedicated Reverse Categories engine** — three deliberately unrelated items shown publicly (no secrets at all), privately invented category names, a shuffled attributed board, and the standard secret ballot repurposed to crown the best category.
- **Extensible phase machine** — lobby, game-select, reveal, input, reveal-answers, guess, rank, avoid-anchor, avoid-turn, avoid-reveal, discussion, vote, night, mafia-morning, mafia-exile, results, next-round.

---

## Deployed / continuous integration checks

| Metric | Status | Details |
|---|---|---|
| TypeScript / TypeCheck | `PASSING` | `npm run lint` exits with 0 errors |
| Content engine suite | `PASSING` | `npm run test:content` — 500 rounds, no repeats before pool exhaustion |
| Question-mode suite | `PASSING` | `npm run test:questions` — four answer types, `{target}` dealing, leak checks |
| Avoid the Word suite | `PASSING` | `npm run test:avoid` — matching rules, question bank and answer-space rules, shuffle bag, a full bot game, leak/overrule/AFK/reconnect/placement checks |
| Mafia suite | `PASSING` | `npm run test:mafia` — role counts for 4–16, night resolution (kill/save/no-repeat/tie/abstain), vote tally rules, win ordering, 250 bot-only games, a 6-player room game with public/private leak checks and recap |
| Top 100 suite | `PASSING` | `npm run validate:top100` + `npm run test:top100` — list validation, normalisation/typo matching, position scoring, duplicate policy, host overrules, the shuffle bag, a 5-round bot game and a team game with captain rotation and private suggestions |
| Team-mode suite | `PASSING` | `npm run test:teams` — play modes, team seating, start gate, team scoring |
| Vite Client Build | `PASSING` | React 19 SPA bundled to `dist/` with Tailwind CSS v4 |
| Server Build | `PASSING` | Bundled into standalone CommonJS executable `dist/server.cjs` via esbuild |
| Dev Runtime | `OPERATIONAL` | Express + Socket.IO + Vite middleware on `0.0.0.0:3000` |
| Production Runtime | `OPERATIONAL` | Serves compiled SPA + Socket.IO server |
| Port & Networking | `PORT 3000` | Binds to `0.0.0.0:3000` |

---

## Games collection, rules & working state

Party Games features a collection of six multiplayer party games designed for phone controllers. **Impostor, Avoid the Word, Mafia, Top 100 and Reverse Categories are shipped**; only Guess the Link is still listed as **Coming Soon** — its card stays visible but cannot be selected or launched until its engine is re-verified.

| Game | Players | Category | Icon | Current Working State |
|---|---|---|---|---|
| **Impostor** | 3–12 | Social Deduction | Mask | 🟢 **Fully Working & Playable** — Word and Question modes, private clues, secret voting, content engine with an AI top-up, host difficulty/tone/theme settings |
| **Avoid the Word** | 3–10 | Bluff / Elimination | Ban | 🟢 **Fully Working & Playable** — rotating anchor, one hidden answer, live match knockouts, host overrules, 123-question deck, native team rules |
| **Mafia** | 4–16 | Social Deduction | Detective | 🟢 **Fully Working & Playable** — Dedicated engine with hold-to-reveal roles, identical-timer night actions (Mafia/Doctor/Detective/decoy), narrator mornings, discussion + secret exile ballots, a full recap, and faction scoring |
| **Guess the Link** | 3–8 | Word Association | Link | 🟡 **Coming Soon** — engine exists; not selectable in the app yet |
| **Top 100** | 3–10 | Ranking / List Knowledge | List-Ordered | 🟢 **Fully Working & Playable** — Dedicated engine with a hidden 100-item list per round, one guess per player (or team), position-exact scoring, host overrules, duplicate/region/category settings, and only the 1-10 / 90-100 slices revealed |
| **Reverse Categories** | 3–8 | Trivia / Creative | Shuffle | 🟢 **Fully Working & Playable** — server-picked triplets, privately invented categories, shuffled board, secret ballot for the best invention |

**Availability.** `PARTY_GAMES` marks the one unshipped game (`guess-the-link`) with `comingSoon: true`; the
game-selection screen shows it dimmed with a **Coming Soon** badge, hides its settings gear, and refuses to
select or launch it. `PLAYABLE_GAMES` / `DEFAULT_GAME` in `shared/data/games.ts` are the single source of
truth, and the server falls back to `DEFAULT_GAME` when a room still points at a Coming Soon game.

**Room modes.** Every room runs in **solo** (default) or **team** mode, chosen by the host from the
lobby's settings gear. In team mode individual scores are kept and each award also counts for the
player's team; results and the post-game screen lead with the team leaderboard. Impostor and Mafia
are **aggregate** today (their points simply roll up — badged "Teams: scores combine"); Avoid the
Word, Guess the Link and Reverse Categories are **Team-ready** — they play as in solo for now and
gain native team rules next (see `docs/GAME_rules.md` → "Adding a game"). Avoid the Word
already ends by team in team mode: a team survives while it has an alive member, and the last team
standing takes the win. **Top 100 is native**: each team locks exactly one guess through its
rotating captain, and the team is scored through `awardTeamPoints()`, leaving individual totals alone.

**Per-game settings.** Each game-select card has its own gear: Impostor (mode, difficulty, tone,
custom theme), Avoid the Word (anchor answer time, turn time, round cap, question tone), Mafia
(mafia count, night / discussion / vote timers, Detective, Doctor, reveal-role-on-death), Guess the
Link (a host-authored round), Top 100 (rounds, guess time, duplicate policy, region and category
filters), and a read-only summary of the current choices for everyone else. The lobby gear covers
the room-wide settings instead: play mode, teams and rounds per session.

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

### 2. Avoid the Word — Dedicated Elimination Engine (🟢 Fully Operational)

**Avoid the Word** ships a fully custom server engine (`server/games/avoidTheWord.ts`) with its own phase chain (`reveal → avoid-anchor → avoid-turn (repeats) → avoid-reveal → results`), a rotating anchor, one hidden answer, live match announcements, a host-overruled round reveal, eliminated spectators, simulated bots, and placement scoring. Questions come from a 123-question bank (`shared/data/questions/avoidTheWordQuestions.json`) served through a per-room shuffle bag, and the answer comparison lives in its own unit-tested module (`server/games/avoidTheWord.match.ts`).

- **Objective**: The anchor privately answers a question; everyone else answers the same question on their own turn and is knocked out if their answer **matches the anchor**. Guess what the group would say, or be the last one standing.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 10 players (solo testing supported via "+ Add Bot").
  2. **Anchor Briefing (`reveal` phase, 10s)**: the server picks the round's anchor from a rotation bag over the alive players (nobody anchors twice until everyone alive has) and draws a question from the content engine. Only the anchor's private state carries the question; the public state shows who is holding it.
  3. **Anchor Answer (`avoid-anchor` phase, 30s default)**: the anchor answers privately in the shape the question asks for — a text field (max 3 words / 30 characters), a numeric range, option buttons, or a player grid. The answer stays server-side; the anchor can never be eliminated in their own round.
  4. **Turns (`avoid-turn` phase, one player at a time, 20s default)**: the same question goes to each remaining alive player in a fresh randomized order. The server compares each answer the moment it lands:
     - **match** → the player is marked *matched* and the room gets a live "<name> matched the anchor's answer!" banner that never includes the answer text;
     - **no match** → *safe*;
     - **timeout / disconnect** → auto-submitted as `(no answer)` and marked *skipped* (counts as safe), and **two consecutive skips eliminate the player as AFK**.
     - Players who already answered never see anyone else's answer during the round.
  5. **Round Reveal (`avoid-reveal` phase)**: the question, the anchor's answer and every answer become public with matches highlighted, plus the elimination list preview. Until the host taps **Continue** they can **overrule** any close call per player (*count as match* / *not a match*) to settle synonyms and typos, and the final list is what applies.
  6. **Eliminated players become spectators**: they keep the public state and the reveals, but never see a hidden answer early.
  7. **Scoring (`results` phase)**: the anchor scores **+1 for every player who matched** them, every game winner scores **+3**, and nothing else scores. Placements follow the elimination order (last one out places highest; players eliminated in the same round tie).
  8. **End conditions**: the game ends when one player is left, or when the round cap is reached (10 rounds by default — survivors share the win), or when everyone but the anchor matched (the anchor is the only survivor). In **team mode** a team survives while it has an alive member, so the game ends when one team remains or at the cap.
  9. **Host Settings (`game-select` phase)**: anchor answer time (10–60s), turn time (10–60s), round cap (3–20 rounds) and question tone (Clean / Spicy). All four are public strategy, clamped by the server, and read-only for non-hosts.
  10. **Bot Simulation**: bot anchors and bot turn players answer from the question's own `botAnswers` / options / range / alive players after a short beat, so a solo host plays a full game. Bots never call the AI.
  11. **Reconnect**: a reconnecting player gets the round's question back if their window is still open. A player who drops during their own window is treated as a timeout, so the round never stalls.
  12. **Next Round Loop**: `Continue` deals a new anchor and a new question with the remaining players.

---

### 3. Mafia — Dedicated Night/Day Engine (🟢 Fully Operational)

**Mafia** ships a fully custom server engine — `server/games/mafia.ts` (room/phases/timers/bots/narration) on top of pure rules in `server/games/mafia.engine.ts` — with its own phase chain (`reveal → night → mafia-morning → discussion → vote → mafia-exile → … → results`). One full game (many nights and days) is **one room round**; Next round deals a brand-new game. It is phone-only: nobody moderates, the server narrates.

- **Objective**: The hidden Mafia thin the town out each night; the town must identify and exile them by day before the numbers run out.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 4 to 16 players (solo testing supported via "+ Add Bot").
  2. **Role Assignment (`reveal` phase, 10s)**:
     - `mafiaCount = max(1, round(N / 4))` unless the host overrides it, always clamped to at most `floor((N - 1) / 2)` — so the Mafia are always strictly fewer than half the table.
     - One **Detective** when N ≥ 4 and the host setting is on (default on); one **Doctor** when N ≥ 6 and the setting is on (default on); everyone else is a **Townsperson**.
     - The role card is hidden behind a **press-and-hold to reveal** control, so a glance over the shoulder cannot leak it. Mafia also see their teammates' names on the same card. Roles never enter the public state.
  3. **Night (`night` phase, 30s)**:
     - Every living player gets the **same screen, grid and timer**, so nobody's role can be inferred from layout or timing.
     - **Mafia** pick a victim (never a teammate) and see each other's current picks live. The victim is the pick with the most Mafia votes; ties are broken at random; if no Mafia voted, nobody is attacked.
     - The **Doctor** protects one player, may protect themselves, and may not protect the same player on two consecutive nights.
     - The **Detective** investigates one player and privately learns *Mafia* / *Not Mafia* at dawn.
     - **Townspeople** (and any role with nothing to do) confirm a harmless decoy — *"Who do you trust the most?"* — which does nothing. The phase ends when every living player confirms, or at the timer, plus a short randomized beat after the last confirmation. Only the number of confirmed players is public.
  4. **Morning (`mafia-morning` phase, 8s)**:
     - The server resolves the night: the Mafia target dies unless the Doctor protected them. The narration announces the death by name (plus role when `revealRoleOnDeath` is on) or *"Nobody died tonight."* — never whether a save happened.
     - A surviving Detective receives their result privately now; a Detective who died overnight receives nothing. The win condition is checked immediately.
  5. **Day (`discussion`, 120s) and Exile (`vote`, 30s)**:
     - The living argue out loud; the public log of past nights and exiles stays visible, and a Detective can reopen their private notes.
     - The host can skip discussion, and it also ends early when more than half of the living players tap **ready to vote**.
     - Everyone secretly votes for a living player or **Skip**. The ballot stays hidden until the tally. The player with the most votes is exiled; a tie for first, or Skip being top or tied, exiles nobody.
     - `mafia-exile` (8s) shows the tally and the exile with their role when enabled, then checks the win condition and loops back to night.
  6. **Win Conditions**, checked after the morning resolution and after each exile:
     - **Town wins** when no Mafia remain alive.
     - **Mafia wins** when living Mafia ≥ living non-Mafia.
     - Otherwise the game continues.
  7. **Dead players become spectators** — public state only, no living roles or night actions, no actions of their own. A disconnected living player is treated as a skip/abstain.
  8. **Game over (`results` phase)**: the winning faction, every role revealed, a **recap timeline** (each night's Mafia target, Doctor save, investigation + result; each day's tally and exile), and the leaderboard.
  9. **Scoring**: every member of the winning faction scores **+3**, and every surviving winner scores **+1 extra**, all through `awardPoints()`.
  10. **Host Settings (`game-select` phase)**: mafia count (`auto` or a number), night / discussion / vote timers, Detective, Doctor and reveal-role-on-death. The panel shows the resulting role breakdown for the current table; Start is disabled with the exact reason when the deal is illegal.
  11. **Bots**: night actions are random within each role's rules (Mafia avoid teammates, the Doctor respects the no-repeat rule, the Detective favours unchecked players); day votes are random among living non-self players, Mafia never vote a teammate, and a Detective bot votes a known Mafia member. Bots never call the AI.
  12. **Narration**: `shared/data/mafiaNarration.ts` holds 10+ non-graphic variants for every beat (night falls, a death, a quiet morning, an exile, each faction win), drawn from a per-room shuffle bag so lines do not repeat back to back.
  13. **Next Round Loop (`next-round`)**: a fresh role deal for a brand-new game, with cumulative scores preserved.

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

### 5. Top 100 — Dedicated Hidden-List Engine (🟢 Fully Operational)

**Top 100** ships a fully custom server engine (`server/games/top100.ts`) on the shared phase chain (`reveal → input → reveal-answers → results`), with a hidden ranked list served by the content engine, a pure matcher/scorer of its own (`server/games/top100.match.ts`), host overrules and native team rules. The lists live in `shared/data/top100/*.json` (17 lists, 100 ranked items each, validated by `npm run validate:top100`).

- **Objective**: Name something that is on the round's hidden Top 100 list. The deeper it ranks, the more it is worth — miss the list and you score nothing.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 10 players in solo mode, or 2+ teams in team mode (solo testing supported via "+ Add Bot").
  2. **The Question (`reveal` phase, 8s)**:
     - The server draws one list through a per-room shuffle bag: nothing repeats until the room has seen every eligible list, consecutive rounds avoid the previous round's category whenever another one is available, and a mixed region setting alternates global and India lists when it can.
     - Only the question, its category and its as-of date are public. The 100 ranked items stay on the server for the whole game — no client ever receives the list, an autocomplete or a suggestion derived from it.
  3. **The Guess (`input` phase, 45s solo / 60s team)**:
     - Every player (solo), or every team captain (team), privately types **one** free-text guess. There is no autocomplete; submitting locks it.
     - The phase closes as soon as everyone who owes a guess has locked one. A missing guess is stored as `(no answer)` and scores 0.
     - **Team mode** adds a private channel: teammates send up to five suggestions each (30 characters each) that only their own team's sockets receive, and a captain who runs out of time falls back to the team's newest suggestion (or `(no answer)`).
  4. **The Guesses Board (`reveal-answers` phase, 90s)**:
     - Every guess appears with the item it matched, that item's position and the points it will score, marked when two or more guesses landed on the same item.
     - Points are not final yet: the host can **overrule** a guess onto any position, or mark it as not on the list, and the board updates before the host taps Continue.
  5. **Scoring**: a guess matching position N scores exactly **N points** (position 100 = 100, position 1 = 1); anything else scores 0. Matching is exact on normalised names and aliases (case, punctuation, accents, a leading `@` and leading articles are ignored), with **typo tolerance** of one edit for 5+ character guesses and two for 10+ character guesses — accepted only when exactly one item sits inside that distance, so an ambiguous guess scores nothing unless the host overrules it. The `duplicatePolicy` setting decides whether two players (or teams) on the same item both score (`allow`, default) or neither does (`zero`).
  6. **Results (`results` phase)**:
     - Points become final and are awarded through `awardPoints()` (solo) or `awardTeamPoints()` (team mode, which leaves individual scores untouched).
     - Positions **1-10** and **90-100** are revealed as two separated blocks; the 79 middle positions are never sent. A player whose own guess sits outside those slices still sees that guess with its rank.
     - The running leaderboard follows, with the team leaderboard first in team mode.
  7. **Next Round Loop (`next-round`)**: a fresh list, repeated until `roundCount` (default 5) is reached, then the final standings and the post-game screen.
  8. **Content maintenance**: every guess that matched nothing is counted in `data/unmatched-guesses.json` (list id + normalised text only, never a player identity) so aliases can be improved later.

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

One provider layer feeds every content-driven game: the Impostor word pool, the Impostor question pairs, and the Avoid the Word question bank.

| Module | Responsibility |
|---|---|
| `types.ts` | `ContentProvider<T>` contract (`next(roomId, opts)`, `release(roomId)`), the shared difficulty setting, and the theme/word sanitizers |
| `contentBag.ts` | Per-room shuffle bag: a room's shuffled queue + served set, so nothing repeats until the pool is exhausted. A reshuffle (and a mid-session difficulty switch) can never serve any of the 10 most recent items first, and never re-serves a word while unused words remain |
| `aiClient.ts` | Server-side Gemini wrapper: 12s timeout (Gemini's 10s minimum), one retry, strict JSON output, 20 generation calls per room per hour, and an "unavailable" report that fires **once** — no key, placeholder key or failures all fall back to bundled content silently |
| `wordProvider.ts` | The word provider: bundled corpus via the bag, background AI top-up when the bag drops below 15 items or a theme is set, and local validation of every AI word |
| `questionProvider.ts` | The Impostor question-pair provider: tone-filtered bag plus `validateQuestionPair` for both sides of a pair |
| `avoidQuestionProvider.ts` | The Avoid the Word provider: tone/table-size filtered bag over the 123-question bank, the answer-space rule (`options ≥ alive + 4`, numeric range ≥ 20, "who here" only at 5+ alive), and a validated background AI top-up of ~15 questions per batch |
| `index.ts` | Barrel: `releaseRoomContent(roomId)` drops every per-room bag, history and rate-limit counter |

**AI top-up rules.** The AI is only ever asked in the background — a round never waits on the network. Every returned word must be `^[a-z]{3,12}$`, absent from the shipped corpus and the room's history, present in the commonness data, and absent from `data/blocklist.txt`, or it is dropped. Host themes are trimmed to 40 characters, stripped of control characters, and passed to the model as data with an explicit "never an instruction" system rule. The provider also **prefetches** at the start of the discussion phase so the next round's word is already in the bag.

**Difficulty.** `difficulty: 1|2|3` on every corpus entry maps to the host's Easy (tier 1), Medium (tiers 2-3) and Any (everything) settings. Switching difficulty mid-session rebuilds the pool but keeps the room history, so no word is replayed.

**Room cleanup.** Rooms are released when they reset to the lobby and when the idle sweeper drops them (no connected player for two hours); `release(roomId)` clears the bag, the served history and the AI counters.

### 4. Room Modes & Team Mode (`server/scoring.ts`, `shared/data/teams.ts`)

- **Two settings surfaces.** Room-wide settings (play mode, teams, rounds) sit behind the gear in
  the lobby; per-game settings sit behind the gear on each game-select card. Both open the same
  bottom-sheet shell (`client/src/components/SettingsSheet.tsx`), and non-hosts see everything
  read-only.
- **Play mode.** `solo` (default, exactly the original behaviour) or `team`. In team mode a room
  holds 2-4 teams, each with an icon, name and accent (four team accents, distinct from the six
  player colours). `player.teamId` is authoritative and keyed by session token, so reconnecting
  restores membership; late joiners land on the smallest team.
- **Central scoring.** `awardPoints(room, playerId, points, reason?)` in `server/scoring.ts`
  (re-exported from `roomManager`) is the only place a score changes — individual total plus, in
  team mode, the team total. Every game module already routes through it, and future games must too
  (see `docs/GAME_rules.md` → "Adding a game").
- **Team leaderboards.** When any round resolves, the room manager attaches `results.teamStandings`
  (rank, icon, name, total, member contributions) and the results and post-game screens render it
  above the individual standings. Solo rounds keep exactly the old payload.
- **Team-only awards.** `awardTeamPoints(room, teamId, points, reason?)` scores a team without
  touching any member's individual total (kept as the team's `bonusPoints` so a derived recompute or
  a membership change can never erase it). **Top 100** uses it for its native team rules: one guess
  per team, rotating captains, team-private suggestions.
- **Native team rules** for Guess the Link, Reverse Categories and Mafia are planned and
  documented, not implemented; until they ship those games play as they do in solo and their points
  aggregate, which the game cards badge as "Team-ready". Avoid the Word already uses its own team
  end condition (a team survives while it has an alive member) on top of the central scoring roll-up.

### 5. Game Phase State Machine

1. **`lobby`** — players join via room code/QR; host configures bots and launches.
2. **`game-select`** — host chooses a party game.
3. **`reveal`** — private assignment (impostor role, the Avoid the Word anchor's question, Mafia roles, or a Guess the Link hint angle), or public round content (the Reverse Categories items; the Top 100 question, whose ranked list stays on the server). The Impostor word, the Avoid the Word question and the Top 100 list are served asynchronously by the content engine, so those rounds finish in their own methods rather than blocking the state machine.
4. **`input`** — players submit clues (Impostor), responses (Guess the Link), guesses (Top 100, plus team-private suggestions in team mode), or invented categories (Reverse Categories).
5. **`reveal-answers`** — clues revealed simultaneously (Impostor), the shuffled link board (Guess the Link), the guesses board with its host overrules (Top 100), or the shuffled attributed category board (Reverse Categories).
6. **`guess`** — simultaneous guessing at the hidden concept (Guess the Link).
7. **`discussion`** — timed debate (Impostor; Mafia day phase, with a host skip and a ready-to-vote majority).
8. **`vote`** — secret ballot (Impostor; Mafia exile vote; Reverse Categories' best-category vote).
9. **`avoid-anchor` → `avoid-turn` (repeats) → `avoid-reveal`** — Avoid the Word's private anchor answer, one timed turn per alive player, then the public round reveal with host overrules.
10. **`night`** — every living Mafia player acts privately on the same screen: Mafia pick a victim (and see teammates' live picks), the Doctor protects, the Detective investigates, everyone else confirms a harmless decoy.
11. **`mafia-morning`** — the server narrates the night (a death, or nobody died — never whether the Doctor saved someone), privately hands the Detective their result, then checks the win condition.
12. **`mafia-exile`** — the public vote tally and the exile outcome; the win condition is checked again before the loop returns to `night`.
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
│       ├── components/        # UI components (QR modal, header, player badges, settings sheets/panels, team leaderboard)
│       ├── screens/           # Phase screens (mafia/*, Gtl*, Top100*, RevCat*, avoidTheWord/*, and the Impostor question-mode screens)
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
│   │   ├── avoidQuestionProvider.ts # Avoid the Word questions: answer-space rules + validated AI top-up
│   │   └── index.ts           # releaseRoomContent(roomId) + provider exports
│   ├── games/
│   │   ├── impostor.ts        # Impostor word mode: clue sanitizer, bots, reveal, scoring
│   │   ├── impostorQuestionMode.ts # Impostor question mode: dealing, 4 answer types, board, results
│   │   ├── avoidTheWord.ts    # Avoid the Word engine: anchor rotation, turns, eliminations, overrule, placements
│   │   ├── avoidTheWord.match.ts # Pure answer matching: normalisation, stems, typos, per-type comparison
│   │   ├── mafia.ts           # Mafia room engine: phases, timers, private state, bots, narrator, scoring
│   │   ├── mafia.engine.ts    # Pure Mafia rules: role deal, night resolution, tally, win check, validation
│   │   ├── guessTheLink.ts    # Link engine: concept hiding, hint dealing, guessing, scoring
│   │   ├── top100.ts          # Top 100 engine: hidden list, guesses, overrules, slices, awards
│   │   ├── top100.match.ts    # Top 100 matcher/scorer: normalisation, typo windows, position points
│   │   ├── textNormalize.ts   # Shared text normalisation for Avoid the Word and Top 100
│   │   └── reverseCategories.ts # Item-triplet engine: categories, attribution, best-category ballot
│   ├── scoring.ts             # awardPoints(): the single scoring path (solo + team roll-up)
│   ├── roomManager.ts         # In-memory room manager, sessions, teams, play mode, & state masks
│   └── index.ts               # Server entry point with Vite middleware / static serving
├── shared/                    # Code imported by BOTH client and server (@shared/*)
│   ├── data/
│   │   ├── games.ts           # Game catalog definitions (incl. teamSupport per game)
│   │   ├── teams.ts           # Team templates, name sanitizing, and the team start gate
│   │   ├── words/
│   │   │   └── commonNouns.json    # 2,059-noun corpus, generated (27 categories, tiers 1-3)
│   │   ├── questions/
│   │   │   ├── impostorQuestions.json # 160 question pairs (6 kinds, 34 with {target})
│   │   │   └── avoidTheWordQuestions.json # 123 Avoid the Word questions (text/choice/number/player)
│   │   ├── guessTheLinkPrompts.ts  # 44 concepts × 6 hint angles each
│   │   ├── mafiaNarration.ts  # Shuffle-bag narrator lines (night, morning, exile, faction wins)
│   │   ├── mafiaSetup.ts      # Shared Mafia settings defaults and deal validation for the UI
│   │   ├── top100/            # Hidden ranked lists: 17 JSON files, 100 items each
│   │   ├── top100Categories.ts # The eligible Top 100 categories
│   │   └── reverseCategoriesItems.ts # 66 items across 22 themes
│   ├── theme/
│   │   └── tokens.ts          # Player colour tokens, team accents, & palette
│   └── types.ts               # Shared TypeScript models and interfaces
├── scripts/                   # Development-time tooling (not bundled into the app)
│   ├── commonNouns.source.txt # Authored vocabulary source for the corpus
│   ├── generateCommonNouns.ts # Regenerates commonNouns.json + lints it
│   ├── testContentEngine.ts   # `npm run test:content`
│   ├── testImpostorQuestionMode.ts # `npm run test:questions`
│   ├── testTeamMode.ts        # `npm run test:teams`
│   ├── testAvoidTheWord.ts    # `npm run test:avoid`
│   ├── testMafia.ts           # `npm run test:mafia`
│   ├── validateTop100Lists.ts # `npm run validate:top100`
│   └── testTop100.ts          # `npm run test:top100`
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

# Room team-mode suite: play modes, seating, balance/shuffle, start gate, and team leaderboard scoring
npm run test:teams

# Avoid the Word suite: matching rules, question bank/answer-space rules, shuffle bag, a full bot
# game with leak, overrule, AFK, reconnect, team and placement checks
npm run test:avoid

# Top 100 list validation: 100 items per list, unique ranks, unique names and aliases, coverage report
npm run validate:top100

# Top 100 suite: matching, scoring, duplicates, host overrules, shuffle bag, a full bot game,
# a team game (captain rotation, private suggestions, team scoring) and list-leak checks
npm run test:top100

# Mafia suite: role deals 4-16, night resolution, vote tally, win ordering, 250 bot-only games,
# and a 6-player room game with public/private leak checks, reconnect and recap assertions
npm run test:mafia

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

> **Note:** A placeholder or missing Gemini key is detected at boot: the server logs one line and
> every game keeps running on the bundled content, with the custom-theme field hidden in the host UI.

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
