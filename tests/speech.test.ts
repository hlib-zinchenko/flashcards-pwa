import { describe, expect, it } from 'vitest';
import { detectLang, isNoveltyVoice, normalizeSpeechPrefs, pickVoice, voicesFor, type VoiceLike } from '../src/lib/speech';

describe('detectLang', () => {
  it('reads kana and kanji as Japanese', () => {
    expect(detectLang('食べる')).toBe('ja-JP');
    expect(detectLang('おはよう')).toBe('ja-JP');
    expect(detectLang('カタカナ')).toBe('ja-JP');
    expect(detectLang('ｶﾀｶﾅ')).toBe('ja-JP');
    expect(detectLang('水')).toBe('ja-JP');
  });

  it('prefers Japanese when scripts are mixed', () => {
    expect(detectLang('to eat (食べる)')).toBe('ja-JP');
  });

  it('reads Cyrillic as Ukrainian', () => {
    expect(detectLang('їсти')).toBe('uk-UA');
    expect(detectLang('вода')).toBe('uk-UA');
  });

  it('falls back to English', () => {
    expect(detectLang('to eat')).toBe('en-US');
    expect(detectLang('')).toBe('en-US');
  });
});

const v = (lang: string, localService = true, isDefault = false, name = lang): VoiceLike => ({
  voiceURI: `${name}:${lang}:${localService}:${isDefault}`,
  name,
  lang,
  localService,
  default: isDefault,
});

describe('pickVoice', () => {
  it('returns null when no voice speaks the language', () => {
    expect(pickVoice([v('en-US'), v('fr-FR')], 'ja-JP')).toBeNull();
    expect(pickVoice([], 'en-US')).toBeNull();
  });

  it('matches on language when the region differs', () => {
    expect(pickVoice([v('en-US'), v('en-GB')], 'en-AU')?.lang).toBe('en-GB');
  });

  it('prefers the exact region', () => {
    expect(pickVoice([v('en-GB'), v('en-US')], 'en-US')?.lang).toBe('en-US');
  });

  it('prefers on-device voices over network ones', () => {
    expect(pickVoice([v('ja-JP', false), v('ja-JP', true)], 'ja-JP')?.localService).toBe(true);
  });

  it('prefers the default voice when the rest is equal', () => {
    expect(pickVoice([v('ja-JP'), v('ja-JP', true, true)], 'ja-JP')?.default).toBe(true);
  });

  it('understands Android-style language tags', () => {
    expect(pickVoice([v('ja_JP')], 'ja-JP')?.lang).toBe('ja_JP');
    expect(pickVoice([v('UK-ua')], 'uk-UA')?.lang).toBe('UK-ua');
  });

  it('uses the chosen voice when the device has it', () => {
    const otoya = v('ja-JP', false, false, 'Otoya');
    expect(pickVoice([v('ja-JP', true, true, 'Kyoko'), otoya], 'ja-JP', otoya.voiceURI)).toBe(otoya);
  });

  it('falls back to the best fit when the chosen voice is gone or is another language', () => {
    const kyoko = v('ja-JP', true, true, 'Kyoko');
    const samantha = v('en-US', true, true, 'Samantha');
    expect(pickVoice([kyoko], 'ja-JP', 'missing')).toBe(kyoko);
    expect(pickVoice([kyoko, samantha], 'ja-JP', samantha.voiceURI)).toBe(kyoko);
  });
});

describe('voice quality', () => {
  it('spots Apple novelty and character voices, with or without a language suffix', () => {
    expect(isNoveltyVoice('Zarvox')).toBe(true);
    expect(isNoveltyVoice('Bad News')).toBe(true);
    expect(isNoveltyVoice('Eddy (Japanese (Japan))')).toBe(true);
    expect(isNoveltyVoice('Kyoko')).toBe(false);
    expect(isNoveltyVoice('Kyoko (Enhanced)')).toBe(false);
  });

  it('picks a real voice over a novelty one, even from another region', () => {
    const eddy = v('ja-JP', true, false, 'Eddy (Japanese (Japan))');
    const kyoko = v('ja-JP', true, false, 'Kyoko');
    expect(pickVoice([eddy, kyoko], 'ja-JP')).toBe(kyoko);
    const daniel = v('en-GB', true, false, 'Daniel');
    expect(pickVoice([v('en-US', true, false, 'Zarvox'), daniel], 'en-US')).toBe(daniel);
  });

  it('still uses a novelty voice when it is the only one', () => {
    const eddy = v('ja-JP', true, false, 'Eddy (Japanese (Japan))');
    expect(pickVoice([eddy], 'ja-JP')).toBe(eddy);
  });

  it('prefers Enhanced and Premium voices', () => {
    const enhanced = v('ja-JP', true, false, 'Kyoko (Enhanced)');
    expect(pickVoice([v('ja-JP', true, true, 'Kyoko'), enhanced], 'ja-JP')).toBe(enhanced);
  });
});

describe('voicesFor', () => {
  it('lists only voices of the language, best fit first, then by name', () => {
    const list = [v('en-GB', true, false, 'Daniel'), v('ja-JP'), v('en-US', true, false, 'Fred'), v('en-US', true, false, 'Alex'), v('en-US', false, false, 'Aaron')];
    expect(voicesFor(list, 'en-US').map((x) => x.name)).toEqual(['Alex', 'Fred', 'Aaron', 'Daniel']);
  });

  it('drops duplicates', () => {
    const a = v('ja-JP', true, false, 'Kyoko');
    expect(voicesFor([a, { ...a }], 'ja-JP')).toHaveLength(1);
  });
});

describe('normalizeSpeechPrefs', () => {
  it('defaults to automatic voices at normal speed', () => {
    expect(normalizeSpeechPrefs(undefined)).toEqual({ voices: {}, rate: 'normal' });
    expect(normalizeSpeechPrefs('junk')).toEqual({ voices: {}, rate: 'normal' });
  });

  it('keeps valid choices and drops unknown ones', () => {
    expect(
      normalizeSpeechPrefs({ voices: { 'ja-JP': 'kyoko', 'fr-FR': 'amelie', 'uk-UA': '', 'en-US': 5 }, rate: 'slow' }),
    ).toEqual({ voices: { 'ja-JP': 'kyoko' }, rate: 'slow' });
    expect(normalizeSpeechPrefs({ rate: 'turbo' }).rate).toBe('normal');
  });
});
