"use client";

import { cn } from "@/lib/utils";

/**
 * The application's one loading animation.
 *
 * A ring that turns while the arc inside it grows and shrinks — the two run at
 * different lengths (2s and 1.4s) so they drift out of phase and it never
 * looks like a short loop repeating.
 *
 * Hand-drawn SVG, as the sparkline and the power bars are. A spinner is two
 * circles and two keyframes; it does not need a dependency.
 *
 * It inherits `currentColor`, so it takes the tone of whatever it sits in — a
 * primary button, a muted panel, a danger banner — without a tone prop.
 */
export function Loader({
  size = "sm",
  className,
  label,
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /**
   * What is being waited for, for a screen reader. A loader inside a button
   * whose label already says "Saving…" leaves this off — announcing it twice
   * is worse than not at all.
   */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("animate-sb-spin shrink-0", SIZE[size], className)}
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE[size]}
        className="opacity-15"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE[size]}
        strokeLinecap="round"
        className="animate-sb-arc"
      />
    </svg>
  );
}

const SIZE = {
  xs: "size-3",
  sm: "size-4",
  md: "size-7",
  lg: "size-10",
} as const;

/** Thinner as it grows, so a large ring does not read as a donut. */
const STROKE = { xs: 3.5, sm: 3, md: 2.5, lg: 2 } as const;

/**
 * A whole area waiting: the ring, and a line saying what for.
 *
 * Used wherever the app has nothing to show yet — the auth gate, the wait for
 * the first Firestore snapshots, the gap before a route module arrives. Before
 * this all three of those were a static line of grey text in the middle of an
 * otherwise empty page, which reads as a page that has finished loading and is
 * empty.
 */
export function PageLoader({
  note,
  className,
}: {
  note: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3.5",
        className,
      )}
    >
      <Loader size="md" className="text-primary" label={note} />
      <span className="text-muted-foreground text-[12px]">{note}</span>
    </div>
  );
}
