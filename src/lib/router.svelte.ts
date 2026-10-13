export type Route =
  | { name: 'decks' }
  | { name: 'deck'; id: string }
  | { name: 'test' }
  | { name: 'run' }
  | { name: 'settings' };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const deck = path.match(/^\/deck\/([^/]+)$/);
  if (deck) return { name: 'deck', id: decodeURIComponent(deck[1]) };
  if (path === '/test') return { name: 'test' };
  if (path === '/test/run') return { name: 'run' };
  if (path === '/settings') return { name: 'settings' };
  return { name: 'decks' };
}

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
