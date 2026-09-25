"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { BandZone, ReadingPoint } from "@/lib/chart-data";
import { readingDomain } from "@/lib/chart-data";
import type { SensorTypeDef, Tone } from "@/lib/types";

/**
 * A sensor's readings, with its thresholds drawn behind them.
 *
 * The point of this chart over the strip it replaces: the bands are on the
 * **same axes as the data**. A separate scale asks the reader to hold two
 * pictures in their head and align them; a background region means "warm" is
 * simply the part of the chart the line is in.
 *
 * One series, so no legend — the title names it. The bands are the second
 * encoding and every one of them is labelled, which is not decoration: the
 * app's amber and green sit at ΔE 6.2 under protanopia, so the words are what
 * carry the difference for a reader who cannot see it.
 *
 * Colours are passed as `var(--success)` and friends rather than hex. Those
 * resolve inside SVG, and because `.dark` redefines them the chart follows the
 * theme with no JS. (`var(--color-success)` does *not* resolve — that is the
 * `@theme inline` layer, and the trap the two comments in records/reports warn
 * about.)
 */
export function ReadingChart({
  type,
  points,
  zones,
  mode,
  setpoint,
  height = 168,
  compact = false,
  keepInView,
}: {
  type: SensorTypeDef | undefined;
  points: ReadingPoint[];
  zones: BandZone[];
  /** Live readings are a measurement and curve; recorded ones are moments and step. */
  mode: "live" | "recorded";
  /** An HVAC setpoint, in the same unit as the series, so it shares the axis. */
  setpoint?: number;
  height?: number;
  /**
   * The card's default state: the shape of the reading and the band it is in,
   * with no axes, no ticks and no hover. At this size there is no room for
   * them and no question they answer — the number is printed above the chart,
   * and the full one is a click away.
   */
  compact?: boolean;
  /** A value that must stay on the axis even when the data never reaches it. */
  keepInView?: number;
}) {
  const reduced = useReducedMotion();
  const m = type?.measurement;
  const domain = readingDomain(type, points, setpoint ?? keepInView);
  const unit = m?.unit ?? "";
  const decimals = m?.decimals ?? 0;

  if (!m) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={points}
        margin={
          compact
            ? { top: 2, right: 2, bottom: 0, left: 2 }
            : { top: 6, right: 46, bottom: 2, left: 2 }
        }
      >
        {/* Solid hairlines, one shade off the surface. A dashed grid reads as
            a threshold or a projection, and this chart has real thresholds. */}
        {!compact && (
          <CartesianGrid
            stroke="var(--rule)"
            strokeWidth={1}
            vertical={false}
          />
        )}

        {zones.map((z) => {
          const tone =
            type?.statuses.find((st) => st.id === z.statusId)?.tone ??
            "neutral";
          const label =
            type?.statuses.find((st) => st.id === z.statusId)?.label ??
            z.statusId;
          return (
            <ReferenceArea
              key={z.statusId}
              y1={z.from}
              y2={z.to}
              fill={TONE_VAR[tone]}
              fillOpacity={0.09}
              stroke="none"
              ifOverflow="hidden"
              // Top-right of each band, with the setpoint's own label sent to
              // the opposite corner: a horizontal line's label and a band
              // label both centred on the right-hand edge landed on top of
              // each other the first time this drew.
              label={
                compact
                  ? undefined
                  : {
                      value: label,
                      position: "insideTopRight",
                      fill: "var(--muted-foreground)",
                      fontSize: 9,
                    }
              }
            />
          );
        })}

        {setpoint !== undefined && (
          <ReferenceLine
            y={setpoint}
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            label={
              compact
                ? undefined
                : {
                    value: `Setpoint ${setpoint} ${unit}`,
                    position: "insideBottomLeft",
                    fill: "var(--primary)",
                    fontSize: 9.5,
                  }
            }
          />
        )}

        <XAxis
          hide={compact}
          dataKey="at"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v: number) => formatTick(v, mode, points)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 9.5 }}
          stroke="var(--rule)"
          tickLine={false}
          minTickGap={44}
        />
        <YAxis
          hide={compact}
          domain={domain}
          width={34}
          tick={{ fill: "var(--muted-foreground)", fontSize: 9.5 }}
          stroke="var(--rule)"
          tickLine={false}
          tickFormatter={(v: number) => v.toFixed(0)}
        />

        {!compact && (
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ReadingPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="border-border bg-card rounded border px-2 py-1.5 shadow-sm">
                  <div className="font-mono text-[11px] font-semibold tabular-nums">
                    {point.value.toFixed(decimals)} {unit}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {new Date(point.at).toLocaleString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
              );
            }}
          />
        )}

        <Line
          type={mode === "live" ? "monotone" : "stepAfter"}
          dataKey="value"
          stroke="var(--foreground)"
          strokeWidth={compact ? 1.75 : 2}
          // No dot per point — a marker on every reading is noise at this
          // density. The hover state is where a single point gets one.
          dot={false}
          activeDot={{
            r: 4,
            fill: "var(--foreground)",
            stroke: "var(--card)",
            strokeWidth: 2,
          }}
          isAnimationActive={!reduced}
          animationDuration={240}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * A time label suited to the window being drawn.
 *
 * Live is two minutes wide, and at minute resolution every tick on it reads
 * the same thing — an axis saying "02:35 PM" five times is worse than no axis
 * — so it counts seconds. Recorded readings are clock events and always read
 * as clock time, even when the handful that exist happen to fall in the same
 * minute; `32:31` on a chart headed "24h" is a riddle. Past a day and a half
 * of span the date takes over.
 */
function formatTick(
  value: number,
  mode: "live" | "recorded",
  points: ReadingPoint[],
): string {
  const d = new Date(value);
  if (mode === "live") {
    return d.toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
  }
  const span =
    points.length > 1 ? points[points.length - 1].at - points[0].at : 0;
  if (span > 36 * 3_600_000) {
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Tone → the CSS variable that resolves inside SVG.
 *
 * The bare names, not the `--color-*` aliases: Tailwind v4's `@theme inline`
 * does not emit those as usable custom properties, which is why the hand-rolled
 * charts elsewhere map tones to utility classes instead.
 */
const TONE_VAR: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--muted-foreground)",
};
