import { describe, expect, it } from 'vitest';
import { parseSavedRun, SAVED_RUN_MAX_AGE, savedRemaining, type SavedRun } from '../src/lib/savedRun';
import { Session } from '../src/lib/session';
import { seeded } from './helpers';

describe('Session.state / Session.restore', () => {
  it('carries on exactly where it was left', () => {
    const a = new Session(['a', 'b', 'c', 'd'], 'cram', { rng: seeded(1) });
    a.grade(false);
    a.grade(true);
    const b = Session.restore(JSON.parse(JSON.stringify(a.state())), { rng: seeded(2) });
    expect(b.current).toBe(a.current);
    expect(b.pool).toEqual(a.pool);
    expect(b.answered).toBe(2);
    expect(b.knownCount).toBe(1);
    expect([...b.learned]).toEqual([...a.learned]);
    expect([...b.missed]).toEqual([...a.missed]);
    expect(b.remaining).toBe(a.remaining);
    expect(b.canUndo).toBe(false);
    const order = (s: Session) => {
      const ids: string[] = [];
      while (!s.done) {
        ids.push(s.current!);
        s.grade(true);
      }
      return ids;
    };
    expect(order(b)).toEqual(order(a));
  });

  it('keeps the mode', () => {
    const s = new Session(['a', 'b'], 'refresh');
    s.grade(false);
    const r = Session.restore(s.state());
    expect(r.mode).toBe('refresh');
    expect(r.completed).toBe(1);
  });
});

describe('parseSavedRun', () => {
  const now = 1_000_000_000_000;
  const valid = (): SavedRun => {
    const s = new Session(['a', 'b', 'c'], 'cram', { rng: seeded(3) });
    s.grade(true);
    return { savedAt: now - 1000, origin: '/test', direction: 'back', session: s.state(), startLevels: [['a', 0], ['b', 2], ['c', 5]], counted: true };
  };

  it('accepts a saved session', () => expect(parseSavedRun(valid(), now)).toEqual(valid()));
  it('rejects garbage', () => {
    for (const raw of [null, 1, 'x', [], {}]) expect(parseSavedRun(raw, now)).toBeNull();
  });
  it('rejects an old one', () => expect(parseSavedRun({ ...valid(), savedAt: now - SAVED_RUN_MAX_AGE - 1 }, now)).toBeNull());
  it('rejects a finished one', () => {
    const run = valid();
    expect(parseSavedRun({ ...run, session: { ...run.session, current: null } }, now)).toBeNull();
  });
  it('rejects a bad session', () => {
    const run = valid();
    expect(parseSavedRun({ ...run, session: { ...run.session, mode: 'learn' } }, now)).toBeNull();
    expect(parseSavedRun({ ...run, session: { ...run.session, queue: [1] } }, now)).toBeNull();
    expect(parseSavedRun({ ...run, direction: 'up' }, now)).toBeNull();
    expect(parseSavedRun({ ...run, origin: 'http://evil' }, now)).toBeNull();
  });
  it('drops bad start levels and defaults counted', () => {
    const { counted: _, ...run } = valid();
    const parsed = parseSavedRun({ ...run, startLevels: [['a', 1], ['b', 9], 'c'] }, now)!;
    expect(parsed.startLevels).toEqual([['a', 1]]);
    expect(parsed.counted).toBe(false);
  });
  it('counts what is left', () => {
    expect(savedRemaining(valid())).toBe(2);
    const s = new Session(['a', 'b', 'c'], 'refresh');
    s.grade(false);
    expect(savedRemaining({ ...valid(), session: s.state() })).toBe(2);
  });
});
