/* One-off documentation updater for the Guess the Link engine. Deleted after running. */
const fs = require('fs');
const load = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const save = (p, s) => fs.writeFileSync(p, s.replace(/\n/g, '\r\n'), 'utf8');

function rep(where, s, from, to) {
  const hits = s.split(from).length - 1;
  if (hits !== 1) {
    throw new Error(`[${where}] anchor matched ${hits} times (expected 1):\n---\n${from.slice(0, 200)}\n---`);
  }
  return s.split(from).join(to);
}

/* ------------------------------------------------------------------ README */
let r = load('README.md');

r = rep('readme/intro', r,
  'Three games ship dedicated server engines — **Impostor**, **Avoid the Word**, and **Mafia** — with\nadditional game ideas documented for future expansion.',
  'Four games ship dedicated server engines — **Impostor**, **Avoid the Word**, **Mafia**, and\n**Guess the Link** — with additional game ideas documented for future expansion.');

r = rep('readme/features', r,
  '- **Extensible phase machine** — lobby, game-select, reveal, input, reveal-answers, discussion, vote, atw-describe, night, day, results, next-round.',
  '- **Dedicated Guess the Link engine** — one hidden concept, a different private hint angle per player, a shuffled link board, and simultaneous concept guessing with per-correct points.\n- **Extensible phase machine** — lobby, game-select, reveal, input, reveal-answers, guess, discussion, vote, atw-describe, night, day, results, next-round.');

r = rep('readme/collection', r,
  'Party Games features a collection of six multiplayer party games designed for phone controllers. **Impostor**, **Avoid the Word**, and **Mafia** are 100% operational with dedicated server game engines, while the remaining three games are integrated into the selection UI and execute on the generic round framework.',
  'Party Games features a collection of six multiplayer party games designed for phone controllers. **Impostor**, **Avoid the Word**, **Mafia**, and **Guess the Link** are 100% operational with dedicated server game engines, while the remaining two games are integrated into the selection UI and execute on the generic round framework.');

r = rep('readme/table', r,
  '| **Guess the Link** | 3–8 | Word Association | Link | 🟡 **Selectable & Framework-Ready** — Generic clue/vote phase; central connection guessing planned |',
  '| **Guess the Link** | 3–8 | Word Association | Link | 🟢 **Fully Working & Playable** — Dedicated engine with one hidden concept, per-player private hint angles, shuffled board, simultaneous guessing, and scoring |');

const gtlSection = `### 4. Guess the Link — Dedicated Link Engine (🟢 Fully Operational)

**Guess the Link** ships a fully custom server engine (\`server/games/guessTheLink.ts\`) with its own phase chain (\`reveal → input → reveal-answers → guess → results\`), server-side concept hiding, private per-player hint dealing, a shuffled response board, and simultaneous concept guessing. Concepts and their hint angles live in 44 original entries (\`shared/data/guessTheLinkPrompts.ts\`).

- **Objective**: Every player holds a different angle on the same hidden concept. Write a response from your angle, read everyone else's, then name the concept.

- **Game Rules & Mechanics**:
  1. **Player Requirements**: 3 to 8 players (solo testing supported via "+ Add Bot").
  2. **Hint Reveal (\`reveal\` phase, 10s)**:
     - The server picks one hidden concept and deals every player a **different hint angle** (six distinct angles per concept; larger rooms reuse them).
     - Each player sees **only their own angle**, plus the concept's broad category, its word count, and which angle number they hold. The concept itself never leaves the server.
  3. **Response Submission (\`input\` phase, 30s)**:
     - Each player privately writes **one word or a short phrase** inspired by their own angle. The server sanitizes it to a maximum of **3 words / 24 characters** and holds it privately.
     - Responses are only ever exposed on the link board — never alongside their author's angle during guessing.
  4. **The Link Board (\`reveal-answers\` phase, 15s)**:
     - Every response is shown together in **Fisher-Yates shuffled order** (never join order), with each player's own angle kept in view.
  5. **Simultaneous Guessing (\`guess\` phase, 30s)**:
     - Everyone privately locks in a guess at the hidden concept at the same time, exactly like a secret ballot; the room can see **who** has locked in but never **what** they guessed.
     - The phase closes as soon as every player has locked in, or when the timer expires. The host can reveal early.
  6. **Results (\`results\` phase)**:
     - The hidden concept is revealed along with every angle that was dealt and everyone's guess.
     - **+1 point** for each player who names the concept correctly (exact answers, plural-insensitive spellings, shipped aliases, and answers that clearly contain the concept all count).
     - A heuristic **"biggest giveaway"** callout names the response that pointed hardest at the concept; it is omitted when nothing resembles it.
  7. **Next Round Loop (\`next-round\`)**: a fresh concept with new angles, avoiding concepts already played in the room, with cumulative scores preserved.

---

### 5. Catalog Games (🟡 Framework-Integrated & Selectable)

The remaining two games are fully registered in \`@shared/data/games.ts\` and can be selected by the host in the \`game-select\` screen. They currently run through the generic phase state machine (\`server/roomManager.ts\`) with dedicated game rule modules planned:`;

