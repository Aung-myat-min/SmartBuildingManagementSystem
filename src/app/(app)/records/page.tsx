"use client";

import { Download, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Card } from "@/components/ui/card";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppState } from "@/lib/app-state";
import { formatDayLabel, formatTime } from "@/lib/format";
import {
  BUILDINGS,
  buildingName,
  HISTORICAL_RECORDS,
  roomLabel,
} from "@/lib/mock-data";
import { isBuildingLocked } from "@/lib/permissions";
import type { HistoricalRecordType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_META: Record<HistoricalRecordType, { label: string; tone: Tone }> = {
  alarm: { label: "ALARM", tone: "danger" },
  request: { label: "REQUEST", tone: "warning" },
  service: { label: "SERVICE", tone: "success" },
  access: { label: "ACCESS", tone: "info" },
  system: { label: "SYSTEM", tone: "neutral" },
};
/**
 * Tone -> a real utility class. Tailwind v4's `@theme inline` does not emit
 * every --color-* as a usable custom property, so `var(--color-danger)` in an
 * inline style resolved to nothing and those bars rendered transparent.
 */
const TONE_BG: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral-foreground",
};

const TONE_BORDER_L: Record<Tone, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-danger",
  info: "border-l-info",
  neutral: "border-l-neutral-foreground",
};

const TYPE_ORDER: HistoricalRecordType[] = [
  "alarm",
  "request",
  "service",
  "access",
  "system",
];
const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const DAY_MS = 86400000;

