/** Pure helpers for reading cards aloud. The browser side lives in speech.svelte.ts. */

/** The parts of SpeechSynthesisVoice that pickVoice looks at. */
export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/** Android reports languages like "ja_JP". */
export const normLang = (lang: string) => lang.replace('_', '-').toLowerCase();

const sameLanguage = (v: VoiceLike, lang: string) => normLang(v.lang).split('-')[0] === normLang(lang).split('-')[0];

/**
 * Apple's character and novelty voices (Eddy, Grandma, Bad News, Zarvox…). They're fun to pick
 * but poor for learning pronunciation, so they go last and are never chosen automatically
 * when there's another option. Eddy & co. carry a suffix like "(Japanese (Japan))".
 */
const NOVELTY_VOICES = new Set([
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ',
  'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
  'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley',
]);

export function isNoveltyVoice(name: string): boolean {
  return NOVELTY_VOICES.has(name.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase());
}

/**
 * How well a voice of the right language fits. In order of weight: not a novelty voice,
 * exact region, on-device (works offline), higher quality (iOS "Enhanced"/"Premium"), system default.
 */
function fit(v: VoiceLike, lang: string): number {
  return (
    (isNoveltyVoice(v.name) ? -16 : 0) +
    (normLang(v.lang) === normLang(lang) ? 8 : 0) +
    (v.localService ? 4 : 0) +
    (/enhanced|premium/i.test(v.name) ? 2 : 0) +
    (v.default ? 1 : 0)
  );
}

/** The voices that speak this language, best fit first, then by name. Duplicates (same voiceURI) are dropped. */
export function voicesFor<V extends VoiceLike>(voices: readonly V[], lang: string): V[] {
  const seen = new Set<string>();
  const out: V[] = [];
  for (const v of voices) {
    if (!sameLanguage(v, lang) || seen.has(v.voiceURI)) continue;
    seen.add(v.voiceURI);
    out.push(v);
  }
  return out.sort((a, b) => fit(b, lang) - fit(a, lang) || a.name.localeCompare(b.name));
}

/**
 * Voice to read a language with: the one chosen for the collection if this device
 * still has it, otherwise the best fit. Null if no voice speaks the language.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string, preferredURI?: string | null): V | null {
  const matching = voicesFor(voices, lang);
  return matching.find((v) => v.voiceURI === preferredURI) ?? matching[0] ?? null;
}

/** Reading speed (SpeechSynthesisUtterance.rate): the Settings slider's range and step. 1 = the voice's normal speed. */
export const SPEECH_RATE = { min: 0.5, max: 1.5, step: 0.1, default: 1 } as const;

/** Speeds saved by versions that had a Slow/Normal switch. */
const LEGACY_RATES: Record<string, number> = { slow: 0.7, normal: 1 };

/** Clamp to the slider's range and snap to its step, so 0.7000001 is saved as 0.7. */
export function clampRate(rate: number): number {
  const { min, max, step } = SPEECH_RATE;
  const snapped = Math.round(rate / step) * step;
  return Math.round(Math.min(max, Math.max(min, snapped)) * 100) / 100;
}

/** Device-wide reading preferences; languages and voices are set per collection. */
export interface SpeechPrefs {
  rate: number;
}

export const DEFAULT_SPEECH_PREFS: SpeechPrefs = { rate: SPEECH_RATE.default };

/** Saved prefs merged over the defaults, dropping anything unknown. */
export function normalizeSpeechPrefs(saved: unknown): SpeechPrefs {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const raw = typeof s.rate === 'string' ? LEGACY_RATES[s.rate] : s.rate;
  const rate = typeof raw === 'number' && Number.isFinite(raw) ? clampRate(raw) : DEFAULT_SPEECH_PREFS.rate;
  return { rate };
}

/** What the speed slider reads, in English, to let you hear the new speed. */
export const RATE_SAMPLE = { text: 'This is how fast your cards are read.', lang: 'en-US' } as const;

/** What the Try button says: the language's own name ("español", "日本語"), so it works for any language. */
export function sampleText(lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}
