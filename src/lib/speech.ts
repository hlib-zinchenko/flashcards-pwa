/** Pure helpers for reading cards aloud. The browser side lives in speech.svelte.ts. */

export type SpeechLang = 'ja-JP' | 'uk-UA' | 'en-US';

// Hiragana, katakana, CJK ideographs (incl. extension A) and half-width katakana.
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/;
const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Guess the language of a card's text from its script, so it is read with a matching voice.
 * Any kana or kanji means Japanese, any Cyrillic means Ukrainian, anything else English.
 */
export function detectLang(text: string): SpeechLang {
  if (JAPANESE.test(text)) return 'ja-JP';
  if (CYRILLIC.test(text)) return 'uk-UA';
  return 'en-US';
}

/** The parts of SpeechSynthesisVoice that pickVoice looks at. */
export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/** Android reports languages like "ja_JP". */
const normLang = (lang: string) => lang.replace('_', '-').toLowerCase();

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
 * Voice to read a language with: the one the user chose in Settings if this device
 * still has it, otherwise the best fit. Null if no voice speaks the language.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string, preferredURI?: string | null): V | null {
  const matching = voicesFor(voices, lang);
  return matching.find((v) => v.voiceURI === preferredURI) ?? matching[0] ?? null;
}

/** Languages the app can read aloud, in the order Settings lists them. */
export const SPEECH_LANGS: readonly SpeechLang[] = ['ja-JP', 'uk-UA', 'en-US'];

export const SPEECH_RATES = { slow: 0.7, normal: 1 } as const;
export type SpeechRate = keyof typeof SPEECH_RATES;

export interface SpeechPrefs {
  /** Chosen voiceURI per language; missing = automatic. */
  voices: Partial<Record<SpeechLang, string>>;
  rate: SpeechRate;
}

export const DEFAULT_SPEECH_PREFS: SpeechPrefs = { voices: {}, rate: 'normal' };

/** Saved prefs merged over the defaults, dropping anything unknown. */
export function normalizeSpeechPrefs(saved: unknown): SpeechPrefs {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<SpeechPrefs>;
  const voices: SpeechPrefs['voices'] = {};
  if (s.voices && typeof s.voices === 'object') {
    for (const lang of SPEECH_LANGS) {
      const uri = s.voices[lang];
      if (typeof uri === 'string' && uri) voices[lang] = uri;
    }
  }
  const rate = typeof s.rate === 'string' && s.rate in SPEECH_RATES ? s.rate : DEFAULT_SPEECH_PREFS.rate;
  return { voices, rate };
}

/** A short phrase per language for the Try button in Settings. */
export const SAMPLE_TEXT: Record<SpeechLang, string> = {
  'ja-JP': 'こんにちは。よろしくお願いします。',
  'uk-UA': 'Привіт! Як справи?',
  'en-US': 'Hello! Nice to meet you.',
};
