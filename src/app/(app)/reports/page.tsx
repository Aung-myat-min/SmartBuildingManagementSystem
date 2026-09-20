"use client";

import { ArrowLeft, Download, Info, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AccessDenied } from "@/components/shared/access-denied";
import {
  type DateRange,
  DateRangeFilter,
  EMPTY_RANGE,
  withinRange,
} from "@/components/shared/date-range-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState } from "@/lib/app-state";
import { kpiPasses, nextSequentialId } from "@/lib/derive";
import { printToPdf, stampedFilename, toCsv } from "@/lib/export";
import type { WriteResult } from "@/lib/firestore-store";
import { formatDate, formatMmk, formatPeriod } from "@/lib/format";
import { buildingName, equipmentUnitLabel, typeLabel } from "@/lib/mock-data";
import { buildReport } from "@/lib/reporting";

/**
 * What each kind shows. Every report used to render all five sections, which
 * was invisible while the figures were noise and obvious the moment a section
 * could legitimately come back empty — a maintenance report has no cost
 * breakdown to show.
 */
const SECTIONS: Record<ReportKind, readonly Section[]> = {
  "maintenance-performance": ["kpis", "weeks", "offenders"],
  "equipment-reliability": ["kpis", "faultTypes", "offenders"],
  "cost-of-maintenance": ["kpis", "costs"],
};
type Section = "kpis" | "weeks" | "faultTypes" | "offenders" | "costs";

import { canAccessReports, roleLabel } from "@/lib/permissions";
import type {
  Report,
  ReportDetail,
  ReportKind,
  ReportStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ReportKind, string> = {
  "maintenance-performance": "Maintenance performance",
  "equipment-reliability": "Equipment reliability",
  "cost-of-maintenance": "Cost of maintenance",
};
/** What each report actually measures — the title alone does not say. */
const KIND_BLURB: Record<ReportKind, string> = {
  "maintenance-performance":
    "How quickly maintenance requests were answered and closed over the period: the share resolved inside the escalation window, the average response time, how often a request escalated, and what the work cost against budget. Weekly figures separate work finished in the period from work carried over into the next one.",
  "equipment-reliability":
    "Which assets failed and how often, over the period: faults grouped by equipment type, the units that failed most, and the downtime each one accounted for. Use it to decide what to replace rather than keep repairing.",
  "cost-of-maintenance":
    "What the period's maintenance actually cost, split across parts, labour and contractors, and measured against the budget set for the scope. Per-unit costs show where spend concentrates.",
};

const STATUS_META: Record<ReportStatus, { label: string; tone: Tone }> = {
  ready: { label: "READY", tone: "success" },
  scheduled: { label: "SCHEDULED", tone: "warning" },
  archived: { label: "ARCHIVED", tone: "neutral" },
};
// Tailwind only emits the colour tokens it sees in a class, so these are real
// utility classes rather than var(--color-*) read from an inline style.
const TONE_BORDER_L: Record<Tone, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-danger",
  info: "border-l-info",
  neutral: "border-l-neutral-foreground",
};

// The design gives each equipment type its own bar colour rather than one
// flat blue, so the five rows read apart at a glance.
const FAULT_BARS = [
  "bg-chart-1",
  "bg-chart-4",
  "bg-chart-3",
  "bg-chart-2",
  "bg-chart-5",
];

const KIND_TONE: Record<ReportKind, Tone> = {
  "maintenance-performance": "info",
  "equipment-reliability": "warning",
  "cost-of-maintenance": "success",
};

/**
 * A report is five tables, not one, so the file is sectioned: a title row, the
 * table, a blank line. Every spreadsheet reads that; flattening them into one
 * grid would need a column set none of them share.
 */
