# Party Game Ideas for Friends

> Reference list of fun multiplayer party games that fit the "Party Games" project concept.
> It groups games by the mechanics used in this engine: phone-as-controller lobby, real-time sync,
> hidden roles / secrets, word clues, voting, and timed phases.

---

## 1. What this list is

These are candidate party games, or game variants, that work well with the architecture already
implemented in this project:

- Mobile-first lobby from phones.
- Room code + QR join.
- Server-authoritative state and phase machine.
- Public / private state separation for hidden roles/secrets.
- One-word clues, vote phases, timers, and round loops.

The current engine already implements **Impostor** in detail. The list below includes that as a
base plus other game styles that can reuse the same server/client shapes.

---

## 2. Social deduction games

### 2.1 Impostor (current game)

**Concept:** Most players know a secret word; one player does not and must bluff.

**Core mechanics:**
- Secure role assignment by the server.
- Secret word hidden from the impostor.
- One-word clues submitted privately.
- Simultaneous reveal, discussion, vote, and results.

**Why it fits:** It is already implemented and demonstrates the full round lifecycle.

---

### 2.2 Among Us style

**Concept:** Crewmates complete tasks while one or more impostors sabotage and hide.

**Core mechanics:**
- Hidden crew/impostor roles.
- Public task/sabotage state.
- Secret ballot, discussion, and voting.
- Votes eliminate a player who is then revealed.

**Why it fits:** Requires the same room, phase, vote, and secret-state architecture.

---

### 2.3 Werewolf / Mafia

**Concept:** Night phase assigns hidden kills; day phase is discussed and voted out.

**Core mechanics:**
- Night phase: server-driven but client-visible only to role holders.
- Day phase: public discussion and secret voting.
- Roles reveal at the end.

**Why it fits:** A strong fit for timers, night/day phases, and private role leaks.

---

### 2.4 The Resistance / Avalon

**Concept:** Players split into good and bad teams; a leader proposes missions that everyone votes on.

**Core mechanics:**
- Hidden team roles.
- Public mission proposals/votes.
- No-trump spy roles and vote counters.

**Why it fits:** Leverages the vote phase and private role assignment, with a light discussion step.

---

### 2.5 Spyfall

**Concept:** Players ask yes/no questions; one player is the spy who knows a location, and everyone else knows it too.

**Core mechanics:**
- Secret location for each player.
- Public question/answer phase.
- Spotting the spy via inconsistent answers.

**Why it fits:** The engine already handles hidden locations per player and a public discussion/vote phase.

---

### 2.6 The Chameleon

**Concept:** One player is the Chameleon, secretly assigned an identity the other players do not know.

**Core mechanics:**
- The chameleon tries to hide while answering questions.
- Each player privately guesses the chameleon's identity.

**Why it fits:** Similar to impostor, with a hidden identity, public Q&A, and final deduction.

---

## 3. Word and clue games

### 3.1 Two Truths and a Lie

**Concept:** Each player states two truths and one lie; the group guesses the lie.

**Core mechanics:**
- Players submit text answers privately or publicly.
- Group discussion reveals contradictions.
- Vote or judge picks the lie.

**Why it fits:** Good for shared public discussion plus private submissions.

---

### 3.2 Homophones / Rebus / Silent Word

** concept:** A player gives a clue while others guess.

**Core mechanics:**
- Prompt-based clues.
- Timed guessing.
- Scoring for correct answers.

**Why it fits:** A simpler word-guessing mode parallel to the clue phase.

---

### 3.3 Word Association

**Concept:** Players say the first word that comes to mind in sequence; the group spots the break in pattern.

**Core mechanics:**
- Rapid-fire turns.
- Public list of associations.
- Judge scores consistency or creativity.

**Why it fits:** The input phase could become a rapid-fire association queue.

---

### 3.4 Taboo / Forbidden Words

**Concept:** Describe a word without using forbidden related words.

**Core mechanics:**
- Each player sees a secret target word plus forbidden words.
- Clues are scored on how many can be described.
- Votes/buzzes detect forbidden words.

**Why it fits:** The engine's clue phase can be extended with a forbidden-word list per player.

---

### 3.5 Password / Charades-style clue games

**Concept:** One player gives a short clue to help others guess a card.

**Core mechanics:**
- Secret prompt per player.
- Timed clue-giving rounds.
- Public scoreboard.

**Why it fits:** Easy to add as a second game in the catalog.

---

## 4. Communication and acting games

### 4.1 Charades

**Concept:** Act out a word or phrase while others guess silently.

**Core mechanics:**
- Each player gets a secret card.
- Timed acting rounds.
- Public scoring.

**Why it fits:** A fast alternative to word submission without violating the "one-word clue" rule when adapted.

---

### 4.2 Pictionary-style drawing

**Concept:** Players draw a word while others guess.

**Core mechanics:**
- Secret word per player.
- Shared drawing surface.
- Timed guesses.

