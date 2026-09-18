// ============================================================================
// Derived values.
//
// Six things in this product look like stored fields and are not: escalation,
// due-service, offline, a status's current tone, open-request counts and
// report KPI pass/fail. Whether a status counts as an alarm is no longer one
// of them — it is a flag on the sensor type's registry entry. Storing the inputs and deriving these at read time means a
// threshold change is an edit here, not a data migration.
//
// Every screen reads these helpers rather than re-implementing the rule, so
// the sidebar badge, the toolbar chip, the building cards and the dashboard
// tiles can never disagree with each other.
// ============================================================================

// This module stays free of data imports so mock-data (and later Firebase)
// can apply the rules without a cycle: format -> derive -> data -> app-state.

import { ageHours } from "./format";
import type {
  EquipmentCondition,
  EquipmentUnit,
  MaintenanceRequest,
  ReportKpi,
  RequestStatus,
  SensorStatusDef,
  Tone,
} from "./types";

// ---- Thresholds ------------------------------------------------------------

/** A high-priority request past this age, still open, is escalated. */
export const ESCALATION_WINDOW_HOURS = 24;

/** A healthy unit this close to its next service shows as due. */
export const DUE_SERVICE_DAYS = 30;

// ---- Requests --------------------------------------------------------------

// Open means still owed to somebody. An unapproved request counts: nobody
// has looked at it yet, which is the worst kind of outstanding, and a
// high-priority one left unapproved escalates like any other.
export const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  "requested",
  "approved",
  "in-progress",
];

export function isRequestOpen(status: RequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status);
}

/**
 * High priority, still open, and older than the escalation window.
 * Pass the live status when the request carries an in-session override.
 */
export function isEscalated(
  request: MaintenanceRequest,
  status: RequestStatus = request.status,
  now = Date.now(),
): boolean {
  return (
    request.priority === "high" &&
    isRequestOpen(status) &&
    ageHours(request.submittedAt, now) > ESCALATION_WINDOW_HOURS
  );
}

/**
 * The one open-request count. Callers pass an already-resolved list so the
 * number reflects in-session moves; scope it to a building or leave it open
 * for the whole estate.
 */
export function countOpenRequests(
  requests: MaintenanceRequest[],
  buildingId?: string,
): number {
  return requests.filter(
    (r) =>
      isRequestOpen(r.status) &&
      (buildingId === undefined || r.buildingId === buildingId),
  ).length;
}

export function countEscalated(
  requests: MaintenanceRequest[],
  buildingId?: string,
  now = Date.now(),
): number {
  return requests.filter(
    (r) =>
      isEscalated(r, r.status, now) &&
      (buildingId === undefined || r.buildingId === buildingId),
  ).length;
}

// ---- Equipment -------------------------------------------------------------

/** Board columns are the four conditions plus a computed fifth. */
export type EquipmentBoardColumn = EquipmentCondition | "due-service";

export function daysUntilService(
  unit: EquipmentUnit,
  now = Date.now(),
): number {
  return Math.ceil((new Date(unit.nextServiceDue).getTime() - now) / 86400000);
}

/**
 * Due for service is a view of a healthy unit, never a stored condition —
 * which is why it can be a board column without being an EquipmentCondition.
 */
export function isDueService(
  unit: EquipmentUnit,
  condition: EquipmentCondition = unit.condition,
  now = Date.now(),
): boolean {
  return (
    condition === "healthy" && daysUntilService(unit, now) <= DUE_SERVICE_DAYS
  );
}

export function boardColumnFor(
  unit: EquipmentUnit,
  condition: EquipmentCondition = unit.condition,
  now = Date.now(),
): EquipmentBoardColumn {
  return isDueService(unit, condition, now) ? "due-service" : condition;
}

/**
 * The room-level running / faulty / under-maintenance split, counted off the
 * register rather than stored beside it.
 *
 * There used to be a second table holding these numbers, authored separately
 * from the units, and the two had drifted: it claimed 24 desktop PCs nobody
 * had registered and an air conditioner in a room with no assets. Counting
 * makes `running + faulty + underMaintenance === total` true by construction
 * instead of by maintenance, and means marking a unit faulty moves the tile.
 */
export interface EquipmentBreakdown {
  running: number;
  faulty: number;
  underMaintenance: number;
  total: number;
}

export function equipmentBreakdown(
  units: { condition: EquipmentCondition }[],
): EquipmentBreakdown {
  // Decommissioned units are off the estate, not a state it can be in.
  const live = units.filter((u) => u.condition !== "decommissioned");
  return {
    running: live.filter((u) => u.condition === "healthy").length,
    faulty: live.filter((u) => u.condition === "faulty").length,
    underMaintenance: live.filter((u) => u.condition === "under-maintenance")
      .length,
    total: live.length,
  };
}

/**
 * Open requests against one unit. Was a stored `openRequestCount` field — a
 * third copy of a fact the request list already holds, which every request
 * move would have had to remember to update.
 */
export function openRequestsForUnit(
  requests: Pick<MaintenanceRequest, "equipmentId" | "status">[],
  unitId: string,
): number {
  return requests.filter(
    (r) => r.equipmentId === unitId && isRequestOpen(r.status),
  ).length;
}

// ---- Sensors ---------------------------------------------------------------

/**
 * An offline device has stopped reporting, so it raises no alarms — screens
 * showing an offline sensor have to say so rather than imply all-clear.
 */
export function isSensorOffline(status: string): boolean {
  return status === "offline";
}

/**
 * The colour a status is drawn in *now*. Most statuses have one tone for
 * good. A status carrying `escalateAfterMinutes` has two: it holds its
 * resting tone while the state is brief, then moves to `escalateTone` once
 * it has persisted — an unlocked door is blue for half an hour and amber
 * after that. `since` is when the sensor entered the status, not when it
 * last reported.
 */
export function statusTone(
  def: Pick<SensorStatusDef, "tone" | "escalateAfterMinutes" | "escalateTone">,
  since: string,
  now = Date.now(),
): Tone {
  const { escalateAfterMinutes, escalateTone } = def;
  if (escalateAfterMinutes === undefined || escalateTone === undefined) {
    return def.tone;
  }
  const minutes = (now - new Date(since).getTime()) / 60000;
  return minutes >= escalateAfterMinutes ? escalateTone : def.tone;
}

// ---- Reports ---------------------------------------------------------------

/** Pass or fail is the value measured against the target, never a stored flag. */
export function kpiPasses(kpi: ReportKpi): boolean {
  switch (kpi.compare) {
    case "gte":
      return kpi.value >= kpi.target;
    case "lte":
      return kpi.value <= kpi.target;
    case "lt":
      return kpi.value < kpi.target;
  }
}
