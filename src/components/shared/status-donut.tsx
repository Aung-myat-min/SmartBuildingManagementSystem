"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { toneIcon } from "@/components/shared/tone-badge";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  label: string;
  value: number;
  tone: Tone;
}

/**
 * How the estate splits across states, and the total in the middle.
 *
 * A donut is the right form here and is usually the wrong one, so the reason:
 * this is part-to-whole read at a glance, four segments, and the segments are
 * states rather than series. It is *not* for comparing close values — that is
 * what the legend beside it is for, which carries the count and the share as
 * numbers, because nobody reads a 17% arc off a ring.
 *
 * Every slice is labelled in that legend. The app's amber and green measure
 * ΔE 6.2 apart under protanopia, so the words carry the difference and the
 * colour only reinforces it.
 */
export function StatusDonut({
  slices,
  centreLabel,
  size = 132,
}: {
  slices: DonutSlice[];
  /** What the total in the hole is counting — "rooms", "devices". */
  centreLabel: string;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const shown = slices.filter((s) => s.value > 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              innerRadius="64%"
              outerRadius="100%"
              // A 2px gap in the surface colour between segments, rather than a
              // stroke around each one.
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={!reduced}
              animationDuration={240}
            >
              {shown.map((s) => (
                <Cell key={s.label} fill={TONE_VAR[s.tone]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[22px] leading-none font-semibold tabular-nums">
            {total}
          </span>
          <span className="text-muted-foreground mt-0.5 text-[10px]">
            {centreLabel}
          </span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-1.25">
        {slices.map((s) => {
          const Icon = toneIcon(s.tone);
          return (
            <li key={s.label} className="flex items-center gap-2 text-[11.5px]">
              {/* Icon as well as colour. A legend is where a status has to be
                readable by someone who cannot tell the amber from the green,
                and the two sit 6.2 ΔE apart under protanopia. */}
              <Icon
                aria-hidden
                className={cn("size-3 shrink-0", TONE_INK[s.tone])}
              />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="font-mono font-medium tabular-nums">
                {s.value}
              </span>
              <span className="text-muted-foreground w-9 text-right font-mono text-[10.5px] tabular-nums">
                {total === 0 ? "—" : `${Math.round((s.value / total) * 100)}%`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const TONE_VAR: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--muted-foreground)",
};

const TONE_INK: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-muted-foreground",
};
