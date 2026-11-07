import { describe, expect, it } from 'vitest';
import { describeError, diagnosticsText, isIgnorable, MAX_ERRORS, parseErrorLog, pushError } from '../src/lib/diagnostics';

describe('describeError', () => {
  it('names the error and keeps a few stack lines', () => {
    const err = new TypeError('x is undefined');
    err.stack = 'TypeError: x is undefined\n  at a (app.js:1:1)\n  at b (app.js:2:2)';
    expect(describeError(err)).toBe('TypeError: x is undefined\nat a (app.js:1:1)\nat b (app.js:2:2)');
  });
  it('describes DOMExceptions like DataCloneError', () => {
    const err = new DOMException('could not be cloned', 'DataCloneError');
    expect(describeError(err)).toMatch(/^DataCloneError: could not be cloned/);
  });
  it('handles strings, objects and the unserializable', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError({ code: 1 })).toBe('{"code":1}');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(describeError(cyclic)).toBe('[object Object]');
    expect(describeError(undefined)).toBe('undefined');
  });
  it('cuts very long messages', () => expect(describeError('a'.repeat(5000)).length).toBeLessThan(1600));
});

describe('error log', () => {
  it('keeps only the latest entries', () => {
    let log = parseErrorLog(null);
    for (let i = 0; i < MAX_ERRORS + 3; i++) log = pushError(log, { at: i, message: `e${i}` });
    expect(log).toHaveLength(MAX_ERRORS);
    expect(log[0].message).toBe('e3');
  });
  it('drops malformed saved entries', () => expect(parseErrorLog([{ at: 1, message: 'x' }, { at: 'y' }, null])).toEqual([{ at: 1, message: 'x' }]));
  it('ignores browser noise', () => {
    expect(isIgnorable('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(isIgnorable('Script error.')).toBe(true);
    expect(isIgnorable('AbortError: Share canceled')).toBe(true);
    expect(isIgnorable('DataCloneError: x')).toBe(false);
  });
});

describe('diagnosticsText', () => {
  const info = { version: '1.2.3', now: 0, userAgent: 'UA', language: 'uk', standalone: true, screen: '390×844 @3x', decks: 2, cards: null, errors: [] };
  it('lists the device and library', () => {
    const text = diagnosticsText(info);
    expect(text).toContain('Flashcards 1.2.3');
    expect(text).toContain('Installed: yes');
    expect(text).toContain('Library: 2 decks, unknown cards');
    expect(text).toContain('No errors recorded.');
  });
  it('lists errors with times', () => {
    const text = diagnosticsText({ ...info, errors: [{ at: 0, message: 'TypeError: boom' }] });
    expect(text).toContain('[1970-01-01T00:00:00.000Z]\nTypeError: boom');
  });
});