r = rep('readme/catalog-block', r,
  `### 4. Catalog Games (🟡 Framework-Integrated & Selectable)

The remaining three games are fully registered in \`@shared/data/games.ts\` and can be selected by the host in the \`game-select\` screen. They currently run through the generic phase state machine (\`server/roomManager.ts\`) with dedicated game rule modules planned:

#### Guess the Link (Lateral Word Association)
- **Min/Max Players**: 3–8 | **Icon**: \`link\`
- **Tagline**: Connect the mysterious clues!
- **Rules**:
  - Each player receives a unique angle or hint pointing toward an invisible central concept.
  - Every player submits one response that matches their private hint.
  - All revealed answers are displayed together; players collaborate to deduce the secret connection tying them all together.
- **Current State**: Selectable in game menu; utilizes generic prompt/reveal pipeline; central puzzle-matching interface planned.`,
  gtlSection);

r = rep('readme/phases', r,
  `3. **\`reveal\`** — private assignment (impostor role, taboo cards, or Mafia roles).
4. **\`input\`** — players submit one-word clues (Impostor).
5. **\`reveal-answers\`** — clues revealed simultaneously (Impostor).
6. **\`discussion\`** — timed debate (Impostor; Mafia day phase).
7. **\`vote\`** — secret ballot (Impostor; Mafia exile vote).
8. **\`atw-describe\`** — Avoid the Word's live describing turns.
9. **\`night\`** — Mafia and Detective act privately (Mafia).
10. **\`day\`** — overnight elimination announced, then discussion and vote (Mafia).
11. **\`results\`** — tally reveal, role exposure, winner, next-round option.
12. **\`next-round\`** — new round with a fresh secret assignment.`,
  `3. **\`reveal\`** — private assignment (impostor role, taboo cards, Mafia roles, or a Guess the Link hint angle).
4. **\`input\`** — players submit clues (Impostor) or responses (Guess the Link).
5. **\`reveal-answers\`** — clues revealed simultaneously (Impostor) or the shuffled link board (Guess the Link).
6. **\`guess\`** — simultaneous guessing at the hidden concept (Guess the Link).
7. **\`discussion\`** — timed debate (Impostor; Mafia day phase).
8. **\`vote\`** — secret ballot (Impostor; Mafia exile vote).
9. **\`atw-describe\`** — Avoid the Word's live describing turns.
10. **\`night\`** — Mafia and Detective act privately (Mafia).
11. **\`day\`** — overnight elimination announced, then discussion and vote (Mafia).
12. **\`results\`** — tally reveal, role exposure, winner, next-round option.
13. **\`next-round\`** — new round with a fresh secret assignment.`);

r = rep('readme/tree-screens', r,
  '├── screens/           # Phase screens (incl. Atw* and MafiaReveal/NightAction/TownSleeps/Morning/Results)',
  '├── screens/           # Phase screens (incl. Atw*, Mafia*, and GtlHintReveal/Input/ResponseReveal/Guess/Results)');

r = rep('readme/tree-games', r,
  '│   │   └── mafia.ts           # Mafia engine: roles, night actions, win conditions, scoring, bot logic',
  '│   │   ├── mafia.ts           # Mafia engine: roles, night actions, win conditions, scoring, bot logic\n│   │   └── guessTheLink.ts    # Link engine: concept hiding, hint dealing, guessing, scoring, bot logic');

r = rep('readme/tree-data', r,
  '│   │   └── avoidTheWordPrompts.ts  # 40 subjects × 3 forbidden trap words',
  '│   │   ├── avoidTheWordPrompts.ts  # 40 subjects × 3 forbidden trap words\n│   │   └── guessTheLinkPrompts.ts  # 44 concepts × 6 hint angles each');

save('README.md', r);

/* ------------------------------------------------------------ GAME_rules.md */
let g = load('docs/GAME_rules.md');

g = rep('rules/players', g,
  '- A room requires **3–12 players** for the Impostor game, **4–16** for Mafia, and **3–10** for Avoid the Word.',
  '- A room requires **3–12 players** for the Impostor game, **4–16** for Mafia, **3–10** for Avoid the Word,\n  and **3–8** for Guess the Link.');

g = rep('rules/phases', g,
  `5. \`reveal-answers\` — clues are revealed simultaneously (Impostor only).
6. \`discussion\` — timed group discussion (Impostor only).`,
  `5. \`reveal-answers\` — clues are revealed simultaneously (Impostor only) or the shuffled link board
   appears (Guess the Link only).
6. \`guess\` — everyone privately locks in a guess at the hidden concept at the same time (Guess the
   Link only).
7. \`discussion\` — timed group discussion (Impostor only).`);

