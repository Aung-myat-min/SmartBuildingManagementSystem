// Report figures, computed from the record.
//
// Pure, importing no data, for the same reason derive.ts is: these numbers are
// the product. They are exported to CSV and printed to PDF, so a silently
// wrong one is worse than a crash — and pure functions over arrays can be
// tested exactly.
//
// Every figure here is derived. Nothing is invented, and where the record
// cannot answer a question the answer is zero with a note saying why, never a
// plausible-looking number.

import { isEscalated, isRequestOpen } from "@/lib/derive";
import type {
  EquipmentHistoryEvent,
  EquipmentUnit,
  MaintenanceRequest,
  ReportCostLine,
  ReportDetail,
  ReportFaultType,
  ReportKind,
  ReportKpi,
  ReportOffender,
  ReportWeek,
} from "@/lib/types";

/** Everything a report is computed from. Plain data — no hooks, no Firestore. */
export interface ReportScope {
  requests: MaintenanceRequest[];
  units: EquipmentUnit[];
  history: EquipmentHistoryEvent[];
  /** ISO date, inclusive. */
  periodStart: string;
  /** ISO date, inclusive to the end of that day. */
  periodEnd: string;
  /** Absent means the whole estate. */
  buildingId?: string;
  /** How a type id reads on screen. Injected so this module imports no data. */
  typeLabel: (typeId: string) => string;
  /** How a unit reads on screen, e.g. "Projector — Room 302". */
  unitLabel: (unit: EquipmentUnit) => string;
}

/** The computed half of a report; the other half is the Report metadata. */
export type ReportFigures = Omit<
  ReportDetail,
  keyof import("@/lib/types").Report
>;

const HOUR = 3600000;
const DAY = 86400000;

/**
 * Period bounds are UTC days.
 *
 * `new Date("2026-09-14")` parses as UTC midnight, so calling local setHours
 * on it moves the boundary by the machine's offset — a report generated in
 * Yangon and the same one generated on a UTC server would disagree about which
 * requests are in it. Every timestamp in this app is a UTC ISO string, so the
 * bounds are too.
 */
