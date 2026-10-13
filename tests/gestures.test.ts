import { describe, expect, it } from 'vitest';
import { classifyGesture, lockAxis } from '../src/lib/gestures';

const base = { width: 300, height: 400, dt: 300 };

describe('lockAxis', () => {
  it('waits for enough movement', () => expect(lockAxis(5, -6)).toBeNull());
  it('picks the dominant axis', () => {
    expect(lockAxis(20, 12)).toBe('x');
    expect(lockAxis(-4, 15)).toBe('y');
  });
});

describe('classifyGesture', () => {
  it('detects taps', () => {
    expect(classifyGesture({ ...base, dx: 2, dy: 3, axis: null })).toBe('tap');
    expect(classifyGesture({ ...base, dx: 2, dy: 3, dt: 900, axis: null })).toBe('cancel');
  });
  it('commits horizontal swipes past 30% of width', () => {
    expect(classifyGesture({ ...base, dx: 100, dy: 10, axis: 'x' })).toBe('right');
    expect(classifyGesture({ ...base, dx: -100, dy: 10, axis: 'x' })).toBe('left');
    expect(classifyGesture({ ...base, dx: 60, dy: 0, axis: 'x' })).toBe('cancel');
  });
  it('commits fast flicks', () => {
    expect(classifyGesture({ ...base, dx: -50, dy: 0, dt: 60, axis: 'x' })).toBe('left');
    expect(classifyGesture({ ...base, dx: 0, dy: 50, dt: 60, axis: 'y' })).toBe('down');
  });
  it('only reacts to downward vertical swipes', () => {
    expect(classifyGesture({ ...base, dx: 0, dy: 120, axis: 'y' })).toBe('down');
    expect(classifyGesture({ ...base, dx: 0, dy: -200, axis: 'y' })).toBe('cancel');
    expect(classifyGesture({ ...base, dx: 0, dy: 50, axis: 'y' })).toBe('cancel');
  });
});
