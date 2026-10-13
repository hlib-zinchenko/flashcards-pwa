# Flashcards PWA

Offline flashcards that install to your phone's home screen. You don't need an App Store, an account or a server. Your data stays on your device.

**Live app:** https://hlib-zinchenko.github.io/flashcards-pwa/

## Features

- **Decks & cards:** create, rename and delete decks; add, edit, reorder and move cards, with optional notes per card. Quick-add form: Enter moves to the next field, Enter again saves.
- **Tags:** built-in `verb`, `noun`, `adjective`, `phrase`, plus your own.
- **Learning levels:** New → Weak → Learning → Confident → Strong → Mastered. *Know* moves a card up one level, *Don't know* moves it down one. There is no scheduling: you choose what to study.
- **Test mode**
  - Pick one or more decks, show the front or back first.
  - *Cram*: known cards leave the session, missed ones go back at a random spot until you know them all. *Refresh*: one pass, answers only update levels.
  - Order: deck order, random, level ascending (weakest first).
  - Filter by level and tag, and limit the number of cards.
  - Gestures: **tap** flips · **swipe right** = know · **swipe left** = don't know · **swipe down** = edit card. A **Notes** button on both sides of the card reveals its notes.
  - Keyboard: Space flips · → know · ← don't know · E edits · Esc finishes.
- **Import / export**
  - JSON backup of the whole library (with progress), for moving to another device. Merge or replace on import.
  - CSV/TSV per deck: `front,back,tags,notes` with tags separated by `|` (tags and notes optional). Handy for writing cards in Excel or Google Sheets on a PC.
- English and Ukrainian UI, light and dark theme, works offline.

## Install on a phone

**iPhone (Safari):** open the link → Share → **Add to Home Screen**.

> ⚠️ On iOS the home-screen app has **its own storage, separate from Safari**. Install the app first, then add your cards inside it. To move data, use Settings → Export library / Import backup.

**Android (Chrome):** open the link → *Install app* (or use the Install button in the app).

## CSV format

```csv
front,back,tags,notes
食べる,to eat,verb|N5,ichidan verb
水,water,noun,
おはようございます,good morning,phrase,polite
```

The header row is optional. Comma, tab and semicolon separators are all detected automatically.

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run check      # svelte-check / TypeScript
npm run build      # production build into dist/
npm run preview    # serve the build at http://localhost:4173/flashcards-pwa/
```

Stack: Svelte 5 + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa (Workbox), PapaParse.

Pure logic lives in `src/lib/{learning,session,gestures}.ts` and `src/lib/io/{csv,json}.ts`, with tests in `tests/`.

Icons are generated from `public/icon.svg` with `npx pwa-assets-generator`.

## Deploy

Every push to `main` runs tests, builds, and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

One-time setup: **GitHub repo → Settings → Pages → Source: GitHub Actions**. If you rename the repo, update `base` in `vite.config.ts` and the icon paths in `index.html`.