function dayStartMs(isoDate: string): number {
  return Date.parse(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

function startMs(scope: ReportScope): number {
  return dayStartMs(scope.periodStart);
}

/** Inclusive of the end date's whole day, the way a person reads a range. */
function endMs(scope: ReportScope): number {
  return dayStartMs(scope.periodEnd) + DAY - 1;
}

function within(iso: string, from: number, to: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= from && t <= to;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/** A request is finished once it is resolved; completed is resolved plus sign-off. */
function isFinished(r: MaintenanceRequest): boolean {
  return r.status === "resolved" || r.status === "completed";
}

// Scoping

function scopedRequests(scope: ReportScope): MaintenanceRequest[] {
  const from = startMs(scope);
  const to = endMs(scope);
  return scope.requests.filter(
    (r) =>
      !r.withdrawn &&
      (!scope.buildingId || r.buildingId === scope.buildingId) &&
      within(r.submittedAt, from, to),
  );
}

function scopedUnits(scope: ReportScope): EquipmentUnit[] {
  return scope.units.filter(
    (u) => !scope.buildingId || u.buildingId === scope.buildingId,
  );
}

/** History rows in the period, for units inside the scope. */
function scopedHistory(scope: ReportScope): EquipmentHistoryEvent[] {
  const from = startMs(scope);
  const to = endMs(scope);
  const ids = new Set(scopedUnits(scope).map((u) => u.id));
  return scope.history.filter(
    (h) => ids.has(h.equipmentUnitId) && within(h.at, from, to),
  );
}

// Weeks

/**
 * Seven-day buckets from the period start. Calendar weeks would split a short
 * range awkwardly; a report over 2–20 September should read Wk 1–3, not
 * "week 36 to week 38".
 */
function weeksIn(
  scope: ReportScope,
  requests: MaintenanceRequest[],
): ReportWeek[] {
  const from = startMs(scope);
  const to = endMs(scope);
  const count = Math.max(1, Math.ceil((to - from) / (7 * DAY)));
  return Array.from({ length: count }, (_, i) => {
    const bucketFrom = from + i * 7 * DAY;
    const bucketTo = Math.min(to, bucketFrom + 7 * DAY - 1);
    const inBucket = requests.filter((r) =>
      within(r.submittedAt, bucketFrom, bucketTo),
    );
    return {
      label: `Wk ${i + 1}`,
      resolved: inBucket.filter(isFinished).length,
      carriedOver: inBucket.filter((r) => isRequestOpen(r.status)).length,
    };
  });
}

// Offenders

/** What a unit cost in the period: its requests plus its recorded services. */
function unitCost(
  unitId: string,
  requests: MaintenanceRequest[],
  history: EquipmentHistoryEvent[],
): number {
  const fromRequests = requests
    .filter((r) => r.equipmentId === unitId)
    .reduce((sum, r) => sum + (r.costMmk ?? 0), 0);
  const fromServices = history
    .filter((h) => h.equipmentUnitId === unitId)
    .reduce((sum, h) => sum + (h.costMmk ?? 0), 0);
  return fromRequests + fromServices;
}

/**
 * Hours a unit spent faulty in the period.
 *
 * Each `fault-reported` closes at the next `returned-to-service`, or at the
 * period end when it never closed — a unit still down has real downtime, it
 * just has no end yet. `ongoing` says which, so the report does not present an
 * open fault as a finished repair.
 */
function downtimeFor(
  unitId: string,
  history: EquipmentHistoryEvent[],
  to: number,
): { hours: number; ongoing: boolean } {
  const rows = history
    .filter(
      (h) =>
        h.equipmentUnitId === unitId &&
        (h.type === "fault-reported" || h.type === "returned-to-service"),
    )
    .sort((a, b) => a.at.localeCompare(b.at));

  let hours = 0;
  let ongoing = false;
  let openedAt: number | null = null;
  for (const row of rows) {
    const at = new Date(row.at).getTime();
    if (row.type === "fault-reported") {
      if (openedAt === null) openedAt = at;
    } else if (openedAt !== null) {
      hours += (at - openedAt) / HOUR;
      openedAt = null;
    }
  }
  if (openedAt !== null) {
    hours += (to - openedAt) / HOUR;
    ongoing = true;
  }
  return { hours: Math.round(hours), ongoing };
}

function offendersBy(
  scope: ReportScope,
  count: (unit: EquipmentUnit) => number,
): ReportOffender[] {
  const requests = scopedRequests(scope);
  const history = scopedHistory(scope);
  const to = endMs(scope);
  return scopedUnits(scope)
    .map((unit) => {
      const downtime = downtimeFor(unit.id, history, to);
      return {
        tag: unit.tag,
        unitLabel: scope.unitLabel(unit),
        faults: count(unit),
        downtimeHours: downtime.hours,
        ongoing: downtime.ongoing,
        costMmk: unitCost(unit.id, requests, history),
      };
    })
    .filter((o) => o.faults > 0 || o.downtimeHours > 0 || o.costMmk > 0)
    .sort(
      (a, b) =>
        b.faults - a.faults ||
        b.downtimeHours - a.downtimeHours ||
        b.costMmk - a.costMmk,
    )
    .slice(0, 8);
}

// The three kinds

export function buildMaintenanceReport(scope: ReportScope): ReportFigures {
  const requests = scopedRequests(scope);
  const finished = requests.filter(isFinished);
  const open = requests.filter((r) => isRequestOpen(r.status));

  const turnarounds = finished
    .map(
      (r) =>
        (new Date(r.updatedAt).getTime() - new Date(r.submittedAt).getTime()) /
        DAY,
    )
    .filter((d) => Number.isFinite(d) && d >= 0);
  const meanDays =
    turnarounds.length === 0
      ? 0
      : round1(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length);

  const kpis: ReportKpi[] = [
    {
      label: "Resolution rate",
      value: pct(finished.length, requests.length),
      unit: "%",
      target: 90,
      compare: "gte",
      targetLabel: "Target ≥ 90%",
    },
    {
      label: "Mean days to resolve",
      value: meanDays,
      unit: "d",
      target: 5,
      compare: "lte",
      targetLabel: "Target ≤ 5d",
    },
    {
      label: "Still open",
      value: open.length,
      unit: "",
      target: 5,
      compare: "lte",
      targetLabel: "Target ≤ 5",
    },
    {
      label: "Escalated",
      value: requests.filter((r) => isEscalated(r)).length,
      unit: "",
      target: 0,
      compare: "lte",
      targetLabel: "Target 0",
    },
  ];

  const perUnit = new Map<string, number>();
  for (const r of requests) {
    perUnit.set(r.equipmentId, (perUnit.get(r.equipmentId) ?? 0) + 1);
  }

  return {
    kpis,
    weeks: weeksIn(scope, requests),
    faultTypes: [],
    offenders: offendersBy(scope, (u) => perUnit.get(u.id) ?? 0),
    costs: [],
    spentMmk: requests.reduce((sum, r) => sum + (r.costMmk ?? 0), 0),
    notes: `${requests.length} request${requests.length === 1 ? "" : "s"} raised in this period, ${finished.length} resolved.`,
  };
}

export function buildReliabilityReport(scope: ReportScope): ReportFigures {
  const units = scopedUnits(scope);
  const history = scopedHistory(scope);
  const faults = history.filter((h) => h.type === "fault-reported");
  const to = endMs(scope);

  const perUnit = new Map<string, number>();
  for (const f of faults) {
    perUnit.set(f.equipmentUnitId, (perUnit.get(f.equipmentUnitId) ?? 0) + 1);
  }

  const byType = new Map<string, number>();
  for (const f of faults) {
    const unit = units.find((u) => u.id === f.equipmentUnitId);
    if (!unit) continue;
    byType.set(unit.typeId, (byType.get(unit.typeId) ?? 0) + 1);
  }
  const faultTypes: ReportFaultType[] = Array.from(byType.entries())
    .map(([typeId, count]) => ({ typeLabel: scope.typeLabel(typeId), count }))
    .sort((a, b) => b.count - a.count);

  // Mean time to repair counts closed repairs only. Averaging in a fault that
  // is still open would report a repair time for work nobody has finished.
  const closed = units
    .map((u) => downtimeFor(u.id, history, to))
    .filter((d) => !d.ongoing && d.hours > 0);
  const mttr =
    closed.length === 0
      ? 0
      : round1(closed.reduce((a, d) => a + d.hours, 0) / closed.length);

  const kpis: ReportKpi[] = [
    {
      label: "Faults recorded",
      value: faults.length,
      unit: "",
      target: 0,
      compare: "lte",
      targetLabel: "Target 0",
    },
    {
      label: "Units affected",
      value: perUnit.size,
      unit: "",
      target: 0,
      compare: "lte",
      targetLabel: "Target 0",
    },
    {
      label: "Mean time to repair",
      value: mttr,
      unit: "h",
      target: 48,
      compare: "lte",
      targetLabel: "Target ≤ 48h",
    },
    {
      label: "Register healthy",
      value: pct(
        units.filter((u) => u.condition === "healthy").length,
        units.length,
      ),
      unit: "%",
      target: 90,
      compare: "gte",
      targetLabel: "Target ≥ 90%",
    },
  ];

  const stillDown = units.filter(
    (u) => downtimeFor(u.id, history, to).ongoing,
  ).length;

  return {
    kpis,
    weeks: [],
    faultTypes,
    offenders: offendersBy(scope, (u) => perUnit.get(u.id) ?? 0),
    costs: [],
    spentMmk: 0,
    notes:
      stillDown > 0
        ? `${faults.length} fault${faults.length === 1 ? "" : "s"} across ${perUnit.size} unit${perUnit.size === 1 ? "" : "s"}. ${stillDown} still awaiting a return to service, so their downtime is counted to the end of the period and is still running.`
        : `${faults.length} fault${faults.length === 1 ? "" : "s"} across ${perUnit.size} unit${perUnit.size === 1 ? "" : "s"}, all returned to service.`,
  };
}

export function buildCostReport(scope: ReportScope): ReportFigures {
  const requests = scopedRequests(scope);
  const history = scopedHistory(scope);
  const units = scopedUnits(scope);

  const finished = requests.filter(isFinished);
  const priced = finished.filter((r) => r.costMmk !== undefined);

  // Grouped by equipment type, which is the only grouping the record supports.
  // Parts / labour / contractor would have to be invented.
  const byType = new Map<string, number>();
  const add = (unitId: string, amount: number) => {
    if (amount <= 0) return;
    const unit = units.find((u) => u.id === unitId);
    const key = unit ? scope.typeLabel(unit.typeId) : "Unattributed";
    byType.set(key, (byType.get(key) ?? 0) + amount);
  };
  for (const r of requests) add(r.equipmentId, r.costMmk ?? 0);
  for (const h of history) add(h.equipmentUnitId, h.costMmk ?? 0);

  const total = Array.from(byType.values()).reduce((a, b) => a + b, 0);
  const costs: ReportCostLine[] = Array.from(byType.entries())
    .map(([label, valueMmk]) => ({ label, valueMmk }))
    .sort((a, b) => b.valueMmk - a.valueMmk);
  if (costs.length > 0) {
    costs.push({ label: "Total", valueMmk: total, isTotal: true });
  }

  const mean =
    priced.length === 0
      ? 0
      : Math.round(
          priced.reduce((sum, r) => sum + (r.costMmk ?? 0), 0) / priced.length,
        );

  const kpis: ReportKpi[] = [
    {
      label: "Total spent",
      value: total,
      unit: "MMK",
      target: 0,
      compare: "gte",
      targetLabel: "Recorded spend",
    },
    {
      label: "Mean per request",
      value: mean,
      unit: "MMK",
      target: 0,
      compare: "gte",
      targetLabel: "Across priced requests",
    },
    {
      label: "Cost coverage",
      value: pct(priced.length, finished.length),
      unit: "%",
      target: 100,
      compare: "gte",
      targetLabel: "Target 100%",
    },
    {
      label: "Priced requests",
      value: priced.length,
      unit: "",
      target: finished.length,
      compare: "gte",
      targetLabel: `of ${finished.length} resolved`,
    },
  ];

  const missing = finished.length - priced.length;
  return {
    kpis,
    weeks: [],
    faultTypes: [],
    offenders: [],
    costs,
    spentMmk: total,
    notes:
      missing > 0
        ? `${missing} of ${finished.length} resolved request${finished.length === 1 ? "" : "s"} carry no cost, so this total is a floor rather than the full spend. Cost is captured when a request is marked resolved.`
        : `Every resolved request in this period carries a cost.`,
  };
}

export function buildReport(
  kind: ReportKind,
  scope: ReportScope,
): ReportFigures {
  if (kind === "equipment-reliability") return buildReliabilityReport(scope);
  if (kind === "cost-of-maintenance") return buildCostReport(scope);
  return buildMaintenanceReport(scope);
}
