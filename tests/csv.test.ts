import { describe, expect, it } from 'vitest';
import { groupByDeck, parseCsv, splitGroups, splitTags, toCsv, type CsvRow } from '../src/lib/io/csv';

describe('parseCsv', () => {
  it('parses comma separated with auto header and tags', () => {
    const r = parseCsv('front,back,tags\n食べる,to eat,verb|N5\n水,water,noun\n');
    expect(r.header).toBe(true);
    expect(r.delimiter).toBe(',');
    expect(r.rows).toEqual([
      { front: '食べる', back: 'to eat', tags: ['verb', 'N5'], notes: '' },
      { front: '水', back: 'water', tags: ['noun'], notes: '' },
    ]);
  });
  it('detects tabs and handles BOM without header', () => {
    const r = parseCsv('﻿ねこ\tcat\nいぬ\tdog');
    expect(r.header).toBe(false);
    expect(r.delimiter).toBe('\t');
    expect(r.rows.map((x) => x.front)).toEqual(['ねこ', 'いぬ']);
  });
  it('detects semicolons', () => {
    expect(parseCsv('a;b\nc;d').delimiter).toBe(';');
  });
  it('handles quoted cells with commas and newlines', () => {
    const r = parseCsv('"hello, world","line1\nline2"');
    expect(r.rows[0]).toEqual({ front: 'hello, world', back: 'line1\nline2', tags: [], notes: '' });
  });
  it('reads notes from the fourth column', () => {
    expect(parseCsv('front,back,tags,notes\nx,y,,"e.g. x-ray"').rows[0].notes).toBe('e.g. x-ray');
  });
  it('respects explicit header option and skips empty rows', () => {
    const r = parseCsv('front,back\n,,verb\nx,y', { header: false });
    expect(r.rows).toHaveLength(2);
    expect(r.skipped).toBe(1);
  });
});

describe('splitTags', () => {
  it('trims and dedupes case-insensitively', () => expect(splitTags(' verb | Verb |  | N5')).toEqual(['verb', 'N5']));
});

describe('toCsv', () => {
  it('round-trips', () => {
    const rows = [{ front: 'a,"b"', back: '日本', tags: ['x', 'y'], notes: 'line1\nline2' }];
    const text = toCsv(rows);
    expect(text.startsWith('﻿')).toBe(true);
    expect(parseCsv(text).rows).toEqual(rows);
  });
});

describe('collection CSV', () => {
  it('round-trips the deck column', () => {
    const rows = [
      { front: '水', back: 'вода', tags: ['N5'], notes: '', deck: 'Слова, базові' },
      { front: 'a', back: 'b', tags: [], notes: 'n', deck: 'Verbs "go"' },
    ];
    const text = toCsv(rows, { withDeck: true });
    expect(text.split('\r\n')[0]).toBe('﻿front,back,tags,notes,deck');
    expect(parseCsv(text).rows).toEqual(rows);
  });
  it('leaves deck out of four-column files', () => {
    expect(parseCsv('x,y,,').rows[0]).not.toHaveProperty('deck');
    expect(toCsv([{ front: 'x', back: 'y', tags: [], notes: '', deck: 'D' }])).not.toContain('deck');
  });
});

describe('groupByDeck', () => {
  it('groups in first-seen order, case-insensitively, with a fallback', () => {
    const r = (front: string, deck?: string) => ({ front, back: '', tags: [], notes: '', ...(deck ? { deck } : {}) });
    const groups = groupByDeck([r('1', 'B'), r('2'), r('3', 'A'), r('4', 'b')], 'File');
    expect(groups.map((g) => [g.name, g.rows.map((x) => x.front)])).toEqual([
      ['B', ['1', '4']],
      ['File', ['2']],
      ['A', ['3']],
    ]);
  });
});

describe('splitGroups', () => {
  const r = (front: string): CsvRow => ({ front, back: '', tags: [], notes: '' });
  const rows = (n: number) => Array.from({ length: n }, (_, i) => r(String(i)));

  it('keeps groups that fit and splits the rest into numbered decks', () => {
    const groups = splitGroups([{ name: 'Small', rows: rows(3) }, { name: 'Big', rows: rows(7) }], 3);
    expect(groups.map((g) => [g.name, g.rows.length])).toEqual([['Small', 3], ['Big', 3], ['Big 2', 3], ['Big 3', 1]]);
    expect(groups.slice(1).flatMap((g) => g.rows.map((x) => x.front))).toEqual(rows(7).map((x) => x.front));
  });
});
