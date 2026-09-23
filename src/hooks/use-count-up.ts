"use client";

import * as React from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/** How long a number takes to travel to its new value. */
const DURATION_MS = 420;

/**
 * A number that walks to its new value instead of snapping to it.
 *
 * A KPI that jumps from 7 to 5 says nothing about which way it went; one that
 * counts says it fell. It animates on change only — the first value is shown
 * as it is, so a page does not open by counting every tile up from zero.
 *
 * Returns the live value; the caller decides how to write it. With reduced
 * motion, or a value that is not finite, it is the value itself.
 */
export function useCountUp(value: number, decimals = 0): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(value);
  // Where the next run starts from. Tracked every frame rather than only on
  // completion, so a value that changes mid-flight carries on from where the
  // number actually is instead of jumping back to the last finished one.
  const at = React.useRef(value);
  const frame = React.useRef(0);

  React.useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      at.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    const origin = at.current;
    const factor = 10 ** decimals;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      // Ease out, matching --ease-out-soft closely enough for a number.
      const eased = 1 - (1 - t) ** 3;
      at.current = origin + (value - origin) * eased;
      setShown(Math.round(at.current * factor) / factor);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, decimals, reduced]);

  return shown;
}
