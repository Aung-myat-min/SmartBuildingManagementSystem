"use client";

import * as React from "react";
import { formatClock } from "@/lib/format";

/**
 * The wall clock, ticking, but only after mount.
 *
 * Reading the time during render makes the prerendered HTML and the first
 * client render disagree by a second, which fails hydration. Callers render
 * the placeholder until the first tick arrives.
 */
export function useLiveClock(): string | null {
  const [clock, setClock] = React.useState<string | null>(null);

  React.useEffect(() => {
    const tick = () => setClock(formatClock());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return clock;
}
