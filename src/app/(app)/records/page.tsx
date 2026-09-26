"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loader";
import {
  activeCount,
  PageToolbar,
  ToolbarSearch,
  ToolbarSegment,
} from "@/components/shared/page-toolbar";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Card } from "@/components/ui/card";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppState } from "@/lib/app-state";
import { downloadCsv, stampedFilename } from "@/lib/export";
import { formatDayLabel, formatTime } from "@/lib/format";
import { useLogHistory } from "@/lib/logbook-store";
import { buildingName, LOG_BOOK_SOURCE_META } from "@/lib/mock-data";
import { staggerStyle } from "@/lib/motion";
import { isBuildingLocked } from "@/lib/permissions";
import { isEstateRecord, isSignificant } from "@/lib/records";
import type { LogBookSource } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Every source the record can show. `admin` is here now — a building deleted
 * with a written reason is exactly the kind of entry this page exists for, and
 * excluding the whole source to keep personnel out was too blunt. What keeps
 * personnel out is `isEstateRecord`, which judges the action rather than the
 * source: who was hired, promoted, suspended or changed their password does
 * not surface here, and Office Staff can reach this page.
 */
const TYPE_META: Record<LogBookSource, { tone: Tone }> = {
  alert: { tone: "danger" },
  request: { tone: "warning" },
  equipment: { tone: "success" },
  sensor: { tone: "info" },
  access: { tone: "neutral" },
  admin: { tone: "neutral" },
};
type RecordSource = keyof typeof TYPE_META;
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

const TYPE_ORDER: RecordSource[] = [
  "alert",
  "request",
  "equipment",
  "sensor",
  "access",
  "admin",
];
const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const DAY_MS = 86400000;

