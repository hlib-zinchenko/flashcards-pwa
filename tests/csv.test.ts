import { describe, expect, it } from 'vitest';
import { parseCsv, splitTags, toCsv } from '../src/lib/io/csv';

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
