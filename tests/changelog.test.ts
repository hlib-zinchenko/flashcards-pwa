import { describe, expect, it } from 'vitest';
import { CHANGELOG, compareVersions, MAX_ENTRIES, notesToShow, type ChangelogEntry } from '../src/lib/changelog';

const log: ChangelogEntry[] = ['0.10.0', '0.9.0', '0.8.1', '0.8.0'].map((version) => ({ version, en: [version], uk: [version] }));
const versions = (entries: ChangelogEntry[]) => entries.map((e) => e.version);

describe('compareVersions', () => {
  it('compares numerically, not as strings', () => {
    expect(compareVersions('0.10.0', '0.9.2')).toBeGreaterThan(0);
    expect(compareVersions('0.4.1', '0.4.1')).toBe(0);
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
  });
});

describe('CHANGELOG', () => {
  it('keeps only the latest releases, newest first', () => {
    expect(CHANGELOG.length).toBeLessThanOrEqual(MAX_ENTRIES);
    const v = versions(CHANGELOG);
    expect(v).toEqual([...v].sort((a, b) => compareVersions(b, a)));
  });
});

describe('notesToShow', () => {
  it('shows every version since the last one seen, newest first', () => {
    expect(versions(notesToShow('0.8.0', '0.10.0', true, log))).toEqual(['0.10.0', '0.9.0', '0.8.1']);
  });

  it('shows nothing when the version has not changed', () => {
    expect(notesToShow('0.10.0', '0.10.0', true, log)).toEqual([]);
  });

  it('skips entries newer than the running build', () => {
    expect(versions(notesToShow('0.8.0', '0.9.0', true, log))).toEqual(['0.9.0', '0.8.1']);
  });

  it('shows nothing when the update had no notes', () => {
    expect(notesToShow('0.10.0', '0.10.1', true, log)).toEqual([]);
  });

  it('shows nothing on a fresh install', () => {
    expect(notesToShow(null, '0.10.0', false, log)).toEqual([]);
  });

  it('shows the current notes to an existing user who never recorded a version', () => {
    expect(versions(notesToShow(null, '0.10.0', true, log))).toEqual(['0.10.0']);
  });
});
