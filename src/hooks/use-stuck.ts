"use client";

import * as React from "react";

/**
 * Whether a sticky element has left its place in the flow.
 *
 * A sticky toolbar that looks identical whether it is in the page or pinned
 * over it is confusing — you cannot tell what is scrolling. The answer is a
 * shadow, and this is what says when to draw it.
 *
 * It watches a zero-height sentinel placed just above the sticky element
 * rather than listening to scroll. A scroll listener on every list page is how
 * a dashboard gets janky; an observer costs nothing while the page sits still.
 *
 * Returns the ref for the sentinel and whether the element above it is pinned.
 */
export function useStuck(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = React.useState(false);

  React.useEffect(() => {
    const el = sentinel.current;
    if (!el) return;

    // The sentinel disappears under the app header, not the viewport edge, so
    // the margin is the header's own height — read from the token rather than
    // repeated as 54.
    const header = getComputedStyle(document.documentElement)
      .getPropertyValue("--header-h")
      .trim();

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: `-${header || "54px"} 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [sentinel, stuck];
}
