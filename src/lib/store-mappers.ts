// ============================================================================
// Firestore document → domain type. One module for every collection's mapper.
//
// These are pure and import nothing but types, deliberately: the collection
// modules pull in `@/lib/firebase`, which throws without a configured project,
// so anything living beside them is untestable. The mapping is the part worth
// testing — the Timestamp boundary, the fallbacks, the fields a half-written
// document has not got yet — so it lives here instead.
// ============================================================================

import type { Timestamp } from "firebase/firestore";
import type {
  Building,
  EnvironmentalSensor,
  LogBookEntry,
  Room,
  SensorTypeDef,
} from "@/lib/types";

/**
 * A Firestore `Timestamp` as an ISO string. ISO everywhere above this line —
 * no page, no derive rule and no formatter ever sees a Timestamp.
 *
 * The null case is not padding: a document written with `serverTimestamp()`
 * comes back from the *local* snapshot with that field still null, before the
 * server has stamped it. Falling back to now keeps a freshly written row from
 * rendering blank and then jumping in the sort a moment later.
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
    updatedAt: d.updatedAt ?? new Date().toISOString(),
  };
}
