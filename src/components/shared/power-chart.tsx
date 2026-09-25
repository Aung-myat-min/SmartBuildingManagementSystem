"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * The estate's load profile across a day.
 *
 * One series, so no legend — the caption above it names the measure. Bars
 * rather than a line because each one is an hour's magnitude and the reader's
 * job is to compare them, not to trace a path.
 *
 * The 4px rounded top is the data end; the baseline end stays square, anchored
 * to the axis.
 */
export function PowerChart({
  values,
  height = 96,
}: {
  /** One value per hour, oldest first. */
  values: number[];
  height?: number;
}) {
  const reduced = useReducedMotion();
  const now = new Date();
  const data = values.map((kw, i) => {
    const hoursAgo = values.length - 1 - i;
    const at = new Date(now.getTime() - hoursAgo * 3_600_000);
    return { hour: at.getHours(), kw };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--rule)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
          stroke="var(--rule)"
          tickLine={false}
          interval={5}
          tickFormatter={(h: number) => `${String(h).padStart(2, "0")}:00`}
        />
        <YAxis hide domain={[0, "dataMax"]} />
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as
              | { hour: number; kw: number }
              | undefined;
            if (!active || !row) return null;
            return (
              <div className="border-border bg-card rounded border px-2 py-1.5 shadow-sm">
                <div className="font-mono text-[11px] font-semibold tabular-nums">
                  {row.kw.toLocaleString()} kW
                </div>
                <div className="text-muted-foreground text-[10px]">
                  {String(row.hour).padStart(2, "0")}:00
                </div>
              </div>
            );
          }}
        />
        <Bar
          dataKey="kw"
          fill="var(--primary)"
          fillOpacity={0.7}
          radius={[3, 3, 0, 0]}
          isAnimationActive={!reduced}
          animationDuration={240}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