function reportCsv(detail: ReportDetail): string {
  const sections: string[] = [
    `${KIND_LABEL[detail.kind]} — ${detail.period}`,
    detail.buildingId ? buildingName(detail.buildingId) : "Whole estate",
    `Generated,${formatDate(detail.generatedAt)},by,${detail.generatedBy}`,
    "",
    "KPIs",
    toCsv(detail.kpis, [
      { header: "Measure", value: (k) => k.label },
      { header: "Value", value: (k) => k.value },
      { header: "Unit", value: (k) => k.unit },
      { header: "Target", value: (k) => k.targetLabel },
      { header: "Met", value: (k) => (kpiPasses(k) ? "yes" : "no") },
    ]),
    "",
    "Weekly resolution",
    toCsv(detail.weeks, [
      { header: "Week", value: (w) => w.label },
      { header: "Resolved", value: (w) => w.resolved },
      { header: "Carried over", value: (w) => w.carriedOver },
    ]),
    "",
    "Fault types",
    toCsv(detail.faultTypes, [
      { header: "Type", value: (f) => f.typeLabel },
      { header: "Count", value: (f) => f.count },
    ]),
    "",
    "Worst offenders",
    toCsv(detail.offenders, [
      { header: "Tag", value: (o) => o.tag },
      { header: "Unit", value: (o) => o.unitLabel },
      { header: "Faults", value: (o) => o.faults },
      { header: "Downtime (h)", value: (o) => o.downtimeHours },
      { header: "Cost (MMK)", value: (o) => o.costMmk },
    ]),
    "",
    "Costs",
    toCsv(detail.costs, [
      { header: "Line", value: (c) => c.label },
      { header: "MMK", value: (c) => c.valueMmk },
    ]),
  ];
  return sections.join("\r\n");
}

