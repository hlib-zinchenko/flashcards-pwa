/** Pure helpers for collections and the languages their decks are read aloud in. */
import { normLang, type VoiceLike } from './speech';
import type { CardSide, Collection, CollectionLanguage, Deck } from './types';

/** Id of the collection that decks from before collections existed are put in. */
export const DEFAULT_COLLECTION_ID = 'default';

export function defaultCollection(name: string, now: number): Collection {
  return { id: DEFAULT_COLLECTION_ID, name, position: 0, languages: [], createdAt: now, updatedAt: now };
}

/** Never offered or accepted, anywhere. */
const EXCLUDED_LANGS = new Set(['ru']);

export const baseLang = (lang: string): string => normLang(lang).split('-')[0];

export const isAllowedLang = (lang: string): boolean => !!baseLang(lang) && !EXCLUDED_LANGS.has(baseLang(lang));

/** Canonical BCP 47 casing ("ja-JP"), also for Android's "ja_JP". Falls back to the input when Intl rejects it. */
export function canonicalLang(lang: string): string {
  const tag = lang.replace('_', '-');
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? tag;
  } catch {
    return tag;
  }
}

/**
 * How a card side of this deck is read aloud: the side's language with the collection's voice for it,
 * or null when the side is off or its language is no longer one of the collection's.
 */
export function sideSpeech(deck: Pick<Deck, 'speech'>, collection: Pick<Collection, 'languages'> | undefined, side: CardSide): CollectionLanguage | null {
  const lang = deck.speech?.[side];
  if (!lang || !collection) return null;
  return collection.languages.find((l) => normLang(l.lang) === normLang(lang)) ?? null;
}

/** Languages the device has voices for (one entry per language and region), never excluded ones. */
export function languageOptions(voices: readonly VoiceLike[]): string[] {
  const seen = new Map<string, string>();
  for (const v of voices) {
    if (!isAllowedLang(v.lang)) continue;
    const lang = canonicalLang(v.lang);
    if (!seen.has(normLang(lang))) seen.set(normLang(lang), lang);
  }
  return [...seen.values()];
}

/** Valid languages from untrusted data (a backup file): known shape, allowed, no duplicates. */
export function cleanLanguages(raw: unknown): CollectionLanguage[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CollectionLanguage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { lang, voiceURI } = item as Record<string, unknown>;
    if (typeof lang !== 'string' || !isAllowedLang(lang) || seen.has(normLang(lang))) continue;
    seen.add(normLang(lang));
    out.push(typeof voiceURI === 'string' && voiceURI ? { lang, voiceURI } : { lang });
  }
  return out;
}

/** A deck's side languages from untrusted data; drops anything that isn't an allowed language tag. */
export function cleanDeckSpeech(raw: unknown): Deck['speech'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: NonNullable<Deck['speech']> = {};
  for (const side of ['front', 'back'] as const) {
    const lang = (raw as Record<string, unknown>)[side];
    if (typeof lang === 'string' && isAllowedLang(lang)) out[side] = lang;
  }
  return out.front || out.back ? out : undefined;
}

/**
 * Where the Decks tab and a fresh launch lead: the collection opened last, or the collections list.
 * `existing` guards against a remembered collection that was deleted (or replaced by an import).
 */
export function decksHome(lastCollectionId: string | null, existing?: ReadonlySet<string>): string {
  if (!lastCollectionId || (existing && !existing.has(lastCollectionId))) return '/';
  return `/collection/${encodeURIComponent(lastCollectionId)}`;
}