export default function HistoricalRecordsPage() {
  const { role, activeBuildingId } = useAppState();
  const locked = isBuildingLocked(role);

  const [range, setRange] = usePersistedState("records.range", 30);
  const [buildingFilter, setBuildingFilter] = React.useState(
    locked ? activeBuildingId : "all",
  );
  const [typeFilter, setTypeFilter] = React.useState<
    "all" | HistoricalRecordType
  >("all");
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(40);

  const effectiveBuilding = locked ? activeBuildingId : buildingFilter;
  const cutoff = Date.now() - range * DAY_MS;

  const filtered = HISTORICAL_RECORDS.filter((r) => {
    if (new Date(r.timestamp).getTime() < cutoff) return false;
    if (effectiveBuilding !== "all" && r.buildingId !== effectiveBuilding)
      return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${r.text} ${r.actorName} ${r.refId ?? ""} ${r.roomId ? roomLabel(r.roomId) : ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const kpis = [
    { label: "TOTAL RECORDS", value: filtered.length, tone: "text-foreground" },
    {
      label: "ALARMS",
      value: filtered.filter((r) => r.type === "alarm").length,
      tone: "text-danger-foreground",
    },
    {
      label: "REQUESTS",
      value: filtered.filter((r) => r.type === "request").length,
      tone: "text-warning-foreground",
    },
    {
      label: "AVG / DAY",
      value: Math.round((filtered.length / range) * 10) / 10,
      tone: "text-foreground",
    },
  ];

  const chartDays = Math.min(range, 14);
  const midnightToday = new Date().setHours(0, 0, 0, 0);
  const bars = Array.from({ length: chartDays }, (_, i) => {
    const dayStart = midnightToday - (chartDays - 1 - i) * DAY_MS;
    const dayLabel = new Date(dayStart).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
    const counts = Object.fromEntries(
      TYPE_ORDER.map((t) => [
        t,
        filtered.filter(
          (r) =>
            r.type === t &&
            new Date(r.timestamp).setHours(0, 0, 0, 0) === dayStart,
        ).length,
      ]),
    ) as Record<HistoricalRecordType, number>;
    const total = TYPE_ORDER.reduce((a, t) => a + counts[t], 0);
    return { key: dayStart, label: dayLabel, counts, total };
  });
  const maxTotal = Math.max(1, ...bars.map((b) => b.total));

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const r of filtered.slice(0, limit)) {
      const key = new Date(r.timestamp).toDateString();
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return Array.from(map.entries());
  }, [filtered, limit]);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
        <div className="border-input focus-within:border-primary bg-card flex min-w-45 flex-1 items-center gap-1.5 rounded border px-2">
          <Search className="text-muted-foreground size-3.25 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records, devices or people"
            className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none"
          />
        </div>
        <div className="bg-secondary flex items-center gap-1 rounded-md p-[3px]">
          {RANGES.map((r) => (
            <button
              type="button"
              key={r.days}
              onClick={() => setRange(r.days)}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[11px] font-medium",
                range === r.days
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={effectiveBuilding}
          onChange={(e) => setBuildingFilter(e.target.value)}
          disabled={locked}
          title={
            locked
              ? "Office Staff are scoped to their own building."
              : undefined
          }
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="all">All buildings</option>
          {BUILDINGS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="all">All types</option>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>
        <div className="bg-border h-5.5 w-px" />
        <ToneBadge tone="info">{filtered.length} in range</ToneBadge>
        {/*<div className="flex-1" />*/}
        <button
          type="button"
          onClick={() =>
            toast.info(
              `Exported ${filtered.length} records to CSV (demo only).`,
            )
          }
          className="border-border hover:border-primary hover:text-info-foreground flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium"
        >
          <Download className="size-3" /> Export CSV
        </button>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="gap-1 p-3.5">
            <div className="text-muted-foreground font-mono text-[10px] tracking-wider">
              {k.label}
            </div>
            <div
              className={cn(
                "font-mono text-[22px] leading-none font-semibold",
                k.tone,
              )}
            >
              {k.value}
            </div>
          </Card>
        ))}
      </div>

      <Card className="gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
            RECORDS PER DAY
          </span>
          <div className="flex gap-3">
            {TYPE_ORDER.map((t) => (
              <span
                key={t}
                className="text-muted-foreground flex items-center gap-1.5 text-[10.5px]"
              >
                <span
                  className={cn(
                    "size-2 rounded-sm",
                    TONE_BG[TYPE_META[t].tone],
                  )}
                />
                {TYPE_META[t].label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-26 items-end gap-1.5">
          {bars.map((b) => (
            <div
              key={b.key}
              title={`${b.label}: ${b.total} records`}
              className="flex flex-1 flex-col justify-end gap-0.5"
              style={{ height: "100%" }}
            >
              {TYPE_ORDER.filter((t) => b.counts[t] > 0).map((t) => (
                <div
                  key={t}
                  className={cn(
                    "w-full rounded-[2px]",
                    TONE_BG[TYPE_META[t].tone],
                  )}
                  style={{
                    height: `${(b.counts[t] / maxTotal) * 100}%`,
                    minHeight: 2,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="text-muted-foreground flex gap-1.5 font-mono text-[9.5px]">
          {bars.map((b) => (
            <span key={b.key} className="flex-1 text-center">
              {b.label}
            </span>
          ))}
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="bg-surface-subtle border-border text-muted-foreground flex border-b px-4 py-2 font-mono text-[10px] tracking-wider">
          <span className="w-16">TIME</span>
          <span className="w-29.5">TYPE</span>
          <span className="w-57.5">SOURCE</span>
          <span className="flex-1">RECORD</span>
          <span className="w-32">BY</span>
        </div>
        {grouped.length === 0 && (
          <EmptyState className="m-4">
            No records match these filters.
          </EmptyState>
        )}
        {grouped.map(([day, records]) => (
          <div key={day}>
            <div className="bg-surface-subtle border-border text-muted-foreground flex items-center gap-2 border-b px-4 py-1.5 text-[11px]">
              <span className="font-mono font-semibold">
                {formatDayLabel(records[0].timestamp)}
              </span>
              <span>· {records.length} records</span>
            </div>
            {records.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "border-rule flex items-center border-b border-l-[3px] px-4 py-2 text-[12px] last:border-b-0",
                  TONE_BORDER_L[TYPE_META[r.type].tone],
                )}
              >
                <span className="text-muted-foreground w-16 font-mono text-[11px]">
                  {formatTime(r.timestamp)}
                </span>
                <span className="w-29.5">
                  <ToneBadge tone={TYPE_META[r.type].tone}>
                    {TYPE_META[r.type].label}
                  </ToneBadge>
                </span>
                <span className="text-neutral-foreground w-57.5 truncate pr-2.5 text-[11.5px]">
                  {r.buildingId ? buildingName(r.buildingId) : "Estate-wide"}
                  {r.roomId ? ` / ${roomLabel(r.roomId)}` : ""}
                </span>
                <span
                  className="min-w-0 flex-1 truncate pr-2.5 text-[12px] font-[450]"
                  title={r.text}
                >
                  {r.text}
                </span>
                <span className="text-muted-foreground w-32 truncate text-[11.5px]">
                  {r.actorName}
                </span>
              </div>
            ))}
          </div>
        ))}
        {filtered.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + 40)}
            className="text-primary hover:bg-surface-hover w-full py-2.5 text-center text-[12px] font-medium"
          >
            Load 40 more
          </button>
        )}
      </Card>
    </div>
  );
}
