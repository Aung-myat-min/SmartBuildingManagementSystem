"use client";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The shape every "this is not the page you wanted" screen takes: a code, a
 * line saying what happened, a line saying what to do, and the way out.
 *
 * Shared so a 404, a crash and a refusal look like the same application
 * rather than three different ones. The tone picks the accent — a missing page
 * is not an error and should not be red.
 */
export function StatusScreen({
  icon: Icon,
  code,
  title,
  body,
  tone = "neutral",
  children,
  className,
}: {
  icon: LucideIcon;
  /** The short machine-facing label: 404, 403, Error. */
  code: string;
  title: string;
  body: React.ReactNode;
  tone?: "neutral" | "warning" | "danger";
  /** The actions. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center px-5 py-16",
        className,
      )}
    >
      <div
        className={cn(
          "border-border bg-card w-full max-w-105 rounded-md border border-t-[3px] p-7 text-center",
          TONE_TOP[tone],
        )}
      >
        <Icon className={cn("mx-auto size-8", TONE_ICON[tone])} />
        <div className="text-muted-foreground mt-3.5 font-mono text-[10px] tracking-[0.06em] uppercase">
          {code}
        </div>
        <div className="mt-1.5 text-[14px] font-semibold">{title}</div>
        <p className="text-muted-foreground mt-2 text-[12.5px] leading-relaxed">
          {body}
        </p>
        {children && (
          <div className="mt-4.5 flex flex-wrap justify-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

const TONE_TOP = {
  neutral: "border-t-border",
  warning: "border-t-warning",
  danger: "border-t-danger",
} as const;

const TONE_ICON = {
  neutral: "text-muted-foreground",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
} as const;
