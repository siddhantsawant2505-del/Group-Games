/**
 * Impostor Game Module.
 * Server-authoritative logic for role assignment, clue handling,
 * randomized reveal, voting verification, and +1 scoring rules.
 */

import { getRandomImpostorWord, ImpostorWord } from '../../shared/data/impostorWords';
import { InternalRoom, InternalPlayer } from '../roomManager';
import { RoleRevealInfo, PlayerResultStanding, VoteBreakdownItem, RevealedAnswer } from '../../shared/types';

export interface ImpostorRoundState {
  currentWord: ImpostorWord;
  impostorPlayerId: string;
  divergedCluePlayerId?: string;
}

// In-memory store of active Impostor round details per room
const activeRounds = new Map<string, ImpostorRoundState>();

/**
 * Shuffles an array in-place using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 1. Role Assignment Phase
 * Server selects a random secret word from the starter list and a random impostor.
 * - Non-impostor players privately receive: "the word is: <word>"
 * - The impostor privately receives: "you're the impostor" (no word)
 */
export function setupImpostorRound(room: InternalRoom): void {
  const wordItem = getRandomImpostorWord();
  const eligiblePlayers = room.players.filter((p) => p.connected);
  const playerPool = eligiblePlayers.length > 0 ? eligiblePlayers : room.players;

  const impostorIndex = Math.floor(Math.random() * playerPool.length);
  const impostorPlayer = playerPool[impostorIndex];

  activeRounds.set(room.code, {
    currentWord: wordItem,
    impostorPlayerId: impostorPlayer.id,
  });

  room.privateData = {};

  room.players.forEach((player) => {
    const isImpostor = player.id === impostorPlayer.id;

    if (isImpostor) {
      room.privateData[player.id] = {
        role: "The Impostor",
        // The impostor receives NO word
        secretWord: undefined,
        secretHint: `Category: ${wordItem.category}`,
        isSpecialRole: true,
        specialAccentBg: true,
        secretInstructions: "You're the impostor! You do NOT know the secret word. When clue submission starts, bluff with a one-word clue that sounds convincing to blend in with the crew.",
        inputPlaceholder: "A clever, subtle bluff word...",
      };
    } else {
      room.privateData[player.id] = {
        role: "Crew",
        secretWord: wordItem.word,
        secretHint: `Category: ${wordItem.category}`,
        isSpecialRole: false,
        specialAccentBg: false,
        secretInstructions: `The word is: "${wordItem.word}". Think of a one-word clue that signals to your crewmates you know the word without giving it away to the impostor!`,
        inputPlaceholder: `One-word clue for ${wordItem.word}...`,
      };
    }
  });

  room.phasePrompt = "Check Your Secret Role";
  room.phaseSubprompt = "Keep your screen hidden from friends!";
}

/**
 * 2. Clue Submission Helper
 * Cleans up and stores a player's private one-word clue.
 */
export function recordPlayerClue(
  room: InternalRoom,
  playerId: string,
  rawClue: string
): void {
  if (!room.privateData[playerId]) {
    room.privateData[playerId] = {};
  }

  // Sanitize to a clean 1-word clue (or up to 2 words if hyphenated/compound)
  const trimmed = rawClue.trim();
  const oneWord = trimmed.split(/\s+/)[0] || trimmed || "(Blank)";

  room.privateData[playerId].submittedAnswer = oneWord;
  room.privateData[playerId].inputSubmitted = true;
  room.hasSubmittedInput.add(playerId);
}

/**
 * Automatically provides simulated clues for test bots
 */
