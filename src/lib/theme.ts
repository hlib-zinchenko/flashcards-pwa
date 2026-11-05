export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];

/**
 * Browser bar color (`<meta name="theme-color">`) per theme: the page background.
 * Keep in sync with `--bg` in app.css and the inline script in index.html.
 */
export const THEME_COLORS: Record<Theme, string> = { light: '#f5f4f1', dark: '#111113' };

/** The saved preference, or 'system' for anything missing or unknown. */
export function parseThemePref(value: unknown): ThemePref {
  return THEME_PREFS.includes(value as ThemePref) ? (value as ThemePref) : 'system';
}

/** The theme that is actually shown. */
export function resolveTheme(pref: ThemePref, prefersDark: boolean): Theme {
  return pref === 'system' ? (prefersDark ? 'dark' : 'light') : pref;
}
