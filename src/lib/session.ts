import type { Card, Level } from './types';

export type Direction = 'front' | 'back';
export type Mode = 'finite' | 'infinite';
export type SortMode = 'deck' | 'random' | 'az' | 'za';

export interface TestConfig {
  deckIds: string[];
  direction: Direction;
  mode: Mode;
  sort: SortMode;
  levels: Level[];
  /** Empty with includeUntagged=false means "any tags". */
  tagIds: string[];
  includeUntagged: boolean;
  /** null = all matching cards */
  limit: number | null;
}

export const DEFAULT_CONFIG: TestConfig = {
  deckIds: [],
  direction: 'front',
  mode: 'finite',
  sort: 'deck',
  levels: [0, 1, 2, 3, 4, 5],
  tagIds: [],
  includeUntagged: false,
  limit: null,
};

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function matchesTags(card: Pick<Card, 'tags'>, cfg: Pick<TestConfig, 'tagIds' | 'includeUntagged'>): boolean {
  if (cfg.tagIds.length === 0 && !cfg.includeUntagged) return true;
  if (card.tags.length === 0) return cfg.includeUntagged;
  return card.tags.some((t) => cfg.tagIds.includes(t));
}

export function filterCards(cards: readonly Card[], cfg: TestConfig): Card[] {
  const decks = new Set(cfg.deckIds);
  const levels = new Set(cfg.levels);
  return cards.filter((c) => decks.has(c.deckId) && levels.has(c.level) && matchesTags(c, cfg));
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function sortCards(
  cards: readonly Card[],
  cfg: Pick<TestConfig, 'sort' | 'direction'>,
  deckOrder: ReadonlyMap<string, number>,
  rng: Rng = Math.random,
): Card[] {
  const byDeck = (a: Card, b: Card) =>
    (deckOrder.get(a.deckId) ?? 0) - (deckOrder.get(b.deckId) ?? 0) || a.position - b.position;
  const prompt = (c: Card) => (cfg.direction === 'front' ? c.front : c.back);
  switch (cfg.sort) {
    case 'random':
      return shuffle(cards, rng);
    case 'az':
      return cards.slice().sort((a, b) => collator.compare(prompt(a), prompt(b)) || byDeck(a, b));
    case 'za':
      return cards.slice().sort((a, b) => collator.compare(prompt(b), prompt(a)) || byDeck(a, b));
    default:
      return cards.slice().sort(byDeck);
  }
}

/** Filter, sort, then apply the card limit. */
export function buildPool(
  cards: readonly Card[],
  cfg: TestConfig,
  deckOrder: ReadonlyMap<string, number>,
  rng: Rng = Math.random,
): Card[] {
  const sorted = sortCards(filterCards(cards, cfg), cfg, deckOrder, rng);
  return cfg.limit && cfg.limit > 0 ? sorted.slice(0, cfg.limit) : sorted;
}

/** How many other cards a missed card waits before it comes back. */
const REQUEUE_MIN = 3;
const REQUEUE_MAX = 5;

/**
 * Card queue for one test run. Holds ids only, so card edits made
 * during a session don't need to touch it.
 */
export class Session {
  readonly pool: readonly string[];
  readonly mode: Mode;
  private readonly reshuffle: boolean;
  private readonly rng: Rng;
  private queue: string[];
  current: string | null = null;

  /** Ids answered "know" at least once. */
  readonly learned = new Set<string>();
  /** Ids answered "don't know" at least once. */
  readonly missed = new Set<string>();
  /** Ids answered "know" on their very first attempt. */
  readonly firstTry = new Set<string>();
  private readonly attempted = new Set<string>();
  answered = 0;
  knownCount = 0;

  constructor(pool: readonly string[], mode: Mode, opts: { reshuffle?: boolean; rng?: Rng } = {}) {
    this.pool = pool.slice();
    this.mode = mode;
    this.reshuffle = opts.reshuffle ?? false;
    this.rng = opts.rng ?? Math.random;
    this.queue = this.pool.slice();
    this.advance();
  }

  get done(): boolean {
    return this.current === null;
  }

  /** Remaining cards in finite mode (unique cards not yet learned). */
  get remaining(): number {
    return this.pool.length - this.learned.size;
  }

  grade(known: boolean): void {
    const id = this.current;
    if (id === null) return;
    this.answered++;
    if (!this.attempted.has(id)) {
      this.attempted.add(id);
      if (known) this.firstTry.add(id);
    }
    if (known) {
      this.knownCount++;
      this.learned.add(id);
    } else {
      this.missed.add(id);
      this.requeue(id);
    }
    this.advance();
  }

  private requeue(id: string): void {
    const offset = REQUEUE_MIN + Math.floor(this.rng() * (REQUEUE_MAX - REQUEUE_MIN + 1));
    this.queue.splice(Math.min(offset, this.queue.length), 0, id);
  }

  private advance(): void {
    const prev = this.current;
    // Infinite: start the next pass when the queue runs out, or when only the
    // card just shown is left (a miss at the end of a pass).
    const onlyPrevLeft = this.queue.length === 1 && this.queue[0] === prev;
    if (this.mode === 'infinite' && this.pool.length > 0 && (this.queue.length === 0 || onlyPrevLeft)) {
      this.queue.push(...(this.reshuffle ? shuffle(this.pool, this.rng) : this.pool));
    }
    // Avoid showing the same card twice in a row when there is a choice.
    if (prev !== null && this.queue[0] === prev && this.queue.length > 1) {
      const idx = this.queue.findIndex((q) => q !== prev);
      if (idx > 0) [this.queue[0], this.queue[idx]] = [this.queue[idx], this.queue[0]];
    }
    this.current = this.queue.shift() ?? null;
  }
}

export interface Summary {
  answered: number;
  known: number;
  missed: number;
  firstTry: number;
  uniqueCards: number;
  levelUps: number;
  levelDowns: number;
}

export function summarize(
  session: Session,
  startLevels: ReadonlyMap<string, Level>,
  currentLevels: ReadonlyMap<string, Level>,
): Summary {
  let levelUps = 0;
  let levelDowns = 0;
  for (const [id, start] of startLevels) {
    const now = currentLevels.get(id) ?? start;
    if (now > start) levelUps++;
    else if (now < start) levelDowns++;
  }
  return {
    answered: session.answered,
    known: session.knownCount,
    missed: session.missed.size,
    firstTry: session.firstTry.size,
    uniqueCards: new Set([...session.learned, ...session.missed]).size,
    levelUps,
    levelDowns,
  };
}
