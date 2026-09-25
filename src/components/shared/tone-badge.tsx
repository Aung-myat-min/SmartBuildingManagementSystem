import {
  CircleCheck,
  CircleDashed,
  Info,
  type LucideIcon,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import type * as React from "react";
import type { Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

// The union lives in lib/types.ts so data modules can carry a tone without
// importing React; re-exported here because this is where callers reach for it.
export type { Tone };

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-muted text-success-foreground",
  warning: "bg-warning-muted text-warning-foreground",
  danger: "bg-danger-muted text-danger-foreground",
  info: "bg-info-muted text-info-foreground",
  neutral: "bg-neutral-muted text-neutral-foreground",
};

export function ToneBadge({
  tone,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[3px] px-1.5 py-1 font-mono text-[9.5px] leading-none font-medium tracking-wider uppercase",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function toneDotClass(tone: Tone): string {
  return (
    {
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-danger",
      info: "bg-info",
      neutral: "bg-neutral-foreground",
    } satisfies Record<Tone, string>
  )[tone];
}

/**
 * The glyph that goes with a tone.
 *
 * Status colour never carries meaning on its own: the app's amber and green
 * measure ΔE 6.2 apart under protanopia, so wherever a tone is the whole
 * message it ships as icon **and** word. This is that icon, in one place, so
 * "danger" does not become a different shape on a different screen.
 */
export const TONE_ICONS: Record<Tone, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: OctagonAlert,
  info: Info,
  neutral: CircleDashed,
};

export function toneIcon(tone: Tone): LucideIcon {
  return TONE_ICONS[tone];
}
