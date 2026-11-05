import { describe, expect, it } from 'vitest';
import { parseThemePref, resolveTheme } from '../src/lib/theme';

describe('parseThemePref', () => {
  it('keeps known values', () => {
    expect(parseThemePref('system')).toBe('system');
    expect(parseThemePref('light')).toBe('light');
    expect(parseThemePref('dark')).toBe('dark');
  });
  it('falls back to system for missing or unknown values', () => {
    for (const v of [undefined, null, '', 'Dark', 'auto', 1, {}]) expect(parseThemePref(v)).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('follows the device for system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('ignores the device for an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
