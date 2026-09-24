// Firestore document → domain type. One module for every collection's mapper.
//
// Pure, importing only types, deliberately: the store modules pull in
// `@/lib/firebase`, which throws without a configured project, so anything
// beside them is untestable. The mapping is the part worth testing.

import type { Timestamp } from "firebase/firestore";
import type {
  Building,
  EnvironmentalSensor,
  EquipmentHistoryEvent,
  EquipmentTypeDef,
  EquipmentUnit,
  LogBookEntry,
  MaintenanceRequest,
  ReportDetail,
  Room,
  SensorTypeDef,
} from "@/lib/types";

/**
 * A Firestore `Timestamp` as an ISO string — nothing above this line ever sees
 * a Timestamp.
 *
 * The null case is not padding: `serverTimestamp()` reads back null from the
 * *local* snapshot before the server stamps it, so a fresh row would render
 * blank and then jump in the sort.
 */
export function toIso(stamp: Timestamp | null | undefined): string {
  return stamp ? stamp.toDate().toISOString() : new Date().toISOString();
}

export function toLogEntry(
  id: string,
  data: Record<string, unknown>,
): LogBookEntry {
  const d = data as Partial<LogBookEntry> & { timestamp?: Timestamp };
  return {
    id,
    timestamp: toIso(d.timestamp),
    actorUid: d.actorUid,
    actorName: d.actorName ?? "System",
    actorRole: d.actorRole,
    source: d.source ?? "admin",
    actionType: d.actionType ?? "request-status-changed",
    title: d.title ?? "",
    detail: d.detail ?? "",
    targetType: d.targetType ?? "request",
    targetId: d.targetId ?? "",
    buildingId: d.buildingId,
    refId: d.refId,
    reason: d.reason,
  };
}

export function toEquipmentType(
  id: string,
  data: Record<string, unknown>,
): EquipmentTypeDef {
  const d = data as Partial<EquipmentTypeDef>;
  return {
    id,
    label: d.label ?? id,
    controls: d.controls,
    archived: d.archived ?? false,
  };
}

export function toBuilding(
  id: string,
  data: Record<string, unknown>,
): Building {
  const d = data as Partial<Building>;
  return {
    id,
    name: d.name ?? id,
    code: d.code ?? "",
    // A building written before floors existed still has to render a room
    // form, so it falls back to a single storey rather than NaN.
    floors: typeof d.floors === "number" && d.floors > 0 ? d.floors : 1,
    address: d.address,
    description: d.description,
  };
}

export function toRoom(id: string, data: Record<string, unknown>): Room {
  const d = data as Partial<Room>;
  return {
    id,
    buildingId: d.buildingId ?? "",
    roomNumber: d.roomNumber ?? id,
    type: d.type ?? "common",
    floor: d.floor ?? "G",
  };
}

export function toSensorType(
  id: string,
  data: Record<string, unknown>,
): SensorTypeDef {
  const d = data as Partial<SensorTypeDef>;
  return {
    id,
    label: d.label ?? id,
    icon: d.icon ?? "activity",
    // A type with no statuses cannot render a sensor at all, so a malformed
    // document falls back to something the UI can draw rather than crashing
    // the page that reads it.
    statuses: d.statuses?.length
      ? d.statuses
      : [{ id: "unknown", label: "Unknown", tone: "neutral", isAlarm: false }],
    actions: d.actions ?? [],
    archived: d.archived ?? false,
    measurement: d.measurement,
  };
}

export function toSensor(
  id: string,
  data: Record<string, unknown>,
): EnvironmentalSensor {
  const d = data as Partial<EnvironmentalSensor>;
  return {
    id,
    buildingId: d.buildingId ?? "",
    roomId: d.roomId ?? "",
    typeId: d.typeId ?? "",
    status: d.status ?? "",
    linkedEquipmentId: d.linkedEquipmentId,
    statusChangedAt: d.statusChangedAt,
    reading: d.reading,
    updatedAt: d.updatedAt ?? new Date().toISOString(),
  };
}

export function toEquipmentUnit(
  id: string,
  data: Record<string, unknown>,
): EquipmentUnit {
  const d = data as Partial<EquipmentUnit>;
  return {
    id,
    // One identifier. The tag is an ordinary editable field, but a unit that
    // has never been renamed has no separate value for it.
    tag: d.tag ?? id,
    buildingId: d.buildingId ?? "",
    roomId: d.roomId ?? "",
    typeId: d.typeId ?? "",
    condition: d.condition ?? "healthy",
    installedAt: d.installedAt ?? "",
    nextServiceDue: d.nextServiceDue ?? "",
    lastServiceAt: d.lastServiceAt,
    serviceIntervalDays: d.serviceIntervalDays,
    hvac: d.hvac,
  };
}

export function toEquipmentHistory(
  id: string,
  data: Record<string, unknown>,
): EquipmentHistoryEvent {
  const d = data as Partial<EquipmentHistoryEvent>;
  return {
    id,
    equipmentUnitId: d.equipmentUnitId ?? "",
    type: d.type ?? "service",
    // An ISO string rather than a Timestamp, unlike the Log Book. Firestore
    // orders by type before value, so a collection holding both would sort
    // into two separate blocks — and the seeded rows are already strings.
    at: d.at ?? "",
    summary: d.summary ?? "",
    actorName: d.actorName ?? "System",
  };
}

export function toRequest(
  id: string,
  data: Record<string, unknown>,
): MaintenanceRequest {
  const d = data as Partial<MaintenanceRequest>;
  return {
    id,
    buildingId: d.buildingId ?? "",
    roomId: d.roomId ?? "",
    equipmentId: d.equipmentId ?? "",
    issue: d.issue ?? "",
    priority: d.priority ?? "normal",
    // Approval is the first step, so an unreadable status is the one the
    // request would have started at rather than one further along.
    status: d.status ?? "requested",
    submittedBy: d.submittedBy ?? "",
    submittedByName: d.submittedByName ?? "",
    submittedAt: d.submittedAt ?? "",
    updatedAt: d.updatedAt ?? d.submittedAt ?? "",
    notes: d.notes,
    declineNote: d.declineNote,
    verificationRequested: d.verificationRequested,
    withdrawn: d.withdrawn,
    costMmk: d.costMmk,
  };
}

export function toReport(
  id: string,
  data: Record<string, unknown>,
): ReportDetail {
  const d = data as Partial<ReportDetail>;
  return {
    id,
    kind: d.kind ?? "maintenance-performance",
    period: d.period ?? "",
    periodStart: d.periodStart ?? "",
    periodEnd: d.periodEnd ?? "",
    buildingId: d.buildingId,
    generatedAt: d.generatedAt ?? "",
    generatedBy: d.generatedBy ?? "System",
    status: d.status ?? "ready",
    // The snapshot. A report written before a section existed simply has none
    // of it, which renders as an empty section rather than a crash.
    kpis: d.kpis ?? [],
    weeks: d.weeks ?? [],
    faultTypes: d.faultTypes ?? [],
    offenders: d.offenders ?? [],
    costs: d.costs ?? [],
    budgetMmk: d.budgetMmk,
    spentMmk: d.spentMmk ?? 0,
    notes: d.notes ?? "",
  };
}