function downloadReportCsv(detail: ReportDetail): void {
  const blob = new Blob([`\uFEFF${reportCsv(detail)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = stampedFilename(detail.id.toLowerCase());
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const {
    buildings,
    role,
    currentUser,
    reports,
    addReport,
    requests,
    equipmentUnits,
    equipmentHistory,
  } = useAppState();

  const [query, setQuery] = React.useState("");
  const [buildingFilter, setBuildingFilter] = React.useState("all");
  const [kindFilter, setKindFilter] = React.useState<"all" | ReportKind>("all");
  const [range, setRange] = React.useState<DateRange>(EMPTY_RANGE);
  const [genOpen, setGenOpen] = React.useState(false);
  const [openReportId, setOpenReportId] = React.useState<string | null>(null);
  // Set by the library card's PDF button, cleared once the detail view has
  // rendered and printed.
  const [printOnOpen, setPrintOnOpen] = React.useState(false);

  if (!canAccessReports(role)) {
    return (
      <AccessDenied
        title="Reports are restricted"
        body={
          <>
            Performance and cost reporting is generated by Admin Managers and
            the CEO. Your role is <strong>{roleLabel[role]}</strong>.
          </>
        }
      />
    );
  }

  const all = reports;
  const filtered = all.filter((r) => {
    if (buildingFilter !== "all" && (r.buildingId ?? "all") !== buildingFilter)
      return false;
    if (kindFilter !== "all" && r.kind !== kindFilter) return false;
    // Filtered on when a report was generated — its period is a label, not a
    // date the list can compare.
    if (!withinRange(r.generatedAt, range)) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${r.id} ${KIND_LABEL[r.kind]} ${r.period} ${r.buildingId ? buildingName(r.buildingId) : "estate"}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const groups = (Object.keys(KIND_LABEL) as ReportKind[])
    .map((kind) => ({ kind, items: filtered.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0);

  const openReport = all.find((r) => r.id === openReportId) ?? null;

  if (openReport) {
    return (
      <ReportDetailView
        report={openReport}
        printOnOpen={printOnOpen}
        onPrinted={() => setPrintOnOpen(false)}
        onBack={() => setOpenReportId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
        <div className="border-input focus-within:border-primary bg-card flex min-w-45 flex-1 items-center gap-1.5 rounded border px-2">
          <Search className="text-muted-foreground size-3.25 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports"
            className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none"
          />
        </div>
        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          <option value="all">All buildings</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          <option value="all">All kinds</option>
          {(Object.keys(KIND_LABEL) as ReportKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <DateRangeFilter
          value={range}
          onChange={setRange}
          withTime
          label="Generated"
        />
        <div className="bg-border h-5.5 w-px" />
        <ToneBadge tone="info">{filtered.length} reports</ToneBadge>
        {/*<div className="flex-1" />*/}
        <Button size="sm" onClick={() => setGenOpen(true)}>
          + Generate report
        </Button>
      </div>

      {groups.length === 0 && (
        <EmptyState className="p-6">
          {all.length === 0
            ? "No reports yet. Generate one from a date range and it is saved here."
            : "No reports match these filters."}
        </EmptyState>
      )}

      {groups.map((g) => (
        <div key={g.kind} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground font-mono text-[10px] tracking-wider whitespace-nowrap">
              {KIND_LABEL[g.kind].toUpperCase()}
            </span>
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-[11px]">
              {g.items.length} reports
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.items.map((r) => {
              const statusMeta = STATUS_META[r.status];
              const disabled = r.status !== "ready";
              return (
                <Card
                  key={r.id}
                  className={cn(
                    "gap-2.5 border-l-[3px] p-3.5",
                    TONE_BORDER_L[KIND_TONE[r.kind]],
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-semibold">
                        {KIND_LABEL[r.kind]}
                      </div>
                      <div className="text-foreground/70 mt-0.5 text-[11.5px]">
                        {r.buildingId
                          ? buildingName(r.buildingId)
                          : "Whole estate"}{" "}
                        · {r.period}
                      </div>
                    </div>
                    <ToneBadge tone={statusMeta.tone}>
                      {statusMeta.label}
                    </ToneBadge>
                  </div>
                  <div className="text-muted-foreground font-mono text-[10.5px]">
                    Generated {formatDate(r.generatedAt)} · {r.generatedBy}
                  </div>
                  <div className="border-border flex gap-1.5 border-t pt-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => setOpenReportId(r.id)}
                      className="flex-1 text-[11px]"
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      title="Open this report and print it to PDF"
                      onClick={() => {
                        // Printing the library would print the library, so the
                        // report is opened first and printed once it renders.
                        setPrintOnOpen(true);
                        setOpenReportId(r.id);
                      }}
                    >
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      title="Download the underlying rows as CSV"
                      onClick={() => {
                        downloadReportCsv(r);
                        toast.success(`${r.id} exported to CSV`);
                      }}
                    >
                      CSV
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <GenerateReportSheet
        open={genOpen}
        onOpenChange={setGenOpen}
        existingIds={all.map((r) => r.id)}
        currentUser={currentUser}
        onGenerate={async (meta) => {
          // Computed once, here, and stored with the report. A report is a
          // record of what was true for its period, so reopening it next month
          // has to show the same figures.
          const figures = buildReport(meta.kind, {
            requests,
            units: equipmentUnits,
            history: equipmentHistory,
            periodStart: meta.periodStart,
            periodEnd: meta.periodEnd,
            buildingId: meta.buildingId,
            typeLabel,
            unitLabel: equipmentUnitLabel,
          });
          const written = await addReport({ ...meta, ...figures });
          if (!written.ok) return written;
          toast.success(`${meta.id} generated`, {
            description: "Saved to the report library.",
          });
          return written;
        }}
      />
    </div>
  );
}

/** A Date as the native date input wants it, in local time rather than UTC. */
function toInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function GenerateReportSheet({
  open,
  onOpenChange,
  existingIds,
  currentUser,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every id already in use, so a new one cannot collide with one of them. */
  existingIds: string[];
  currentUser: { name: string };
  onGenerate: (r: Report) => Promise<WriteResult>;
}) {
  const { buildings } = useAppState();
  const [kind, setKind] = React.useState<ReportKind>("maintenance-performance");
  const [buildingId, setBuildingId] = React.useState("all");
  // A report covers whatever range someone picks, rather than the three
  // canned periods this used to offer. The label is read back from the dates.
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    // Defaults to the month the reader is standing in.
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFrom(toInputDate(first));
    setTo(toInputDate(last));
    setError(null);
  }, [open]);

  const period = from && to ? formatPeriod(from, to) : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-105">
        <SheetHeader>
          <SheetTitle className="font-mono text-[11px] tracking-wider uppercase">
            Generate a report
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3.5 px-4">
          <Field label="Report">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ReportKind)}
              className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
            >
              {(Object.keys(KIND_LABEL) as ReportKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period covered">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={from}
                max={to || undefined}
                aria-label="Period from"
                onChange={(e) => setFrom(e.target.value)}
                className="border-input focus:border-primary bg-card w-full rounded border px-2 py-2 text-[11.5px] font-medium outline-none"
              />
              <input
                type="date"
                value={to}
                min={from || undefined}
                aria-label="Period to"
                onChange={(e) => setTo(e.target.value)}
                className="border-input focus:border-primary bg-card w-full rounded border px-2 py-2 text-[11.5px] font-medium outline-none"
              />
            </div>
            <p className="text-muted-foreground mt-1.5 text-[10.5px] leading-relaxed">
              Reads back as <span className="font-medium">{period}</span>. A
              whole calendar month is named; anything else shows its span.
            </p>
          </Field>
          <Field label="Scope">
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
            >
              <option value="all">Whole estate</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && (
          <p className="text-warning-foreground px-4 text-[11.5px] leading-relaxed">
            {error}
          </p>
        )}
        <div className="mt-2 flex gap-2 px-4">
          <Button
            className="flex-1"
            disabled={pending}
            onClick={async () => {
              if (!from || !to) {
                setError("A report needs a start and an end date.");
                return;
              }
              if (new Date(from) > new Date(to)) {
                setError("The start date is after the end date.");
                return;
              }
              setError(null);
              setPending(true);
              const written = await onGenerate({
                id: nextSequentialId("RPT", existingIds, 1000),
                kind,
                period,
                periodStart: from,
                periodEnd: to,
                buildingId: buildingId === "all" ? undefined : buildingId,
                generatedAt: new Date().toISOString(),
                generatedBy: currentUser.name,
                status: "ready",
              });
              setPending(false);
              if (!written.ok) {
                setError(written.message);
                return;
              }
              onOpenChange(false);
            }}
          >
            Generate
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReportDetailView({
  report,
  printOnOpen,
  onPrinted,
  onBack,
}: {
  report: ReportDetail;
  printOnOpen: boolean;
  onPrinted: () => void;
  onBack: () => void;
}) {
  const detail = report;
  const sections = SECTIONS[detail.kind];

  // The library's PDF button opens the report and prints it. Printing from an
  // effect rather than the click handler is what guarantees the page being
  // printed is this one, fully rendered.
  React.useEffect(() => {
    if (!printOnOpen) return;
    onPrinted();
    printToPdf();
  }, [printOnOpen, onPrinted]);
  const budget = detail.budgetMmk;
  const budgetPct =
    budget === undefined
      ? 0
      : Math.min(100, Math.round((detail.spentMmk / budget) * 100));
  const overBudget = budget !== undefined && detail.spentMmk > budget;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex-row items-center gap-3 p-3">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-primary flex items-center gap-1.5 text-[12px] font-medium"
        >
          <ArrowLeft className="size-3.5" /> Library
        </button>
        <div className="bg-border h-5.5 w-px" />
        <div className="min-w-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="flex cursor-help items-center gap-1.5 text-left"
                />
              }
            >
              <span className="text-[13px] font-semibold">
                {KIND_LABEL[report.kind]}
              </span>
              <Info className="text-muted-foreground size-3.25 shrink-0" />
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-w-100 text-[11.5px] leading-relaxed"
            >
              {KIND_BLURB[report.kind]}
            </TooltipContent>
          </Tooltip>
          <div className="text-muted-foreground mt-1 font-mono text-[10.5px] leading-snug">
            {report.buildingId
              ? buildingName(report.buildingId)
              : "Whole estate"}{" "}
            · {report.period} · Generated {formatDate(report.generatedAt)} by{" "}
            {report.generatedBy} · {STATUS_META[report.status].label}
          </div>
        </div>
        <div className="flex-1" />
        <div data-print-hide className="flex gap-2">
          <Button size="sm" variant="outline" onClick={printToPdf}>
            <Download className="size-3" /> PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              downloadReportCsv(report);
              toast.success(`${report.id} exported to CSV`);
            }}
          >
            <Download className="size-3" /> CSV
          </Button>
        </div>
      </Card>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {detail.kpis.map((k) => (
          <Card
            key={k.label}
            className={cn(
              "gap-1.5 border-t-[3px] p-3.5",
              kpiPasses(k) ? "border-t-success" : "border-t-warning",
            )}
          >
            <div className="text-muted-foreground font-mono text-[10px] tracking-wider">
              {k.label}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[25px] leading-none font-semibold">
                {k.value}
              </span>
              <span className="text-muted-foreground text-[11px]">
                {k.unit}
              </span>
            </div>
            <div className="border-border flex items-center gap-1.5 border-t pt-2">
              <ToneBadge tone={kpiPasses(k) ? "success" : "warning"}>
                {kpiPasses(k) ? "ON TARGET" : "WATCH"}
              </ToneBadge>
              <span className="text-muted-foreground text-[10.5px]">
                {k.targetLabel}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[1.35fr_1fr]">
        {sections.includes("weeks") && (
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
                REQUESTS BY WEEK
              </span>
              <div className="flex gap-3 text-[10.5px]">
                <span className="flex items-center gap-1.5">
                  <span className="bg-success size-2 rounded-sm" /> Resolved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-warning size-2 rounded-sm" /> Carried over
                </span>
              </div>
            </div>
            <div className="flex h-38 items-end gap-3">
              {detail.weeks.map((w) => {
                const total = w.resolved + w.carriedOver;
                const max = Math.max(
                  ...detail.weeks.map((x) => x.resolved + x.carriedOver),
                  1,
                );
                return (
                  <div
                    key={w.label}
                    className="flex flex-1 flex-col items-center gap-1.5"
                    title={`${w.label}: ${w.resolved} resolved, ${w.carriedOver} carried over`}
                  >
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {total}
                    </span>
                    <div
                      className="flex w-full flex-col justify-end gap-0.5"
                      style={{ height: `${Math.round((total / max) * 96)}px` }}
                    >
                      <div
                        className="bg-warning w-full rounded-t-[2px]"
                        style={{ height: `${(w.carriedOver / total) * 100}%` }}
                      />
                      <div
                        className="bg-success w-full rounded-b-[2px]"
                        style={{ height: `${(w.resolved / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground font-mono text-[9.5px]">
                      {w.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {sections.includes("faultTypes") && (
          <Card className="gap-3 p-4">
            <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
              FAULTS BY EQUIPMENT TYPE
            </span>
            <div className="flex flex-col gap-2.5">
              {detail.faultTypes.map((f, i) => {
                const max = Math.max(...detail.faultTypes.map((x) => x.count));
                return (
                  <div key={f.typeLabel}>
                    <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                      <span className="font-[450]">{f.typeLabel}</span>
                      <span className="text-neutral-foreground font-mono font-medium">
                        {f.count}
                      </span>
                    </div>
                    <div className="bg-rule mt-1.5 h-1.75 overflow-hidden rounded-[2px]">
                      <div
                        className={cn(
                          "h-full rounded-[2px]",
                          FAULT_BARS[i % FAULT_BARS.length],
                        )}
                        style={{ width: `${(f.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[1.35fr_1fr]">
        {sections.includes("offenders") && (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-border border-b px-4 py-2.5">
              <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
                WORST OFFENDERS
              </span>
            </div>
            <div className="bg-surface-subtle border-border text-muted-foreground flex border-b px-4 py-2 font-mono text-[10px] tracking-wider">
              <span className="w-24">TAG</span>
              <span className="flex-1">UNIT</span>
              <span className="w-16 text-right">FAULTS</span>
              <span className="w-22 text-right">DOWNTIME</span>
              <span className="w-24 text-right">COST</span>
            </div>
            {detail.offenders.map((o) => (
              <div
                key={o.tag}
                className="border-border flex items-center border-b px-4 py-2 text-[12px] last:border-b-0"
              >
                <span className="text-primary w-24 font-mono text-[11px] font-medium">
                  {o.tag}
                </span>
                <span className="flex-1 truncate pr-2">{o.unitLabel}</span>
                <span className="text-danger-foreground w-16 text-right font-mono font-medium">
                  {o.faults}
                </span>
                <span className="text-muted-foreground w-22 text-right font-mono">
                  {o.downtimeHours}h
                </span>
                <span className="text-muted-foreground w-24 text-right font-mono">
                  {formatMmk(o.costMmk)}
                </span>
              </div>
            ))}
          </Card>
        )}

        {sections.includes("costs") && (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-border border-b px-4 py-2.5">
              <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
                COST OF MAINTENANCE
              </span>
            </div>
            <div className="flex flex-col px-4 py-2">
              {detail.costs.map((c) => (
                <div
                  key={c.label}
                  className={cn(
                    "flex justify-between py-1.5 text-[12.5px]",
                    c.isTotal &&
                      "border-border mt-1 border-t pt-2 font-semibold",
                  )}
                >
                  <span>{c.label}</span>
                  <span className="font-mono">{formatMmk(c.valueMmk)}</span>
                </div>
              ))}
            </div>
            {/* Drawn only when a budget exists. Nothing in this app holds one
              yet, so inventing a bar to fill the space would be the report
              lying about a number nobody supplied. */}
            {budget !== undefined && (
              <div className="bg-surface-subtle border-border border-t px-4 py-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">AGAINST BUDGET</span>
                  <span
                    className={
                      overBudget
                        ? "text-danger-foreground font-medium"
                        : "text-success-foreground font-medium"
                    }
                  >
                    {budgetPct}% of {formatMmk(budget)}
                  </span>
                </div>
                <div className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      overBudget ? "bg-danger" : "bg-success",
                    )}
                    style={{ width: `${Math.min(100, budgetPct)}%` }}
                  />
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <Card className="gap-2 p-4">
        <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
          NOTES
        </span>
        <p className="max-w-[78ch] text-[12px] leading-relaxed">
          {detail.notes}
        </p>
      </Card>
    </div>
  );
}
