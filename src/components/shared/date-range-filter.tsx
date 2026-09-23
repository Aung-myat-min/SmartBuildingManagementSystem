"use client";

import { CalendarRange, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  /** Inclusive lower bound, as the native input's own string. Empty = open. */
  from: string;
  /** Inclusive upper bound. Empty = open. */
  to: string;
}

export const EMPTY_RANGE: DateRange = { from: "", to: "" };

/**
 * From/to bounds on a toolbar. Native date inputs, so the platform's own
 * calendar and keyboard handling come free and an empty value is an open end.
 * `withTime` switches to datetime-local where the hour matters — a Log Book
 * shift does, a report's generation day does not.
 */
export function DateRangeFilter({
  value,
  onChange,
  withTime = false,
  label = "Between",
  className,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  withTime?: boolean;
  label?: string;
  className?: string;
}) {
  const type = withTime ? "datetime-local" : "date";
  const active = value.from !== "" || value.to !== "";

  return (
    <div
      className={cn(
        // The inputs carry outline-none, so the box around them shows the
        // focus. Without this, tabbing into a date range was invisible.
        "focus-ring-within interactive border-input bg-card flex shrink-0 items-center gap-1.5 rounded border px-2 py-1",
        active && "border-primary",
        className,
      )}
    >
      <CalendarRange className="text-muted-foreground size-3.25 shrink-0" />
      <span className="text-muted-foreground shrink-0 font-mono text-[10px] tracking-[0.06em] uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value.from}
        max={value.to || undefined}
        aria-label={`${label} — from`}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="text-neutral-foreground min-w-0 bg-transparent py-1 text-[11.5px] font-medium outline-none"
      />
      <span className="text-muted-foreground shrink-0 text-[11px]">→</span>
      <input
        type={type}
        value={value.to}
        min={value.from || undefined}
        aria-label={`${label} — to`}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="text-neutral-foreground min-w-0 bg-transparent py-1 text-[11.5px] font-medium outline-none"
      />
      {active && (
        <button
          type="button"
          title="Clear the date range"
          onClick={() => onChange(EMPTY_RANGE)}
          className="interactive focus-ring text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Whether a timestamp sits inside the range. Both ends are optional, and the
 * upper one is inclusive of the whole day when no time was given — a reader
 * picking "to 09 Sept" means the end of the 9th, not its first instant.
 */
export function withinRange(iso: string, range: DateRange): boolean {
  const at = new Date(iso).getTime();
  if (range.from) {
    if (at < new Date(range.from).getTime()) return false;
  }
  if (range.to) {
    const end = new Date(range.to);
    if (!range.to.includes("T")) end.setHours(23, 59, 59, 999);
    if (at > end.getTime()) return false;
  }
  return true;
}