export function simulateImpostorBotClues(room: InternalRoom): void {
  const roundState = activeRounds.get(room.code);
  const wordItem = roundState?.currentWord;
  const word = wordItem?.word || "Item";
  const category = (wordItem?.category || "").toLowerCase();

  const genericBluffs = [
    "Everyday", "Useful", "Common", "Essential", "Classic", "Modern",
    "Natural", "Popular", "Traditional", "Standard", "Typical", "Familiar"
  ];

  const plausibleClues: Record<string, string[]> = {
    "Pancake": ["Syrup", "Fluffy", "Griddle", "Batter"],
    "Backpack": ["Straps", "Zippers", "Canvas", "School"],
    "Campfire": ["Sparks", "Embers", "Smoke", "Warmth"],
    "Bicycle": ["Pedals", "Chain", "Handlebars", "Spokes"],
    "Telescope": ["Galaxies", "Optics", "Starlight", "Tripod"],
    "Submarine": ["Periscope", "Sonar", "Depth", "Torpedo"],
    "Umbrella": ["Canopy", "Raindrop", "Shield", "Waterproof"],
    "Guitar": ["Strings", "Fretboard", "Acoustic", "Chords"],
    "Camera": ["Shutter", "Lens", "Snapshot", "Flash"],
    "Popcorn": ["Theater", "Kernels", "Butter", "Salty"],
    "Penguin": ["Tuxedo", "Antarctica", "Waddle", "Ice"],
    "Dolphin": ["Ocean", "Sonar", "Flipper", "Clever"],
    "Lighthouse": ["Beacon", "Coastline", "Warning", "Tower"],
    "Periscope": ["Mirrors", "Submerged", "Angle", "Observation"],
    "Observatory": ["Dome", "Constellation", "Summit", "Skyward"],
    "Catapult": ["Siege", "Leverage", "Projectile", "Tension"],
    "Kaleidoscope": ["Prisms", "Symmetry", "Cylinder", "Mirrors"],
    "Astrolabe": ["Celestial", "Ancient", "Horizon", "Bronze"],
    "Seismograph": ["Tremors", "Needle", "Vibrations", "Quake"],
    "Orrery": ["Planets", "Clockwork", "Orbits", "Brass"],
    "Sextant": ["Nautical", "Angles", "Latitude", "Navigator"],
    "Gargoyle": ["Gothic", "Cathedral", "Stone", "Spout"],
    "Compass": ["Needle", "North", "Bearing", "Magnetic"],
    "Volcano": ["Magma", "Crater", "Eruption", "Basalt"],
    "Sandwich": ["Crust", "Filling", "Sliced", "Layers"],
  };

  room.players.forEach((player) => {
    if (player.isBot) {
      const isImpostor = player.id === roundState?.impostorPlayerId;
      let clue = "";

      if (isImpostor) {
        clue = genericBluffs[Math.floor(Math.random() * genericBluffs.length)];
      } else if (plausibleClues[word]) {
        const pool = plausibleClues[word];
        clue = pool[Math.floor(Math.random() * pool.length)];
      } else {
        // Dynamic thematic fallback based on category keywords
        if (category.includes("astro") || category.includes("space")) {
          clue = ["Orbit", "Cosmic", "Telescopic", "Starlight"][Math.floor(Math.random() * 4)];
        } else if (category.includes("maritime") || category.includes("ocean") || category.includes("sea")) {
          clue = ["Currents", "Tide", "Vessel", "Anchor"][Math.floor(Math.random() * 4)];
        } else if (category.includes("architect") || category.includes("medieval") || category.includes("stone")) {
          clue = ["Masonry", "Pillars", "Structure", "Archway"][Math.floor(Math.random() * 4)];
        } else if (category.includes("music") || category.includes("audio")) {
          clue = ["Resonance", "Melody", "Acoustic", "Tempo"][Math.floor(Math.random() * 4)];
        } else if (category.includes("outdoor") || category.includes("nature") || category.includes("geo")) {
          clue = ["Wilderness", "Terrain", "Earthy", "Landscape"][Math.floor(Math.random() * 4)];
        } else {
          clue = ["Distinct", "Solid", "Practical", "Intricate"][Math.floor(Math.random() * 4)];
        }
      }

      recordPlayerClue(room, player.id, clue);
    }
  });
}

/**
 * 3. Simultaneous Reveal Compilation
 * Once all players submit (or timer expires), broadcast every player's name + clue
 * in randomized order (NOT join order, NOT alphabetical) to prevent bias.
 * Auto-fills "(No answer)" if a player failed to submit in time.
 */
export function finalizeImpostorReveal(room: InternalRoom): RevealedAnswer[] {
  const compiled: RevealedAnswer[] = room.players.map((player) => {
    const priv = room.privateData[player.id];
    let clue = priv?.submittedAnswer;

    // If timer expired before player submitted, auto-submit placeholder
    if (!clue || !clue.trim()) {
      clue = "(No answer)";
      if (priv) priv.submittedAnswer = clue;
    }

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      answerText: clue,
      revealed: true,
      subtext: player.isHost ? "Host" : undefined,
    };
  });

  // Fisher-Yates randomize order to completely remove order bias
  const randomized = shuffleArray(compiled);
  room.revealedAnswers = randomized;
  return randomized;
}

/**
 * 6. Results Calculation & Scoreboard
 * - Reveal who the impostor was
 * - Reveal what the real word was
 * - Full vote tally
 * - Flag short "why" hint
 * - Scoreboard rules:
 *   +1 to each correct-voting player
 *   +1 to the impostor if they evaded detection (majority vote wrong)
 */
