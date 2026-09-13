// ============================================================================
// Derived values.
//
// Six things in this product look like stored fields and are not: escalation,
// due-service, forced-open, offline, open-request counts and report KPI
// pass/fail. Storing the inputs and deriving these at read time means a
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
} from "./types";

// ---- Thresholds ------------------------------------------------------------

/** A high-priority request past this age, still open, is escalated. */
export const ESCALATION_WINDOW_HOURS = 24;

/** A healthy unit this close to its next service shows as due. */
export const DUE_SERVICE_DAYS = 30;

// ---- Requests --------------------------------------------------------------

export const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  "pending",
  "in-progress",
];

export function isRequestOpen(status: RequestStatus): boolean {
  return status === "pending" || status === "in-progress";
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

// ---- Sensors ---------------------------------------------------------------

/**
 * An offline device has stopped reporting, so it raises no alarms — screens
 * showing an offline sensor have to say so rather than imply all-clear.
 */
export function isSensorOffline(status: string): boolean {
  return status === "offline";
}

export function isAlarmStatus(status: string): boolean {
  return status === "triggered" || status === "forced-open";
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
