"use client";

import * as React from "react";

/**
 * Whether the viewer has asked for less motion.
 *
 * `globals.css` already honours the preference for CSS animations and
 * transitions. This is for the motion CSS cannot reach — a number counting up
 * is JavaScript, and has to be told to skip to the end.
 *
 * False until mount, so the server and the client agree on the first render.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  return reduced;
}
