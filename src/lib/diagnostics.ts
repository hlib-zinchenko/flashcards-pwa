/** Error log and the "Copy diagnostics" report, so users can send what went wrong. */

export interface ErrorEntry {
  at: number;
  message: string;
}

/** Errors kept on the device, newest last. */
export const MAX_ERRORS = 10;
const MAX_MESSAGE = 1500;
const STACK_LINES = 6;

/** A readable one-entry description of anything thrown or rejected. */
export function describeError(reason: unknown): string {
  let text: string;
  if (reason instanceof Error) {
    const head = `${reason.name}: ${reason.message}`;
    const stack = (reason.stack ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith(head) && l !== reason.name)
      .slice(0, STACK_LINES);
    text = [head, ...stack].join('\n');
  } else if (typeof reason === 'string') {
    text = reason;
  } else {
    try {
      text = JSON.stringify(reason) ?? String(reason);
    } catch {
      text = String(reason);
    }
  }
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}…` : text;
}

/** Browser noise that isn't a bug in the app and shouldn't alarm anyone. */
export function isIgnorable(message: string): boolean {
  return (
    message.includes('ResizeObserver loop') ||
    // Errors from cross-origin scripts (extensions) arrive with no details.
    message === 'Script error.' ||
    message === 'Script error' ||
    // The user cancelled a share sheet or file picker.
    message.startsWith('AbortError')
  );
}

/** Append an entry, keeping only the latest `MAX_ERRORS`. */
export function pushError(log: readonly ErrorEntry[], entry: ErrorEntry): ErrorEntry[] {
  return [...log, entry].slice(-MAX_ERRORS);
}

/** Keep the well-formed entries of a saved log. */
export function parseErrorLog(raw: unknown): ErrorEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is ErrorEntry => !!e && typeof e.at === 'number' && typeof e.message === 'string')
    .slice(-MAX_ERRORS);
}

export interface DiagnosticsInfo {
  version: string;
  now: number;
  userAgent: string;
  language: string;
  standalone: boolean;
  screen: string;
  decks: number | null;
  cards: number | null;
  errors: readonly ErrorEntry[];
}

/** Plain text to paste into an email or a GitHub issue. Has no card content. */
export function diagnosticsText(info: DiagnosticsInfo): string {
  const count = (n: number | null) => (n === null ? 'unknown' : String(n));
  const lines = [
    `Flashcards ${info.version}`,
    `Time: ${new Date(info.now).toISOString()}`,
    `User agent: ${info.userAgent}`,
    `Language: ${info.language}`,
    `Installed: ${info.standalone ? 'yes' : 'no'}`,
    `Screen: ${info.screen}`,
    `Library: ${count(info.decks)} decks, ${count(info.cards)} cards`,
    '',
  ];
  if (info.errors.length === 0) {
    lines.push('No errors recorded.');
  } else {
    lines.push(`Recent errors (${info.errors.length}), newest last:`);
    for (const e of info.errors) lines.push('', `[${new Date(e.at).toISOString()}]`, e.message);
  }
  return lines.join('\n');
}
