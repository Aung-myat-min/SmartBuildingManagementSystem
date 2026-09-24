"use client";

import { Link2, Pause, Play, Search } from "lucide-react";
import * as React from "react";
import { AccessDenied } from "@/components/shared/access-denied";
import {
  type DateRange,
  DateRangeFilter,
  EMPTY_RANGE,
  withinRange,
} from "@/components/shared/date-range-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { PulseDot } from "@/components/shared/pulse-dot";
import { StickyToolbar } from "@/components/shared/sticky-toolbar";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLiveClock } from "@/hooks/use-live-clock";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppState } from "@/lib/app-state";
import { formatDayLabel, formatTime } from "@/lib/format";
import { LOG_BOOK_SOURCE_META } from "@/lib/mock-data";
import { staggerStyle } from "@/lib/motion";
import {
  canAccessLogBook,
  isBuildingLocked,
  roleLabel,
} from "@/lib/permissions";
import type { LogBookEntry, LogBookSource, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const SOURCE_TONE: Record<LogBookSource, Tone> = {
  alert: "danger",
  sensor: "info",
  request: "warning",
  equipment: "success",
  access: "neutral",
  admin: "neutral",
};
const SOURCE_ORDER: LogBookSource[] = [
  "alert",
  "sensor",
  "request",
  "equipment",
  "access",
  "admin",
];

function shiftLabel(hour: number): string {
  if (hour >= 6 && hour < 14) return "Day shift (06:00–14:00)";
  if (hour >= 14 && hour < 22) return "Evening shift (14:00–22:00)";
  return "Night shift (22:00–06:00)";
}

function dayLabel(iso: string) {
  const diffDays = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

export default function LogBookPage() {
  const { buildings, role, activeBuildingId, logBook, logBookLoading } =
    useAppState();
  const clock = useLiveClock();
  const [paused, setPaused] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [buildingFilter, setBuildingFilter] = React.useState(
    isBuildingLocked(role) ? activeBuildingId : "all",
  );
  const [sourceFilter, setSourceFilter] = usePersistedState<
    LogBookSource | "all"
  >("logbook.source", "all");
  // The book runs long, so a reader narrowing to one shift needs the hour,
  // not just the day.
  const [range, setRange] = React.useState<DateRange>(EMPTY_RANGE);

  const locked = isBuildingLocked(role);
  const effectiveBuilding = locked ? activeBuildingId : buildingFilter;

  const filtered = logBook.filter((e) => {
    if (effectiveBuilding !== "all" && e.buildingId !== effectiveBuilding)
      return false;
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
    if (!withinRange(e.timestamp, range)) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${e.title} ${e.detail} ${e.actorName} ${e.refId ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, LogBookEntry[]>();
    for (const e of filtered) {
      const key = `${dayLabel(e.timestamp)} — ${shiftLabel(new Date(e.timestamp).getHours())}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(e);
      else map.set(key, [e]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // The seed data is fixed, so "today" is the most recent day it holds
  // rather than the wall-clock date — otherwise the panel reads 0 of 0 the
  // day after the data was written.
  const latestDay = logBook.reduce(
    (latest, e) => Math.max(latest, new Date(e.timestamp).setHours(0, 0, 0, 0)),
    0,
  );
  const todayEntries = logBook.filter(
    (e) => new Date(e.timestamp).setHours(0, 0, 0, 0) === latestDay,
  );
  const alertCount = filtered.filter((e) => e.source === "alert").length;
  const sourceCounts = SOURCE_ORDER.map((s) => ({
    source: s,
    count: logBook.filter(
      (e) =>
        e.source === s &&
        (effectiveBuilding === "all" || e.buildingId === effectiveBuilding),
    ).length,
  }));
  // Who — or what — puts entries in this book. People carry their role;
  // the automated writers carry the kind of entry they produce, since the
  // point of the panel is that nothing here is written by hand.
  const writers = Array.from(
    logBook.reduce(
      (map, e) => {
        const found = map.get(e.actorName);
        if (found) {
          found.count += 1;
          found.sources.add(e.source);
        } else {
          map.set(e.actorName, {
            name: e.actorName,
            role: e.actorRole,
            count: 1,
            sources: new Set([e.source]),
          });
        }
        return map;
      },
      new Map<
        string,
        {
          name: string;
          role?: UserRole;
          count: number;
          sources: Set<LogBookSource>;
        }
      >(),
    ),
  )
    .map(([, w]) => ({
      name: w.name,
      detail: w.role
        ? roleLabel[w.role]
        : Array.from(w.sources)
            .map((src) => LOG_BOOK_SOURCE_META[src].label.toLowerCase())
            .join(", "),
      tone: SOURCE_TONE[Array.from(w.sources)[0]],
      count: w.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (!canAccessLogBook(role)) {
    return (
      <AccessDenied
        title="The Log Book is restricted"
        body={
          <>
            The live system feed is visible to Admin Managers and the CEO. Your
            role is <strong>{roleLabel[role]}</strong>.
          </>
        }
      />
    );
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1fr_296px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <Card className="flex-row items-center gap-3 p-3.5">
          <ToneBadge tone={paused ? "neutral" : "success"} className="gap-1.5">
            <PulseDot tone={paused ? "neutral" : "success"} pulse={!paused} />{" "}
            {paused ? "PAUSED" : "LIVE"}
          </ToneBadge>
          <div>
            <div className="text-[12px] font-medium">
              System-written activity feed
            </div>
            <div className="text-muted-foreground text-[11px]">
              Picks up actions taken across the app as they happen.
            </div>
          </div>
          <div className="flex-1" />
          <span className="text-muted-foreground font-mono text-[11px]">
            {clock ?? "—"}
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            title={paused ? "Resume live feed" : "Pause live feed"}
            className="focus-ring interactive border-border hover:border-primary hover:text-info-foreground flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium"
          >
            {paused ? (
              <Play className="size-3" />
            ) : (
              <Pause className="size-3" />
            )}
            {paused ? "Resume" : "Pause"}
          </button>
        </Card>

        <StickyToolbar>
          <Card className="flex-row flex-wrap items-center gap-2 p-2.5">
            <div className="interactive focus-within:ring-3 focus-within:ring-primary/15 border-input focus-within:border-primary relative min-w-32 flex-1 rounded-md border">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entries"
                className="w-full bg-transparent py-1.5 pr-3 pl-8 text-[12px] outline-none"
              />
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
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter value={range} onChange={setRange} withTime />
            <div className="bg-border h-5.5 w-px" />
            <ToneBadge tone="info" title="Entries shown">
              {filtered.length} shown
            </ToneBadge>
            {alertCount > 0 && (
              <ToneBadge tone="danger" title="Alert-level entries in view">
                {alertCount} alerts
              </ToneBadge>
            )}
          </Card>
        </StickyToolbar>

        <div className="flex flex-col gap-3">
          {grouped.length === 0 &&
            (logBookLoading ? (
              <EmptyState>Loading the log…</EmptyState>
            ) : (
              <EmptyState>Nothing recorded under these filters.</EmptyState>
            ))}
          {grouped.map(([shift, entries]) => (
            <Card key={shift} className="gap-0 overflow-hidden p-0">
              <div className="bg-surface-subtle border-border flex items-center gap-2 border-b px-4 py-2">
                <span className="font-mono text-[11px] font-semibold tracking-wide">
                  {shift}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  · {entries.length} entries
                </span>
              </div>
              {entries.map((e, i) => (
                <div
                  key={e.id}
                  style={staggerStyle(i)}
                  className="border-border animate-sb-rise flex gap-2.5 border-b px-4 py-2.5 last:border-b-0"
                >
                  <span className="text-muted-foreground w-11 shrink-0 pt-0.5 font-mono text-[10.5px]">
                    {formatTime(e.timestamp)}
                  </span>
                  <PulseDot
                    tone={SOURCE_TONE[e.source]}
                    pulse={e.source === "alert"}
                    className="mt-1.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-[450]">
                        {e.title}
                      </span>
                      <ToneBadge tone={SOURCE_TONE[e.source]}>
                        {LOG_BOOK_SOURCE_META[e.source].label}
                      </ToneBadge>
                      {e.refId && (
                        <span
                          className="text-primary flex items-center gap-1 text-[10.5px]"
                          title="Linked record"
                        >
                          <Link2 className="size-2.5" /> {e.refId}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
                      {e.detail}
                    </div>
                  </div>
                  <span className="text-muted-foreground w-32 shrink-0 truncate text-right text-[11px]">
                    {e.actorName}
                  </span>
                </div>
              ))}
            </Card>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-3.5">
        <Card className="gap-2 p-3.5">
          <div className="text-muted-foreground font-mono text-[10px] tracking-wider">
            TODAY
          </div>
          <div className="flex gap-5">
            <div>
              <div className="font-mono text-[22px] leading-none font-semibold">
                {todayEntries.length}
              </div>
              <div className="text-muted-foreground mt-1 text-[10.5px]">
                Entries
              </div>
            </div>
            <div>
              <div className="text-danger-foreground font-mono text-[22px] leading-none font-semibold">
                {todayEntries.filter((e) => e.source === "alert").length}
              </div>
              <div className="text-muted-foreground mt-1 text-[10.5px]">
                Alerts
              </div>
            </div>
          </div>
          <div className="border-border text-muted-foreground border-t pt-2 text-[10.5px]">
            Since 00:00 on {formatDayLabel(new Date(latestDay).toISOString())}
          </div>
        </Card>

        <Card className="gap-1.5 p-3.5">
          <div className="text-muted-foreground mb-1 font-mono text-[10px] tracking-wider">
            SOURCES
          </div>
          <button
            type="button"
            onClick={() => setSourceFilter("all")}
            className={cn(
              "focus-ring interactive flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left",
              sourceFilter === "all"
                ? "bg-accent/50"
                : "hover:bg-surface-hover",
            )}
          >
            <span className="bg-foreground/40 size-2 shrink-0 rounded-sm" />
            <span className="flex-1 text-[12px]">All sources</span>
            <span className="text-muted-foreground font-mono text-[11px]">
              {logBook.length}
            </span>
          </button>
          {sourceCounts.map(({ source, count }) => (
            <button
              type="button"
              key={source}
              onClick={() => setSourceFilter(source)}
              className={cn(
                "focus-ring interactive flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left",
                sourceFilter === source
                  ? "bg-accent/50"
                  : "hover:bg-surface-hover",
              )}
            >
              <PulseDot tone={SOURCE_TONE[source]} />
              <span className="flex-1 text-[12px]">
                {LOG_BOOK_SOURCE_META[source].label}
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {count}
              </span>
            </button>
          ))}
        </Card>

        <Card className="gap-1.5 p-3.5">
          <div className="text-muted-foreground mb-1 font-mono text-[10px] tracking-wider">
            WHAT WRITES HERE
          </div>
          <div className="mt-2.75 flex flex-col gap-2.25">
            {writers.map((w) => (
              <div key={w.name} className="flex items-start gap-2.25">
                <PulseDot tone={w.tone} className="mt-1.25" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] leading-snug font-[450]">
                    {w.name}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10.5px] leading-snug">
                    {w.detail}
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {w.count}
                </span>
              </div>
            ))}
          </div>
          <div className="border-border text-muted-foreground border-t pt-2 text-[10.5px] leading-relaxed">
            Entries are written by the system, never by hand. Historical Records
            holds the same events beyond today.
          </div>
        </Card>
      </aside>
    </div>
  );
}
