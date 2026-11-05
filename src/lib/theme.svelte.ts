import { loadPref, savePref } from './prefs';
import { parseThemePref, resolveTheme, THEME_COLORS, type ThemePref } from './theme';

/** Appearance setting. index.html applies the saved value before first paint. */
export const theme = $state({ pref: parseThemePref(loadPref<unknown>('theme', 'system')) });

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

/** Mark <html> with the chosen theme (none for System) and match the browser bar color. */
export function applyTheme(): void {
  const root = document.documentElement;
  if (theme.pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme.pref;
  const color = THEME_COLORS[resolveTheme(theme.pref, darkQuery.matches)];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

export function setTheme(pref: ThemePref): void {
  theme.pref = pref;
  savePref('theme', pref);
  applyTheme();
}

darkQuery.addEventListener('change', applyTheme);
