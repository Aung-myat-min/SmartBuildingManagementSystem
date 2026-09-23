// Stagger, as a number rather than a per-page guess.
//
// A list that arrives all at once reads as a repaint; one that arrives in
// order reads as a list. The only interesting part is the cap: a 200-row Log
// Book staggered at 20ms a row would take four seconds to finish appearing,
// which is a list you have to wait for. Past the cap every remaining row
// arrives together, because nobody is reading row 40 yet anyway.

/** Delay between one row and the next. */
const STEP_MS = 22;

/** Rows past this one share the last delay. */
const MAX_STEPS = 12;

/** The animation delay for row `index`, in milliseconds. */
export function staggerMs(index: number): number {
  return Math.min(Math.max(index, 0), MAX_STEPS) * STEP_MS;
}

/**
 * The inline style for a staggered row, used with `animate-sb-rise`.
 * `backwards` on the animation holds the row hidden through its delay — it is
 * on the token in `globals.css`, so a caller cannot forget it.
 */
export function staggerStyle(index: number): { animationDelay: string } {
  return { animationDelay: `${staggerMs(index)}ms` };
}
