import type { Card, Level } from './types';

export type Direction = 'front' | 'back';
/**
 * - cram: known cards leave the session, missed ones go back at a random spot
 *   until every card is known.
 * - refresh: one pass; answers only update levels.
 */
export type Mode = 'cram' | 'refresh';
export type SortMode = 'deck' | 'random' | 'level';

export const MODES: readonly Mode[] = ['cram', 'refresh'];
export const SORT_MODES: readonly SortMode[] = ['deck', 'random', 'level'];

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
  mode: 'cram',
  sort: 'deck',
  levels: [0, 1, 2, 3, 4, 5],
  tagIds: [],
  includeUntagged: false,
  limit: null,
};

/** Merge a saved config over the defaults, dropping values from older versions. */
export function normalizeConfig(saved: Partial<TestConfig>): TestConfig {
  const cfg = { ...DEFAULT_CONFIG, ...saved };
  if (!MODES.includes(cfg.mode)) cfg.mode = DEFAULT_CONFIG.mode;
  if (!SORT_MODES.includes(cfg.sort)) cfg.sort = DEFAULT_CONFIG.sort;
  return cfg;
}

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

export function sortCards(
  cards: readonly Card[],
  cfg: Pick<TestConfig, 'sort'>,
  deckOrder: ReadonlyMap<string, number>,
  rng: Rng = Math.random,
): Card[] {
  const byDeck = (a: Card, b: Card) =>
    (deckOrder.get(a.deckId) ?? 0) - (deckOrder.get(b.deckId) ?? 0) || a.position - b.position;
  switch (cfg.sort) {
    case 'random':
      return shuffle(cards, rng);
    case 'level':
      return cards.slice().sort((a, b) => a.level - b.level || byDeck(a, b));
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

/**
 * Card queue for one test run. Holds ids only, so card edits made
 * during a session don't need to touch it.
 */
export class Session {
  readonly pool: readonly string[];
  readonly mode: Mode;
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

  constructor(pool: readonly string[], mode: Mode, opts: { rng?: Rng } = {}) {
    this.pool = pool.slice();
    this.mode = mode;
    this.rng = opts.rng ?? Math.random;
    this.queue = this.pool.slice();
    this.advance();
  }

  get done(): boolean {
    return this.current === null;
  }

  /** Unique cards finished: known ones in cram, answered ones in refresh. */
  get completed(): number {
    return this.mode === 'cram' ? this.learned.size : this.attempted.size;
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
      if (this.mode === 'cram') this.requeue(id);
    }
    this.advance();
  }

  /** Put a missed card back at a random spot, never right next. */
  private requeue(id: string): void {
    const n = this.queue.length;
    const index = n === 0 ? 0 : 1 + Math.floor(this.rng() * n);
    this.queue.splice(index, 0, id);
  }

  private advance(): void {
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