export default function HistoricalRecordsPage() {
  const { buildings, role, activeBuildingId } = useAppState();
  const locked = isBuildingLocked(role);

  const [range, setRange] = usePersistedState("records.range", 30);
  const [buildingFilter, setBuildingFilter] = React.useState(
    locked ? activeBuildingId : "all",
  );
  const [typeFilter, setTypeFilter] = React.useState<"all" | RecordSource>(
    "all",
  );
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(40);
  // Default on: the page is the record, not the feed. The Log Book is one
  // click away in the sidebar for anyone who wants every tick, and this
  // switch is here for the admin who wants them without leaving the filters.
  const [importantOnly, setImportantOnly] = usePersistedState(
    "records.importantOnly",
    true,
  );

  const effectiveBuilding = locked ? activeBuildingId : buildingFilter;
  const cutoff = Date.now() - range * DAY_MS;

  const { items: history, loading } = useLogHistory();

  // The estate's own record: the Log Book without the personnel entries.
  const estate = React.useMemo(() => history.filter(isEstateRecord), [history]);

  const filtered = estate.filter((r) => {
    // The split this page is for: the Log Book keeps every status tick, and
    // the record keeps what somebody would look up months later.
    if (importantOnly && !isSignificant(r)) return false;
    if (new Date(r.timestamp).getTime() < cutoff) return false;
    if (effectiveBuilding !== "all" && r.buildingId !== effectiveBuilding)
      return false;
    if (typeFilter !== "all" && r.source !== typeFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${r.title} ${r.detail} ${r.actorName} ${r.refId ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const kpis = [
    { label: "TOTAL RECORDS", value: filtered.length, tone: "text-foreground" },
    {
      label: "ALARMS",
      value: filtered.filter((r) => r.source === "alert").length,
      tone: "text-danger-foreground",
    },
    {
      label: "REQUESTS",
      value: filtered.filter((r) => r.source === "request").length,
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
            r.source === t &&
            new Date(r.timestamp).setHours(0, 0, 0, 0) === dayStart,
        ).length,
      ]),
    ) as Record<RecordSource, number>;
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
      {/* The whole paragraph is the answer to "why is this not the Log
          Book". On a phone it was five lines standing between the page and
          its first record, so there it keeps the sentence that answers the
          question and drops the rest. */}
      <div className="border-border bg-card rounded-[5px] border px-3 py-2.25">
        <span className="text-muted-foreground text-[11.5px] leading-snug">
          <span className="text-foreground font-[450]">
            The Log Book, filtered.
          </span>{" "}
          The same record, kept to what someone would look up months later.
          <span className="max-md:hidden">
            {" "}
            Anything that needed a written reason, every alarm, and anything
            refused, withdrawn, deleted or archived. Switch to{" "}
            <span className="font-medium">All activity</span> for the rest.
            Personnel changes are never here; those are in the Log Book.
          </span>
        </span>
      </div>

      <PageToolbar
        activeFilters={activeCount(
          range !== 30,
          !locked && buildingFilter !== "all",
          typeFilter !== "all",
        )}
        onReset={() => {
          setRange(30);
          if (!locked) setBuildingFilter("all");
          setTypeFilter("all");
        }}
        search={
          <ToolbarSearch
            value={query}
            onChange={setQuery}
            placeholder="Search records, devices or people"
          />
        }
        views={
          <ToolbarSegment
            value={importantOnly ? "important" : "all"}
            onChange={(v) => setImportantOnly(v === "important")}
            options={[
              {
                id: "important",
                label: "Important",
                title:
                  "Decisions, refusals, alarms and anything that needed a written reason",
              },
              {
                id: "all",
                label: "All activity",
                title: "Every entry the Log Book holds, personnel aside",
              },
            ]}
          />
        }
        filters={
          <>
            <div className="bg-secondary flex items-center gap-1 rounded-md p-[3px]">
              {RANGES.map((r) => (
                <button
                  type="button"
                  key={r.days}
                  onClick={() => setRange(r.days)}
                  aria-pressed={range === r.days}
                  className={cn(
                    "interactive focus-ring flex-1 cursor-pointer rounded px-2.5 py-1 font-mono text-[11px] font-medium",
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
              aria-label="Building"
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
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              aria-label="Record type"
              onChange={(e) =>
                setTypeFilter(e.target.value as typeof typeFilter)
              }
              className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="all">All types</option>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {LOG_BOOK_SOURCE_META[t].label}
                </option>
              ))}
            </select>
          </>
        }
        status={<ToneBadge tone="info">{filtered.length} in range</ToneBadge>}
        actions={
          <button
            type="button"
            title="Export the filtered records to CSV"
            onClick={() => {
              // The filtered set, not the whole ledger: what is exported is what
              // is on screen, or the file disagrees with the count beside it.
              downloadCsv(stampedFilename("historical-records"), filtered, [
                { header: "Timestamp", value: (r) => r.timestamp },
                {
                  header: "Type",
                  value: (r) => LOG_BOOK_SOURCE_META[r.source].label,
                },
                {
                  header: "Building",
                  value: (r) =>
                    r.buildingId ? buildingName(r.buildingId) : "Estate",
                },
                { header: "Record", value: (r) => r.title },
                { header: "Detail", value: (r) => r.detail },
                { header: "Reason given", value: (r) => r.reason ?? "" },
                { header: "Reference", value: (r) => r.refId ?? "" },
                { header: "Recorded by", value: (r) => r.actorName },
              ]);
              toast.success(
                `Exported ${filtered.length} record${filtered.length === 1 ? "" : "s"} to CSV`,
              );
            }}
            className="interactive focus-ring border-border hover:border-primary hover:text-info-foreground flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium md:min-h-0 md:py-1.5"
          >
            <Download className="size-3" />{" "}
            <span className="max-md:hidden">Export CSV</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
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
                {LOG_BOOK_SOURCE_META[t].label}
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
        {grouped.length === 0 &&
          (loading ? (
            // A wait is not an empty result, and saying "no records" while
            // they are still arriving is the wrong answer to the question.
            <PageLoader note="Loading the estate's record…" className="py-14" />
          ) : (
            <EmptyState className="m-4">
              No records match these filters.
            </EmptyState>
          ))}
        {grouped.map(([day, records]) => (
          <div key={day}>
            <div className="bg-surface-subtle border-border text-muted-foreground flex items-center gap-2 border-b px-4 py-1.5 text-[11px]">
              <span className="font-mono font-semibold">
                {formatDayLabel(records[0].timestamp)}
              </span>
              <span>· {records.length} records</span>
            </div>
            {records.map((r, i) => (
              <div
                key={r.id}
                style={staggerStyle(i)}
                className={cn(
                  "animate-sb-rise border-rule flex items-center border-b border-l-[3px] px-4 py-2 text-[12px] last:border-b-0",
                  TONE_BORDER_L[TYPE_META[r.source].tone],
                )}
              >
                <span className="text-muted-foreground w-16 font-mono text-[11px]">
                  {formatTime(r.timestamp)}
                </span>
                <span className="w-29.5">
                  <ToneBadge tone={TYPE_META[r.source].tone}>
                    {LOG_BOOK_SOURCE_META[r.source].label}
                  </ToneBadge>
                </span>
                <span className="text-neutral-foreground w-57.5 truncate pr-2.5 text-[11.5px]">
                  {r.buildingId ? buildingName(r.buildingId) : "Estate-wide"}
                  {r.refId ? ` · ${r.refId}` : ""}
                </span>
                <span className="min-w-0 flex-1 pr-2.5" title={r.detail}>
                  <span className="block truncate text-[12px] font-[450]">
                    {r.title}
                  </span>
                  {/* The reason the actor had to type before the app would do
                      it. Asking for one and then never showing it back was the
                      gap this page now closes. */}
                  {r.reason && (
                    <span className="text-muted-foreground mt-0.5 block truncate text-[11px] italic">
                      “{r.reason}”
                    </span>
                  )}
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
            className="focus-ring interactive text-primary hover:bg-surface-hover w-full py-2.5 text-center text-[12px] font-medium"
          >
            Load 40 more
          </button>
        )}
      </Card>
    </div>
  );
}