**Why it fits:** Can be a second game type; the current system would need a shared canvas/time limit, which is a reasonable extension.

---

### 4.3 Gartic Phone / Telephone

**Concept:** A prompt is drawn, passed to the next player who guesses, then the next draws, and so on.

**Core mechanics:**
- Sequential reveal with a chain of transformations.
- Shared backlog shown to everyone.
- Scoring by final match vs. original.

**Why it fits:** Uses the public room state and round loop, but requires a shared "rendered" output list.

---

### 4.4 Jackbox-style collaborative games

**Concept:** One host draws/uses an input device; everyone else answers on their phone.

**Core mechanics:**
- Host-proposed prompt.
- Anonymous or semi-anonymous answers.
- Public results and voting.

**Why it fits:** The browser-based architecture already supports a phone-as-controller model.

---

## 5. Trivia and party knowledge games

### 5.1 Trivia

**Concept:** Players answer questions across categories; host creates or uses a question bank.

**Core mechanics:**
- Multiple-choice or open questions.
- Timed answers.
- Public scoreboard.

**Why it fits:** Reuses lobby, phase, and results logic; easy to implement.

---

### 5.2 Connect 8 / Sandwich / Group games

**Concept:** Groups of players answer the same question simultaneously; the majority or best answer wins.

**Core mechanics:**
- Everyone submits simultaneously.
- Results count votes or scores.
- Ties resolved with a quick tiebreaker.

**Why it fits:** The input phase can be converted to a simultaneous-save-and-reveal flow.

---

## 6. Role/identity games

### 6.1 Guessing games

**Concept:** One player thinks of a card; the rest ask yes/no questions to identify it.

**Core mechanics:**
- Secret card per player.
- Public yes/no questions.
- Vote or guess after discussion.

**Why it fits:** Mirrors Spyfall and Chameleon.

---

### 6.2 Zombie/infection games

**Concept:** One player is secretly infected and tries to blend in.

**Core mechanics:**
- Hidden infection role.
- Public actions/events.
- Vote or elimination of the infected.

**Why it fits:** Similar to Among Us, with more structured events/timers.

---

### 6.3 Secret identities

**Concept:** Players secretely act as objects or roles while others guess.

**Core mechanics:**
- Hidden identity per player.
- Public behavior/actions.
- Final reveal.

**Why it fits:** The private-state masking model fits naturally.

---

## 7. Recommendation for this project

For a mobile-first real-time engine, the best next games to add are:

1. **Impostor** — already implemented; keep as the flagship.
2. **Among Us style** — high demand, reuses vote/role/deduction logic.
3. **Team mission / Resistance-style** — uses role assignment, vote, and simple discussion.
4. **Trivia** — quick win with reuse of phase/result logic.
5. **Taboo / word clue variants** — natural evolution of the input phase.

---

## 8. Implementation considerations

When adding any new game, the engine should keep a consistent contract:

- **Games catalog** in `shared/data/games.ts` with `id`, `title`, `minPlayers`, `maxPlayers`, `icon`, `description`, `rules`.
- **Server phase logic** in `server/games/` keyed by `gameId`.
- **Public/private state split** unchanged so hidden roles and words are never leaked.
- **Timers** remain server-driven and phase-local.
- **Clients** switch screens based only on `phase`, not on game-specific secrets.

---

## 9. Game selection matrix

| Game idea          | Hidden roles | Word clues | Public discussion | Voting | Timer | Difficulty to add |
|--------------------|--------------|------------|-------------------|--------|-------|-------------------|
| Impostor           | Yes          | Yes        | Yes               | Yes    | Yes   | Already done      |
| Among Us style     | Yes          | No         | Yes               | Yes    | Yes   | High              |
| Werewolf/Mafia     | Yes          | No         | Yes               | Yes    | Yes   | High              |
| The Resistance       | Yes          | No         | Yes               | Yes    | Yes   | Medium            |
| Spyfall            | Yes          | No         | Yes               | Yes    | Optional | Medium          |
| The Chameleon      | Yes          | Yes        | Yes               | Yes    | Yes   | Medium            |
| Two Truths and a Lie | No         | Yes        | Yes               | Yes    | Optional | Medium          |
| Taboo              | No           | Yes        | No                | Optional | Yes   | Medium            |
| Trivia             | No           | No         | No                | Optional | Yes   | Low               |
| Charades           | No           | No         | No                | No     | Yes   | Low               |
| Pictionary-style     | No           | No         | No                | No     | Yes   | Medium            |
| Gartic Phone         | No           | No         | No                | No     | No    | Medium            |

---

## 10. Next steps

- Choose 1–2 new game implementations.
- Add them to the catalog with icons and metadata.
- Implement server-side role assignment, phase behavior, and reveal/score logic.
- Add client screens for the new game.
- Keep the public/private state contract strict for any hidden-role game.

---

*This document is a reference for the Party Games project family, not a promise that every game will be implemented immediately.*
