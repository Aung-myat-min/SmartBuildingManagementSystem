import type * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

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
