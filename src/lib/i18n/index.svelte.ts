import { loadPref, savePref } from '../prefs';
import { isPresetTagId, LEVEL_KEYS, PRESET_TAG_IDS, type Level, type PresetTagId, type Tag } from '../types';
import { en, type MessageKey, type Messages } from './en';
import { uk } from './uk';

export type Lang = 'en' | 'uk';

const dictionaries: Record<Lang, Messages> = { en, uk };
const pluralOrder: Record<Lang, Intl.LDMLPluralRule[]> = {
  en: ['one', 'other'],
  uk: ['one', 'few', 'many', 'other'],
};

function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('uk') ? 'uk' : 'en';
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
    const idx = pluralOrder[lang].indexOf(new Intl.PluralRules(lang).select(params.n));
    msg = forms[Math.min(Math.max(idx, 0), forms.length - 1)];
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
