export type Level = 0 | 1 | 2 | 3 | 4 | 5;

export const LEVELS: readonly Level[] = [0, 1, 2, 3, 4, 5];

/** Stable keys used for i18n and CSS classes, indexed by Level. */
export const LEVEL_KEYS = ['new', 'weak', 'learning', 'confident', 'strong', 'mastered'] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

export interface Deck {
  id: string;
  name: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  /** Free-form extra info, hidden in tests until tapped. Missing on older cards. */
  notes?: string;
  /** Tag ids */
  tags: string[];
  /** Order inside the deck */
  position: number;
  level: Level;
  timesSeen: number;
  timesKnown: number;
  timesMissed: number;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  preset: boolean;
  createdAt: number;
}

export const PRESET_TAG_IDS = ['verb', 'noun', 'adjective', 'phrase'] as const;
export type PresetTagId = (typeof PRESET_TAG_IDS)[number];

export function isPresetTagId(id: string): id is PresetTagId {
  return (PRESET_TAG_IDS as readonly string[]).includes(id);
}
