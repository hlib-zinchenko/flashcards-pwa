# CLAUDE.md

Karbka (Карбка in Ukrainian, Karbka in every other language; slogan “Carve it into memory.” / «Закарбуй у памʼяті.»): an offline flashcards PWA. Svelte 5 (runes) + TypeScript + Vite, Dexie over IndexedDB, vite-plugin-pwa. No backend; all data lives on the device. Deployed to GitHub Pages at https://flashcards.hzinchenko.com/ (custom domain, served from the root).

## Commands

```bash
npm run check      # svelte-check + TypeScript; run after any change
npm test           # Vitest (node env, fake-indexeddb), tests/**/*.test.ts
npm run e2e        # Playwright, WebKit, against a fresh build on :4174 (e2e/*.spec.ts)
npm run perf       # load test with big libraries; prints timings (e2e/perf.spec.ts)
npm run screenshots # README screenshots from docs/demo/demo-backup.json (e2e/screenshots.spec.ts)
npm run build      # into dist/
npm run preview    # http://localhost:4173/ (build first)
```

There is no lint or format script. Match the existing style: 2-space indent, single quotes, semicolons, long lines are fine.

## Layout

- `src/App.svelte`: switches screens on `router.route`. Hash routing in `src/lib/router.svelte.ts` (`#/` collections home, `#/collection/:id`, `#/deck/:id`, `#/test`, `#/test/run`, `#/settings`). A launch without a hash and the Decks tab open the collection used last (`lastCollection` pref); an explicit `#/` shows the list.
- `src/routes/`: one component per screen.
- `src/components/`: shared UI.
- `src/lib/db.ts`: Dexie schema (`collections`, `decks`, `cards`, `tags`). Every deck belongs to one collection; version 2 put existing decks into the `default` collection. `src/lib/types.ts`: data types.
- Reading aloud: a collection lists its languages (each with an optional voiceURI); a deck picks a language per card side (`deck.speech`). `sideSpeech()` in `src/lib/collections.ts` resolves it; Russian is never offered or accepted.
- `src/lib/repo/`: every database write goes through here. Components don't write to `db` directly.
- `src/lib/live.ts`: Dexie `liveQuery` stores, used in components as `$allDecks` etc. They're `undefined` until loaded.
- `src/lib/io/`: CSV (PapaParse) and JSON backup parse/validate/merge, plus file save/pick.
- `src/lib/{learning,session,gestures,collections,speech}.ts`: pure logic, unit-tested in `tests/`.
- Global state in `*.svelte.ts` modules (`testState`, `toast`, `install`, `i18n`, `router`). `localStorage` only via `loadPref`/`savePref` in `src/lib/prefs.ts`.

## Rules and gotchas

- **Never pass `$state` objects to IndexedDB.** Deep `$state` wraps values in Proxies, and IndexedDB throws `DataCloneError` on them. Use `$state.raw` for data headed to the DB, or copy first (`$state.snapshot(x)`, `[...arr]`). This broke backup import in v0.1.0.
- **UI strings:** add every key to `src/lib/i18n/en.ts` (source of truth) and `uk.ts`; `uk` is typed `Messages`, so a missing key fails `npm run check`. Plurals use `one|other` (en) and `one|few|many|other` (uk) with an `{n}` param. Call `t('key', params)`.
- **Changing the data model:** add a new `db.version(n)` in `db.ts` (don't edit version 1), update `types.ts`, and keep backups compatible: `parseBackup` in `src/lib/io/json.ts` must accept older files (fill defaults), and bump `SCHEMA_VERSION` only when old app versions can't read the new format. Update `tests/json.test.ts`.
- **Tests** run in node. Put new logic in `src/lib/` as plain functions so it can be tested; build test cards with `card()` and get determinism from `seeded()` in `tests/helpers.ts`. The `repo/` layer, imports and `db.version` upgrades are tested against fake-indexeddb: `resetDb()` before each test, `seedV1()` to write an old database (`tests/dbHelpers.ts`). Add an upgrade test with every new `db.version`.
- **E2E** (`e2e/`) drives the production build in WebKit: swiping, offline reload, backup round trip, the deck limit. The update prompt isn't covered (it needs two builds).
- **Deck limit:** a deck holds at most `MAX_DECK_CARDS` (999, `types.ts`); `addCards`/`updateCard` throw `DeckFullError`, CSV imports into new decks split into "Name", "Name 2"…, and backups import bigger decks from before the limit as they are. The deck screen renders every card (no virtual list), so this is what keeps it fast: about 0.25 s to open a full deck vs 0.9 s at 5k cards on a desktop (`npm run perf`). Libraries of 50k cards in full decks stay under 0.4 s per screen.
- **Base path:** the app is served from `/` on its own subdomain (Vite `base`). In source, use relative or `import.meta.env.BASE_URL` paths, not root-absolute ones, so `base` can change again. `index.html` hardcodes `/` in its icon links, so update it too if `base` changes.
- **CSP:** `index.html` has a Content-Security-Policy `<meta>`: only same-origin scripts, no requests to other hosts (`connect-src 'self'`). The inline theme script is allowed by its sha256; after editing it, `npm test` (`tests/csp.test.ts`) prints the new hash to paste in. Anything loaded from another host (a CDN, an API) needs the policy changed first; e2e fails on any violation.
- **Sharing and SEO:** `index.html` has the description, Open Graph/Twitter tags and JSON-LD; they and `public/robots.txt`/`sitemap.xml` use absolute `https://flashcards.hzinchenko.com/` URLs (crawlers need them), so update them with the domain. The preview image `public/og-image.png` (1200×630) is rendered from `docs/og/og-image.html` with `npm run og-image` (macOS Chrome) and kept out of the precache.
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

Before `npm version`, add an entry for the new version at the top of `CHANGELOG` in `src/lib/changelog.ts` (short lines, `en` and `uk` only; other languages show the English lines) if users will notice the change; the app shows it once after updating ("What's new"). Keep only the latest 3 entries (`MAX_ENTRIES`, enforced by a test): the dialog links to the GitHub releases page for older ones, so drop the oldest when adding one. Skip it for releases with no visible change. Then write GitHub release notes for users: what changed and what they need to do (for example, tap Reload).
