export type Level = 0 | 1 | 2 | 3 | 4 | 5;

export const LEVELS: readonly Level[] = [0, 1, 2, 3, 4, 5];

/** Stable keys used for i18n and CSS classes, indexed by Level. */
export const LEVEL_KEYS = ['new', 'weak', 'learning', 'confident', 'strong', 'mastered'] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

/** A language a collection can read aloud, with the voice to use (missing = pick automatically). */
export interface CollectionLanguage {
  /** BCP 47 tag, e.g. "ja-JP". */
  lang: string;
  voiceURI?: string;
}

/** A group of decks, e.g. one language or one course. */
export interface Collection {
  id: string;
  name: string;
  position: number;
  /** Languages its decks can be read aloud in; empty = no reading aloud. */
  languages: CollectionLanguage[];
  createdAt: number;
  updatedAt: number;
}

export type CardSide = 'front' | 'back';

/** Language each card side is read aloud in; a missing side is not read. */
export type DeckSpeech = Partial<Record<CardSide, string>>;

export interface Deck {
  id: string;
  name: string;
  collectionId: string;
  /** Missing on decks that never set it (both sides off). */
  speech?: DeckSpeech;
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
