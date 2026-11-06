import Papa from 'papaparse';
import type { Card, Tag } from '../types';

export interface CsvRow {
  front: string;
  back: string;
  /** Tag names (not ids) */
  tags: string[];
  notes: string;
  /** Deck name from the optional fifth column (collection files). */
  deck?: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  delimiter: string;
  /** Whether the first row was treated as a header. */
  header: boolean;
  /** Rows dropped because both sides were empty. */
  skipped: number;
}

export const TAG_SEPARATOR = '|';

const FRONT_HEADERS = ['front', 'question', 'term', 'word', 'лицьова', 'питання', 'слово', 'термін'];
const BACK_HEADERS = ['back', 'answer', 'definition', 'meaning', 'translation', 'зворотна', 'відповідь', 'переклад', 'значення'];

export function looksLikeHeader(cells: readonly string[]): boolean {
  const [a = '', b = ''] = cells.map((c) => c.trim().toLowerCase());
  return FRONT_HEADERS.includes(a) || BACK_HEADERS.includes(b);
}

export function splitTags(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(TAG_SEPARATOR)) {
    const name = raw.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

/** Parse CSV/TSV text. `header` undefined means auto-detect. */
export function parseCsv(text: string, opts: { header?: boolean } = {}): CsvParseResult {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    delimitersToGuess: [',', '\t', ';'],
    skipEmptyLines: 'greedy',
  });
  const data = result.data;
  const header = opts.header ?? (data.length > 0 && looksLikeHeader(data[0]));
  const rows: CsvRow[] = [];
  let skipped = 0;
  for (const cells of header ? data.slice(1) : data) {
    const front = (cells[0] ?? '').trim();
    const back = (cells[1] ?? '').trim();
    if (!front && !back) {
      skipped++;
      continue;
    }
    const row: CsvRow = { front, back, tags: splitTags(cells[2] ?? ''), notes: (cells[3] ?? '').trim() };
    const deck = (cells[4] ?? '').trim();
    if (deck) row.deck = deck;
    rows.push(row);
  }
  return { rows, delimiter: result.meta.delimiter, header, skipped };
}

/**
 * CSV with a UTF-8 BOM so Excel detects the encoding (needed for Japanese, Cyrillic…).
 * `withDeck` adds a fifth `deck` column, used when a whole collection is exported.
 */
export function toCsv(rows: readonly CsvRow[], opts: { withDeck?: boolean } = {}): string {
  const fields = ['front', 'back', 'tags', 'notes'];
  if (opts.withDeck) fields.push('deck');
  return (
    '﻿' +
    Papa.unparse({
      fields,
      data: rows.map((r) => {
        const cells = [r.front, r.back, r.tags.join(TAG_SEPARATOR), r.notes];
        if (opts.withDeck) cells.push(r.deck ?? '');
        return cells;
      }),
    })
  );
}

/** Cards as CSV rows; tag ids become names (unknown ids are dropped). */
export function cardRows(cards: readonly Card[], tagById: ReadonlyMap<string, Tag>, deck?: string): CsvRow[] {
  return cards.map((c) => {
    const row: CsvRow = {
      front: c.front,
      back: c.back,
      tags: c.tags.flatMap((tid) => tagById.get(tid)?.name ?? []),
      notes: c.notes ?? '',
    };
    if (deck) row.deck = deck;
    return row;
  });
}

export interface DeckGroup {
  name: string;
  rows: CsvRow[];
}

/** Split rows into decks by their `deck` name, in first-seen order. Rows without one go to `fallback`. */
export function groupByDeck(rows: readonly CsvRow[], fallback: string): DeckGroup[] {
  const groups = new Map<string, DeckGroup>();
  for (const row of rows) {
    const name = row.deck ?? fallback;
    const key = name.toLowerCase();
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { name, rows: [row] });
  }
  return [...groups.values()];
}
