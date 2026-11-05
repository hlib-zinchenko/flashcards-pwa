import { describe, expect, it } from 'vitest';
import { isNoveltyVoice, normalizeSpeechPrefs, pickVoice, sampleText, voicesFor, type VoiceLike } from '../src/lib/speech';

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
  it('defaults to normal speed', () => {
    expect(normalizeSpeechPrefs(undefined)).toEqual({ rate: 1 });
    expect(normalizeSpeechPrefs('junk')).toEqual({ rate: 1 });
    expect(normalizeSpeechPrefs({ rate: 'turbo' })).toEqual({ rate: 1 });
    expect(normalizeSpeechPrefs({ rate: NaN })).toEqual({ rate: 1 });
  });

  it('keeps a saved speed, snapped to the slider and within its range', () => {
    expect(normalizeSpeechPrefs({ rate: 1.3 })).toEqual({ rate: 1.3 });
    expect(normalizeSpeechPrefs({ rate: 0.7000001 })).toEqual({ rate: 0.7 });
    expect(normalizeSpeechPrefs({ rate: 0.1 })).toEqual({ rate: 0.5 });
    expect(normalizeSpeechPrefs({ rate: 4 })).toEqual({ rate: 1.5 });
  });

  it('carries over the old Slow/Normal choice and drops the old per-language voices', () => {
    expect(normalizeSpeechPrefs({ voices: { 'ja-JP': 'kyoko' }, rate: 'slow' })).toEqual({ rate: 0.7 });
    expect(normalizeSpeechPrefs({ rate: 'normal' })).toEqual({ rate: 1 });
  });
});

describe('sampleText', () => {
  it("is the language's own name", () => {
    expect(sampleText('ja-JP')).toMatch(/日本語/);
    expect(sampleText('uk-UA')).toMatch(/українська/i);
    expect(sampleText('es-ES')).toMatch(/español/i);
  });
});
