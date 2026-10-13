export type Axis = 'x' | 'y';
export type Gesture = 'tap' | 'left' | 'right' | 'down' | 'cancel';

/** Movement (px) before the drag locks to an axis. */
export const AXIS_LOCK_PX = 10;
/** Max movement (px) that still counts as a tap. */
const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 500;
/** Fraction of card width/height needed to commit a slow swipe. */
const COMMIT_X = 0.3;
const COMMIT_Y = 0.25;
/** A fast flick commits once it travelled this far at this speed. */
const FLICK_MIN_PX = 40;
const FLICK_VELOCITY = 0.5; // px per ms

export function lockAxis(dx: number, dy: number): Axis | null {
  if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
}

export interface GestureInput {
  dx: number;
  dy: number;
  /** Duration in ms */
  dt: number;
  width: number;
  height: number;
  axis: Axis | null;
}

export function classifyGesture({ dx, dy, dt, width, height, axis }: GestureInput): Gesture {
  if (axis === null) {
    return Math.abs(dx) < TAP_SLOP_PX && Math.abs(dy) < TAP_SLOP_PX && dt < TAP_MAX_MS ? 'tap' : 'cancel';
  }
  const elapsed = Math.max(dt, 1);
  if (axis === 'x') {
    const dist = Math.abs(dx);
    const flick = dist >= FLICK_MIN_PX && dist / elapsed >= FLICK_VELOCITY;
    if (dist >= width * COMMIT_X || flick) return dx > 0 ? 'right' : 'left';
    return 'cancel';
  }
  // Vertical: only a downward swipe has a meaning (edit).
  if (dy <= 0) return 'cancel';
  const flick = dy >= FLICK_MIN_PX && dy / elapsed >= FLICK_VELOCITY;
  return dy >= height * COMMIT_Y || flick ? 'down' : 'cancel';
}
