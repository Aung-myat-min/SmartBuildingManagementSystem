"use client";

import { Download, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const [range, setRange] = React.useState(30);
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
  const bars = Array.from({ length: chartDays }, (_, i) => {
    const dayStart = Date.now() - (chartDays - 1 - i) * DAY_MS;
    const dayLabel = new Date(dayStart).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
    const counts = Object.fromEntries(
      TYPE_ORDER.map((t) => [
        t,
        filtered.filter((r) => {
          const diff = Math.floor(
            (dayStart - new Date(r.timestamp).getTime()) / DAY_MS,
          );
          return r.type === t && diff === 0;
        }).length,
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
      <Card className="flex-row flex-wrap items-center gap-2 p-2.5">
        <div className="border-input focus-within:border-primary relative min-w-32 flex-1 rounded-md border">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records, devices or people"
            className="w-full bg-transparent py-1.5 pr-3 pl-8 text-[12px] outline-none"
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
        <Select
          value={effectiveBuilding}
          onValueChange={(v) => setBuildingFilter(v ?? "all")}
          disabled={locked}
        >
          <SelectTrigger size="sm" className="text-[12px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buildings</SelectItem>
            {BUILDINGS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) =>
            setTypeFilter((v as typeof typeFilter) ?? "all")
          }
        >
          <SelectTrigger size="sm" className="text-[12px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="bg-border h-5.5 w-px" />
        <ToneBadge tone="info">{filtered.length} in range</ToneBadge>
        <div className="flex-1" />
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
      </Card>

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
                  className="size-2 rounded-sm"
                  style={{
                    background: `var(--color-${TYPE_META[t].tone === "neutral" ? "neutral-foreground" : TYPE_META[t].tone})`,
                  }}
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
                  className="w-full rounded-[2px]"
                  style={{
                    height: `${(b.counts[t] / maxTotal) * 100}%`,
                    background: `var(--color-${TYPE_META[t].tone === "neutral" ? "neutral-foreground" : TYPE_META[t].tone})`,
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
          <span className="w-24">TYPE</span>
          <span className="w-52">SOURCE</span>
          <span className="flex-1">RECORD</span>
          <span className="w-28 text-right">BY</span>
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
                className="border-border flex items-center border-b border-l-[3px] px-4 py-2 text-[12px] last:border-b-0"
                style={{
                  borderLeftColor: `var(--color-${TYPE_META[r.type].tone === "neutral" ? "neutral-foreground" : TYPE_META[r.type].tone})`,
                }}
              >
                <span className="text-muted-foreground w-16 font-mono text-[11px]">
                  {formatTime(r.timestamp)}
                </span>
                <span className="w-24">
                  <ToneBadge tone={TYPE_META[r.type].tone}>
                    {TYPE_META[r.type].label}
                  </ToneBadge>
                </span>
                <span className="text-foreground/70 w-52 truncate">
                  {r.buildingId ? buildingName(r.buildingId) : "Estate-wide"}
                  {r.roomId ? ` / ${roomLabel(r.roomId)}` : ""}
                </span>
                <span className="flex-1 truncate pr-3" title={r.text}>
                  {r.text}
                </span>
                <span className="text-muted-foreground w-28 truncate text-right text-[11.5px]">
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
