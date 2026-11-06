import { loadPref, savePref } from '../prefs';
import { isPresetTagId, LEVEL_KEYS, PRESET_TAG_IDS, type Level, type PresetTagId, type Tag } from '../types';
import { en, type MessageKey, type Messages } from './en';
import { uk } from './uk';
import { es } from './es';
import { de } from './de';
import { fr } from './fr';
import { ja } from './ja';
import { pt } from './pt';
import { it } from './it';
import { tr } from './tr';
import { nl } from './nl';
import { zh } from './zh';

/** UI languages with their own names, in the order the picker lists them. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'uk', name: 'Українська' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'ja', name: '日本語' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'zh', name: '简体中文' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];

const dictionaries: Record<Lang, Messages> = { en, uk, es, de, fr, ja, pt, it, tr, nl, zh };
const one_other: Intl.LDMLPluralRule[] = ['one', 'other'];
/** The order of the `|`-separated plural forms in each language's strings. */
const pluralOrder: Record<Lang, Intl.LDMLPluralRule[]> = {
  en: one_other,
  uk: ['one', 'few', 'many', 'other'],
  es: one_other,
  de: one_other,
  fr: one_other,
  ja: ['other'],
  pt: one_other,
  it: one_other,
  tr: one_other,
  nl: one_other,
  zh: ['other'],
};

function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
  return LANGUAGES.find((l) => nav === l.code || nav.startsWith(`${l.code}-`))?.code ?? 'en';
}

export const i18n = $state({ lang: loadPref<Lang>('lang', detectLang()) });

export function setLang(lang: Lang): void {
  i18n.lang = lang;
  savePref('lang', lang);
  document.documentElement.lang = lang;
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const lang = i18n.lang;
  let msg: string = dictionaries[lang][key] ?? en[key];
  if (msg.includes('|') && typeof params.n === 'number') {
    const forms = msg.split('|');
    const order = pluralOrder[lang];
    // Categories a language only uses for huge numbers (es, fr, pt, it: "many") read as "other".
    const idx = order.indexOf(new Intl.PluralRules(lang).select(params.n));
    msg = forms[Math.min(idx === -1 ? order.length - 1 : idx, forms.length - 1)];
  }
  return msg.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

export function levelLabel(level: Level): string {
  return t(`level.${LEVEL_KEYS[level]}`);
}

export function tagLabel(tag: Pick<Tag, 'id' | 'name'>): string {
  return isPresetTagId(tag.id) ? t(`tag.${tag.id}`) : tag.name;
}

/** Presets first (in their fixed order), then custom tags alphabetically. */
export function sortTags<T extends Pick<Tag, 'id' | 'name' | 'preset'>>(tags: readonly T[]): T[] {
  return tags.slice().sort((a, b) => {
    if (a.preset !== b.preset) return a.preset ? -1 : 1;
    if (a.preset) return PRESET_TAG_IDS.indexOf(a.id as PresetTagId) - PRESET_TAG_IDS.indexOf(b.id as PresetTagId);
    return tagLabel(a).localeCompare(tagLabel(b), i18n.lang);
  });
}

/** A language tag's name in the UI language, capitalised: "Japanese (Japan)", "Українська (Україна)". */
export function languageName(tag: string): string {
  let name = tag;
  try {
    name = new Intl.DisplayNames([i18n.lang], { type: 'language' }).of(tag) ?? tag;
  } catch {
    // Not a valid tag; show it as is.
  }
  return name.charAt(0).toLocaleUpperCase(i18n.lang) + name.slice(1);
}
