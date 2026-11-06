import { describe, expect, it } from 'vitest';
import { canonicalLang, cleanDeckSpeech, decksHome, languageOptions, sideSpeech, swappedSpeech } from '../src/lib/collections';
import type { VoiceLike } from '../src/lib/speech';

const collection = { languages: [{ lang: 'ja-JP', voiceURI: 'Kyoko' }, { lang: 'uk-UA' }] };

describe('sideSpeech', () => {
  it("reads a side in its language with the collection's voice", () => {
    const deck = { speech: { front: 'ja-JP', back: 'uk-UA' } };
    expect(sideSpeech(deck, collection, 'front')).toEqual({ lang: 'ja-JP', voiceURI: 'Kyoko' });
    expect(sideSpeech(deck, collection, 'back')).toEqual({ lang: 'uk-UA' });
  });

  it('does not read a side that is off', () => {
    expect(sideSpeech({ speech: { front: 'ja-JP' } }, collection, 'back')).toBeNull();
    expect(sideSpeech({}, collection, 'front')).toBeNull();
  });

  it('does not read a side whose language the collection no longer has', () => {
    expect(sideSpeech({ speech: { front: 'es-ES' } }, collection, 'front')).toBeNull();
    expect(sideSpeech({ speech: { front: 'ja-JP' } }, { languages: [] }, 'front')).toBeNull();
    expect(sideSpeech({ speech: { front: 'ja-JP' } }, undefined, 'front')).toBeNull();
  });

  it('matches language tags regardless of case or separator', () => {
    expect(sideSpeech({ speech: { front: 'ja_jp' } }, collection, 'front')?.lang).toBe('ja-JP');
  });
});

const voice = (lang: string, name = lang): VoiceLike => ({ voiceURI: `${name}:${lang}`, name, lang, localService: true, default: false });

describe('languageOptions', () => {
  it('lists each language and region once, in canonical form', () => {
    const voices = [voice('ja-JP', 'Kyoko'), voice('ja-JP', 'Otoya'), voice('en_GB'), voice('en-US'), voice('uk-UA')];
    expect(languageOptions(voices)).toEqual(['ja-JP', 'en-GB', 'en-US', 'uk-UA']);
  });

  it('never offers Russian', () => {
    expect(languageOptions([voice('ru-RU', 'Milena'), voice('RU_ru'), voice('uk-UA')])).toEqual(['uk-UA']);
  });
});

describe('cleanDeckSpeech', () => {
  it('keeps allowed language tags only', () => {
    expect(cleanDeckSpeech({ front: 'ja-JP', back: 'ru-RU' })).toEqual({ front: 'ja-JP' });
    expect(cleanDeckSpeech({ front: 3 })).toBeUndefined();
    expect(cleanDeckSpeech(null)).toBeUndefined();
  });
});

describe('canonicalLang', () => {
  it('fixes casing and separators', () => {
    expect(canonicalLang('ja_jp')).toBe('ja-JP');
    expect(canonicalLang('UK-ua')).toBe('uk-UA');
  });
});

describe('decksHome', () => {
  it('opens the collection used last', () => {
    expect(decksHome('k1')).toBe('/collection/k1');
    expect(decksHome('k1', new Set(['k1', 'k2']))).toBe('/collection/k1');
  });

  it('falls back to the list when there is none or it is gone', () => {
    expect(decksHome(null)).toBe('/');
    expect(decksHome('gone', new Set(['k1']))).toBe('/');
  });
});

describe('swappedSpeech', () => {
  it('moves each language to the other side', () => expect(swappedSpeech({ front: 'ja', back: 'uk' })).toEqual({ front: 'uk', back: 'ja' }));
  it('keeps an unread side unread', () => expect(swappedSpeech({ front: 'ja' })).toEqual({ back: 'ja' }));
  it('handles a deck that never set it', () => expect(swappedSpeech(undefined)).toEqual({}));
});
