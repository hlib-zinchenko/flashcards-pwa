# CLAUDE.md

Offline flashcards PWA: Svelte 5 (runes) + TypeScript + Vite, Dexie over IndexedDB, vite-plugin-pwa. No backend; all data lives on the device. Deployed to GitHub Pages at https://flashcards.hzinchenko.com/ (custom domain, served from the root).

## Commands

```bash
npm run check      # svelte-check + TypeScript; run after any change
npm test           # Vitest (node env), tests/**/*.test.ts
npm run build      # into dist/
npm run preview    # http://localhost:4173/ (build first)
```

There is no lint or format script. Match the existing style: 2-space indent, single quotes, semicolons, long lines are fine.

## Layout

- `src/App.svelte`: switches screens on `router.route`. Hash routing in `src/lib/router.svelte.ts` (`#/`, `#/deck/:id`, `#/test`, `#/test/run`, `#/settings`).
- `src/routes/`: one component per screen.
- `src/components/`: shared UI.
- `src/lib/db.ts`: Dexie schema (`decks`, `cards`, `tags`). `src/lib/types.ts`: data types.
- `src/lib/repo/`: every database write goes through here. Components don't write to `db` directly.
- `src/lib/live.ts`: Dexie `liveQuery` stores, used in components as `$allDecks` etc. They're `undefined` until loaded.
- `src/lib/io/`: CSV (PapaParse) and JSON backup parse/validate/merge, plus file save/pick.
- `src/lib/{learning,session,gestures}.ts`: pure logic, unit-tested in `tests/`.
- Global state in `*.svelte.ts` modules (`testState`, `toast`, `install`, `i18n`, `router`). `localStorage` only via `loadPref`/`savePref` in `src/lib/prefs.ts`.

## Rules and gotchas

- **Never pass `$state` objects to IndexedDB.** Deep `$state` wraps values in Proxies, and IndexedDB throws `DataCloneError` on them. Use `$state.raw` for data headed to the DB, or copy first (`$state.snapshot(x)`, `[...arr]`). This broke backup import in v0.1.0.
- **UI strings:** add every key to `src/lib/i18n/en.ts` (source of truth) and `uk.ts`; `uk` is typed `Messages`, so a missing key fails `npm run check`. Plurals use `one|other` (en) and `one|few|many|other` (uk) with an `{n}` param. Call `t('key', params)`.
- **Changing the data model:** add a new `db.version(n)` in `db.ts` (don't edit version 1), update `types.ts`, and keep backups compatible: `parseBackup` in `src/lib/io/json.ts` must accept older files (fill defaults), and bump `SCHEMA_VERSION` only when old app versions can't read the new format. Update `tests/json.test.ts`.
- **Tests** cover pure logic only and run in node. Put new logic in `src/lib/` as plain functions so it can be tested; build test cards with `card()` and get determinism from `seeded()` in `tests/helpers.ts`.
- **Base path:** the app is served from `/` on its own subdomain (Vite `base`). In source, use relative or `import.meta.env.BASE_URL` paths, not root-absolute ones, so `base` can change again. `index.html` hardcodes `/` in its icon links, so update it too if `base` changes.
- **The address is the user's data.** IndexedDB, `localStorage` and the service worker belong to the origin, so changing the domain or path leaves every user's cards behind at the old address, and GitHub's redirect from the old address stops old installs from updating. Users have to export a backup there and import it at the new address. It already happened twice (github.io → hzinchenko.com/flashcards-pwa/ → flashcards.hzinchenko.com).
- **Design ("card stock"):** colours, fonts and the pressed-tile `.btn`/`.panel`/`.chip` styles are tokens in `src/app.css`; style components through them. Words on cards use `--font-card`. Fonts are self-hosted (`src/main.ts`, `src/fonts.css`) and precached for offline. Japanese fonts draw Cyrillic full-width, so every stack puts Onest first and only Japanese subsets of BIZ UDPGothic are loaded.
- **Icons:** `public/icon.svg` is the source for the PNGs (`npm run icons`); `public/favicon.svg` switches with the device theme. The dark and Android monochrome sources are in `docs/icons/`. The 好き on the icon is BIZ UDPGothic Bold converted to paths, so it renders without the font.
- **Service worker** (`registerType: 'prompt'`): when you check a build in a browser, an old cached version may be running. Tap the app's Reload prompt or unregister the worker before trusting what you see.

## Release

Deploys run only from version tags (`.github/workflows/deploy.yml`), and the tag must equal `package.json` `version`. `ci.yml` runs check/test/build on pushes to `main` and on PRs.

```bash
npm version patch   # bumps, commits, tags
git push --follow-tags
```

Then write GitHub release notes for users: what changed and what they need to do (for example, tap Reload).
