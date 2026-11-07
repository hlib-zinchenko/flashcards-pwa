import { decksHome } from './collections';
import { loadPref, savePref } from './prefs';

export type Route =
  | { name: 'decks' }
  | { name: 'collection'; id: string }
  | { name: 'deck'; id: string }
  | { name: 'test' }
  | { name: 'run' }
  | { name: 'settings' };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const collection = path.match(/^\/collection\/([^/]+)$/);
  if (collection) return { name: 'collection', id: decodeURIComponent(collection[1]) };
  const deck = path.match(/^\/deck\/([^/]+)$/);
  if (deck) return { name: 'deck', id: decodeURIComponent(deck[1]) };
  if (path === '/test') return { name: 'test' };
  if (path === '/test/run') return { name: 'run' };
  if (path === '/settings') return { name: 'settings' };
  return { name: 'decks' };
}

/** Collection opened last; the Decks tab and a fresh launch go there. Remembered across launches. */
export const lastCollection = $state({ id: loadPref<string | null>('lastCollection', null) });

export function rememberCollection(id: string | null): void {
  if (lastCollection.id === id) return;
  lastCollection.id = id;
  savePref('lastCollection', id);
}

// A fresh launch (no hash: the home-screen icon, or typing the address) opens the last collection.
// An explicit "#/" (the collection screen's back button) still shows the list.
if (!location.hash.replace(/^#/, '')) history.replaceState(null, '', `#${decksHome(lastCollection.id)}`);

export const router = $state({ route: parse(location.hash) });

window.addEventListener('hashchange', () => {
  router.route = parse(location.hash);
  window.scrollTo(0, 0);
});

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) {
    history.replaceState(null, '', `#${path}`);
    router.route = parse(location.hash);
  } else {
    location.hash = path;
  }
}

export const href = (path: string): string => `#${path}`;

// Search to start the next deck screen with (set by the collection's word search). Read once.
let pendingDeckQuery = '';

/** Open a deck with its card list already searched for `query`. */
export function openDeck(id: string, query: string): void {
  pendingDeckQuery = query;
  navigate(`/deck/${id}`);
}

export function takeDeckQuery(): string {
  const query = pendingDeckQuery;
  pendingDeckQuery = '';
  return query;
}
