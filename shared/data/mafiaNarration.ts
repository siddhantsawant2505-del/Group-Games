/**
 * Mafia narration.
 *
 * The server is the narrator (there is no moderator and no shared screen), so
 * every beat of the game gets a line of prose. Lines are non-graphic and picked
 * from a per-room shuffle bag: nothing repeats until a category is exhausted,
 * and a reshuffle never immediately repeats the last line.
 *
 * `{name}` is the only placeholder; the room layer appends the role clause when
 * `revealRoleOnDeath` is on.
 */

export type MafiaNarrationKind =
  | 'night'
  | 'morning-death'
  | 'morning-calm'
  | 'exile'
  | 'town-win'
  | 'mafia-win';

export type MafiaRng = () => number;

export const MAFIA_NARRATION: Record<MafiaNarrationKind, string[]> = {
  night: [
    'Night falls. The village locks its doors and the Mafia starts to whisper.',
    'The lamps go out one by one. Somewhere in the dark, a choice is being made.',
    'A cold wind crosses the square. Everyone is asleep — or pretending to be.',
    'The shutters close. Three people are awake tonight, and only two of them are telling the truth.',
    'The village settles into silence, and the night begins its quiet work.',
    'A dog barks once, then thinks better of it. The night has begun.',
    'Moonlight on the rooftops. Keep your eyes closed and your secrets closer.',
    'The last candle is blown out. Nobody admits to being awake.',
    'The square empties. Footsteps fade. The night belongs to the Mafia now.',
    'Mist rolls in from the fields. Perfect weather for a secret.',
    'The clock tower strikes midnight. The village holds its breath.',
    'Everyone says goodnight to someone they do not entirely trust.',
  ],
  'morning-death': [
    'The sun comes up, but the village does not wake as it was. {name} is gone.',
    'Morning arrives quietly. One chair at the table stays empty — {name}’s.',
    'The bell rings to start the day, and {name} does not answer it.',
    'The village gathers as usual. {name} never makes it to the square.',
    'A hush spreads through the streets. {name} was not seen at dawn.',
    'The baker opens the shutters and finds the village already whispering about {name}.',
    'Daylight finds {name} missing. Nobody will admit to knowing why.',
    'The square fills slowly, counting heads. {name} is not among them.',
    'Someone knocks on {name}’s door. There is no answer, and there will not be one.',
    'The village wakes with one fewer voice and one more question.',
    'Morning brings thin light and a shorter attendance at the well.',
    'The first thing anyone says today is {name}’s name, and then silence.',
  ],
  'morning-calm': [
    'The sun rises on a village that is somehow exactly as it was. Nobody died tonight.',
    'Morning comes, doors creak open, and every face is still here. Nobody died tonight.',
    'The night passes without a single loss. The village breathes a little easier.',
    'Dawn arrives and the count is unbroken. Nobody died tonight.',
    'A quiet night: no empty chair, no missing voice, and no explanation.',
    'The village wakes whole. Whatever the Mafia planned did not happen.',
    'Every door opens this morning. The Mafia must be disappointed.',
    'The sun finds no gap in the village today. Nobody died tonight.',
    'The bell rings and everyone answers it. A rare, fragile relief.',
    'Nobody died overnight — which only makes the village trust each other a little less.',
    'A peaceful night. Someone out there wasted a very good plan.',
    'The village survives the night intact. Now comes the harder part.',
  ],
  exile: [
    'The votes are in. {name} is walked to the edge of the village and does not come back.',
    'The village makes its choice. {name} packs a bag and leaves under every eye.',
    'A verdict is reached. {name} will not be with the village tomorrow.',
    'The square falls silent as {name} is escorted out.',
    '{name} was chosen. Whether it was justice or a mistake, the village now lives with it.',
    'The vote lands on {name}. The gate closes behind them.',
    'The village points, and the pointing does not stop until {name} leaves.',
    '{name} is exiled by the decision of the crowd.',
    'No appeal, no second vote. {name} is out.',
    'The count is read aloud. {name} hears their own name and stops arguing.',
    'The village has spoken, and it spoke {name}’s name.',
    '{name} is banished. The square empties in a way that feels like relief and fear at once.',
  ],
  'town-win': [
    'Every Mafia member is gone. The village survives, shaken but standing.',
    'The last secret falls away. The town has won, and it only cost everything else.',
    'The Mafia is finished. The village counts itself lucky and goes on counting.',
    'Dawn breaks on a village with no more hidden knives. The town wins.',
    'The final name is revealed and it is not the one the village expected — but the Mafia is gone. Town wins.',
    'The town rooted out every last one of them. It was ugly, but it worked.',
    'The gate closes on the last Mafia member. The village exhales together.',
    'The secret is out, all of it. The town has survived the long night.',
    'The Mafia is outnumbered and outlasted. The village keeps its square.',
    'Some of the village will never be trusted again, but the Mafia is gone. Town wins.',
    'The tally is complete and every face is known now. The town wins.',
    'The town out-thought the shadows. The village gets its morning back.',
  ],
  'mafia-win': [
    'The Mafia now equals the village. The remaining townspeople are outnumbered, and the shadows take the square.',
    'The village looks around and realizes it is no longer the majority. The Mafia wins.',
    'One by one, the village’s numbers fell. The Mafia stands even with what remains — and that is enough.',
    'The last vote settles nothing. The Mafia has reached parity and the town falls.',
    'The Mafia no longer needs to hide. The village belongs to them now.',
    'The balance tips, then breaks. The Mafia wins.',
    'The village counts heads and finds the wrong answer. The Mafia has taken control.',
    'The shadows are no longer outnumbered. The Mafia wins, and the square goes quiet.',
    'There is no one left to outvote. The Mafia takes the village.',
    'The Mafia survives the night and the day has no answer left. They win.',
    'The final door closes. The Mafia has the numbers now.',
    'The village’s choices were reasonable every single day. Together, they were fatal. Mafia wins.',
  ],
};

export const MAFIA_NARRATION_PLACEHOLDER = '{name}';

function shuffle<T>(items: readonly T[], rng: MafiaRng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * A per-room shuffle bag. One bag per kind, so a death line never borrows the
 * night-falls rotation. Deterministic when a seeded rng is supplied (tests).
 */
export class MafiaNarrationBag {
  private pending: Partial<Record<MafiaNarrationKind, string[]>> = {};
  private last: Partial<Record<MafiaNarrationKind, string>> = {};

  constructor(private readonly rng: MafiaRng = Math.random) {}

  draw(kind: MafiaNarrationKind, name?: string): string {
    const kindLines = MAFIA_NARRATION[kind];
    if (!kindLines || kindLines.length === 0) return '';

    let queue = this.pending[kind];
    if (!queue || queue.length === 0) {
      queue = shuffle(kindLines, this.rng);
      // Never repeat the previous line straight after a reshuffle.
      const previous = this.last[kind];
      if (previous && queue[queue.length - 1] === previous && queue.length > 1) {
        [queue[queue.length - 1], queue[0]] = [queue[0], queue[queue.length - 1]];
      }
      this.pending[kind] = queue;
    }

    const line = queue.pop() as string;
    this.last[kind] = line;
    return name ? line.replaceAll(MAFIA_NARRATION_PLACEHOLDER, name) : line;
  }

  /** How many lines are still unseen in a category (test/debug helper). */
  remaining(kind: MafiaNarrationKind): number {
    return this.pending[kind]?.length ?? 0;
  }
}