g = rep('rules/phase-numbers', g,
  `7. \`vote\` — secret ballot (Impostor only).
8. \`atw-describe\` — Avoid the Word's live rotation of 45-second describing turns.
9. \`night\` — Mafia (and the Detective, if present) act privately; townspeople wait (Mafia only).
10. \`day\` — the overnight elimination is announced before discussion and vote (Mafia only).
11. \`results\` — tally reveal, role exposure, per-turn breakdown, and standings.
12. \`next-round\` — new round (new word, fresh taboo cards, or a fresh role deal).`,
  `8. \`vote\` — secret ballot (Impostor only).
9. \`atw-describe\` — Avoid the Word's live rotation of 45-second describing turns.
10. \`night\` — Mafia (and the Detective, if present) act privately; townspeople wait (Mafia only).
11. \`day\` — the overnight elimination is announced before discussion and vote (Mafia only).
12. \`results\` — tally reveal, role exposure, per-turn breakdown, and standings.
13. \`next-round\` — new round (new word, fresh taboo cards, a fresh role deal, or a new concept).`);

g = rep('rules/chain', g,
  `\`reveal → atw-describe → results\`, and Mafia runs
\`reveal → night → day → discussion → vote → results\`, looping back to \`night\` after every exile
until one side wins.`,
  `\`reveal → atw-describe → results\`, Mafia runs
\`reveal → night → day → discussion → vote → results\` (looping back to \`night\` after every exile
until one side wins), and Guess the Link runs
\`reveal → input → reveal-answers → guess → results\`.`);

g = rep('rules/control-heading', g,
  '### 2.6 Control rules',
  `### 2.6 Guess the Link game rules

- **Hint dealing:** the server hides one concept and deals every player a **different** hint angle on
  it (six distinct angles per concept, reused in bigger rooms). Each player sees only their own
  angle, the concept's category, its word count, and their angle number.
- **Responses:** each player privately writes one word or a short phrase from their own angle,
  sanitized to 3 words / 24 characters.
- **Link board:** every response is revealed together in shuffled order; the concept itself stays
  hidden.
- **Guessing:** everyone locks in a guess at the hidden concept at the same time — the room sees who
  has locked in, never what they guessed. The phase closes when everyone has guessed or the timer
  ends.
- **Scoring:** **+1** per correct guess (exact answers, plural-insensitive spellings, shipped
  aliases, and answers clearly containing the concept all count).
- **Results:** the concept, every angle, every guess, the correct guessers, a heuristic "biggest
  giveaway" callout, and the cumulative leaderboard.

### 2.7 Control rules`);

g = rep('rules/arch-rounds', g,
  `- \`activeRounds\` in \`server/games/mafia.ts\` keeps the per-room Mafia state (role assignment, living
  players, night picks, investigation results, elimination history, and scoring).`,
  `- \`activeRounds\` in \`server/games/mafia.ts\` keeps the per-room Mafia state (role assignment, living
  players, night picks, investigation results, elimination history, and scoring).
- \`activeRounds\` in \`server/games/guessTheLink.ts\` keeps the per-room Guess the Link state (the
  hidden concept, the dealt angles, responses, guesses, and the concepts already played).`);

g = rep('rules/arch-assets', g,
  `- \`client/src/screens/MafiaRevealScreen.tsx\`, \`MafiaNightActionScreen.tsx\`,
  \`MafiaTownSleepsScreen.tsx\`, \`MafiaMorningScreen.tsx\`, \`MafiaResultsScreen.tsx\` — the Mafia
  views; the day phase reuses \`DiscussionPhaseScreen\` and \`VotePhaseScreen\` as-is.`,
  `- \`client/src/screens/MafiaRevealScreen.tsx\`, \`MafiaNightActionScreen.tsx\`,
  \`MafiaTownSleepsScreen.tsx\`, \`MafiaMorningScreen.tsx\`, \`MafiaResultsScreen.tsx\` — the Mafia
  views; the day phase reuses \`DiscussionPhaseScreen\` and \`VotePhaseScreen\` as-is.
- \`shared/data/guessTheLinkPrompts.ts\` — 44 original concepts, each with 6 hint angles.
- \`server/games/guessTheLink.ts\` — the Guess the Link engine (concept hiding, hint dealing,
  response sanitizing, the shuffled board, simultaneous guessing, scoring).
- \`client/src/screens/GtlHintRevealScreen.tsx\`, \`GtlInputScreen.tsx\`,
  \`GtlResponseRevealScreen.tsx\`, \`GtlGuessScreen.tsx\`, \`GtlResultsScreen.tsx\` — the Guess the
  Link views.`);

g = rep('rules/current-state', g,
  `- **Avoid the Word** and **Mafia** also run on dedicated engines (taboo turns with buzz
  confirmation, and hidden roles with night/day elimination loops respectively).`,
  `- **Avoid the Word**, **Mafia**, and **Guess the Link** also run on dedicated engines (taboo turns
  with buzz confirmation, hidden roles with night/day elimination loops, and hidden concepts with
  per-player hint angles and simultaneous guessing respectively).`);

save('docs/GAME_rules.md', g);

console.log('README.md and docs/GAME_rules.md updated for Guess the Link.');