export function calculateImpostorResults(room: InternalRoom): void {
  const roundState = activeRounds.get(room.code);
  const secretWord = roundState?.currentWord.word || "Unknown";
  const category = roundState?.currentWord.category || "Everyday Category";
  const impostorId = roundState?.impostorPlayerId || "";
  const impostorPlayer = room.players.find((p) => p.id === impostorId);
  const impostorClue = room.privateData[impostorId]?.submittedAnswer || "(No clue)";

  // Determine vote counts per candidate
  const tallies: Record<string, number> = {};
  room.players.forEach((p) => {
    tallies[p.id] = 0;
  });

  const voteBreakdown: VoteBreakdownItem[] = [];

  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;

    const voter = room.players.find((p) => p.id === voterId);
    const target = room.players.find((p) => p.id === targetId);

    if (voter && target) {
      voteBreakdown.push({
        voterId,
        voterName: voter.name,
        voterColorIndex: voter.colorIndex,
        targetId,
        targetName: target.name,
        isCorrect: targetId === impostorId,
      });
    }
  }

  // Find candidate(s) with highest vote count
  let maxVotes = 0;
  for (const count of Object.values(tallies)) {
    if (count > maxVotes) maxVotes = count;
  }

  const highestVotedIds = Object.keys(tallies).filter(
    (id) => tallies[id] === maxVotes && maxVotes > 0
  );

  // Impostor is caught ONLY if they are the sole candidate with the highest votes
  const impostorCaught = highestVotedIds.length === 1 && highestVotedIds[0] === impostorId;
  const impostorEvaded = !impostorCaught;

  // Compute points according to user requirements:
  // "+1 to each correct-voting player, +1 to the impostor if they evaded detection (majority vote wrong)"
  const pointsAwarded: Record<string, number> = {};
  room.players.forEach((p) => {
    pointsAwarded[p.id] = 0;
  });

  // +1 to each player who voted for the true impostor
  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    if (targetId === impostorId) {
      pointsAwarded[voterId] = (pointsAwarded[voterId] || 0) + 1;
    }
  }

  // +1 to the impostor if they evaded detection
  if (impostorEvaded && impostorId) {
    pointsAwarded[impostorId] = (pointsAwarded[impostorId] || 0) + 1;
  }

  // Update running scoreboard
  room.players.forEach((player) => {
    const pts = pointsAwarded[player.id] || 0;
    player.score += pts;
  });

  // Build role reveals
  const roleReveals: RoleRevealInfo[] = room.players.map((player) => {
    const isImpostor = player.id === impostorId;
    const clue = room.privateData[player.id]?.submittedAnswer || "-";
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      role: isImpostor ? "The Impostor" : "Crew",
      isSpecialRole: isImpostor,
      explanation: isImpostor
        ? `Submitted clue "${clue}" while knowing nothing!`
        : `Submitted clue "${clue}" for "${secretWord}".`,
    };
  });

  // Build standings sorted by total score descending
  const standings: PlayerResultStanding[] = room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerColor: player.colorHex,
    colorIndex: player.colorIndex,
    pointsAdded: pointsAwarded[player.id] || 0,
    totalScore: player.score,
    badge: player.id === impostorId ? "Impostor" : undefined,
  }));

  standings.sort((a, b) => b.totalScore - a.totalScore);

  // Formulate helpful "why" hint
  let whyHint = "";
  if (impostorCaught) {
    whyHint = `The crew sniffed out ${impostorPlayer?.name || "the Impostor"}! The clue "${impostorClue}" diverged the most from the real word "${secretWord}".`;
  } else {
    const accusedName = highestVotedIds[0]
      ? room.players.find((p) => p.id === highestVotedIds[0])?.name
      : "an innocent crewmate";
    whyHint = `${impostorPlayer?.name || "The Impostor"} bluffed with "${impostorClue}" and framed ${accusedName}! The secret word was "${secretWord}".`;
  }

  room.results = {
    summary: impostorCaught
      ? `Crew Victory! ${impostorPlayer?.name || "The Impostor"} was unmasked!`
      : `Impostor Triumph! ${impostorPlayer?.name || "The Impostor"} evaded detection!`,
    secretWord,
    category,
    impostorPlayerId: impostorId,
    impostorName: impostorPlayer?.name || "The Impostor",
    impostorClue,
    impostorCaught,
    whyHint,
    voteTallies: tallies,
    voteBreakdown,
    roleReveals,
    standings,
    winnerTitle: impostorCaught ? "Crew Victory (+1 pt for voters)" : "Impostor Win (+1 pt)",
  };
}

/**
 * Cleans up active round state when room closes
 */
export function cleanupImpostorRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}
