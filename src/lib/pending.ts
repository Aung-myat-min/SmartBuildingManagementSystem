// Making a write visible.
//
// Firestore on a good connection answers in 40–80ms. That is faster than a
// person can read "Saving…", so the label appears and vanishes inside one
// frame or two: the button flickers and the eye reports that nothing happened.
// The fix is a floor, not a delay — a write that genuinely takes a second is
// not slowed by a millisecond, and a write that takes 50ms is held long enough
// to be seen.
//
// Pure, so the arithmetic is testable without a clock or a network.

/**
 * How long a pending state must be on screen to register as one. Below about
 * a quarter second a spinner reads as a glitch; much above half a second and
 * the app feels slow on purpose.
 */
export const PENDING_FLOOR_MS = 400;

/** How much longer a pending state must stay, given how long it has run. */
export function remainingFloor(
  elapsedMs: number,
  floorMs: number = PENDING_FLOOR_MS,
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return floorMs;
  return Math.max(0, floorMs - elapsedMs);
}

/**
 * Resolves with the promise's value, but never sooner than the floor.
 *
 * A rejection is **not** held back: an error should surface the moment it is
 * known. Waiting out a floor to show a failure is the one case where the delay
 * is just a delay.
 */
export async function withMinDuration<T>(
  work: Promise<T>,
  floorMs: number = PENDING_FLOOR_MS,
  now: () => number = () => Date.now(),
): Promise<T> {
  const started = now();
  const value = await work;
  const left = remainingFloor(now() - started, floorMs);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  return value;
}
