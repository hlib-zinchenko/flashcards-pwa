import Papa from 'papaparse';

export interface CsvRow {
  front: string;
  back: string;
  /** Tag names (not ids) */
  tags: string[];
  notes: string;
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
    rows.push({ front, back, tags: splitTags(cells[2] ?? ''), notes: (cells[3] ?? '').trim() });
  }
  return { rows, delimiter: result.meta.delimiter, header, skipped };
}

/** CSV with a UTF-8 BOM so Excel detects the encoding (needed for Japanese, Cyrillic…). */
export function toCsv(rows: readonly CsvRow[]): string {
  return (
    '﻿' +
    Papa.unparse({
      fields: ['front', 'back', 'tags', 'notes'],
      data: rows.map((r) => [r.front, r.back, r.tags.join(TAG_SEPARATOR), r.notes]),
    })
  );
}
