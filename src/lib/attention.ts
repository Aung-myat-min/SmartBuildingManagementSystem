// What on the estate needs looking at.
//
// The Dashboard's Live alerts rail used to read a hardcoded array, so it
// showed the same three invented rows forever — including an air conditioner
// "under maintenance since Monday" that matched no unit on the register.
//
// Derived and pure, like derive.ts: the rail can only ever say things that are
// true of the live data, and there is nothing to keep in sync.

import { daysUntilService, isSensorOffline } from "@/lib/derive";
import type {
  EnvironmentalSensor,
  EquipmentUnit,
  SensorTypeDef,
} from "@/lib/types";

export type AttentionSeverity =
  | "alarm"
  | "faulty"
  | "offline"
  | "maint"
  | "overdue";

export interface AttentionItem {
  id: string;
  sev: AttentionSeverity;
  tone: "danger" | "warning" | "info" | "neutral";
  /** What is wrong, in one line. */
  detail: string;
  location: string;
  /** When it started, ISO. The rail shows this as an age. */
  since: string;
  /** The record it is about. */
  href: string;
}

export interface AttentionScope {
  sensors: EnvironmentalSensor[];
  units: EquipmentUnit[];
  /** Absent means the whole estate. */
  buildingId?: string;
  typeLabel: (typeId: string) => string;
  sensorType: (typeId: string) => SensorTypeDef | undefined;
  roomLabel: (roomId: string) => string;
  buildingName: (buildingId: string) => string;
}

/** Worst first. Within a severity, whatever has been wrong longest. */
const ORDER: Record<AttentionSeverity, number> = {
  alarm: 0,
  faulty: 1,
  offline: 2,
  maint: 3,
  overdue: 4,
};

const TONE: Record<AttentionSeverity, AttentionItem["tone"]> = {
  alarm: "danger",
  faulty: "danger",
  offline: "neutral",
  maint: "info",
  overdue: "warning",
};

export function attentionItems(
  scope: AttentionScope,
  now = Date.now(),
): AttentionItem[] {
  const inScope = <T extends { buildingId: string }>(rows: T[]) =>
    rows.filter((r) => !scope.buildingId || r.buildingId === scope.buildingId);

  const out: AttentionItem[] = [];

  for (const s of inScope(scope.sensors)) {
    const type = scope.sensorType(s.typeId);
    const status = type?.statuses.find((st) => st.id === s.status);
    const where = `${scope.buildingName(s.buildingId)} / ${scope.roomLabel(s.roomId)}`;
    const at = s.statusChangedAt ?? s.updatedAt;

    // An alarm takes precedence over the same device also being offline —
    // one row per device, saying the worse thing.
    if (status?.isAlarm) {
      out.push({
        id: `alarm:${s.id}`,
        sev: "alarm",
        tone: TONE.alarm,
        detail: `${type?.label ?? "Sensor"} ${status.label.toLowerCase()}`,
        location: `${where} · ${s.id}`,
        since: at,
        href: `/sensors?device=${s.id}`,
      });
    } else if (isSensorOffline(s.status)) {
      out.push({
        id: `offline:${s.id}`,
        sev: "offline",
        tone: TONE.offline,
        detail: `${type?.label ?? "Sensor"} not reporting`,
        location: `${where} · ${s.id}`,
        since: at,
        href: `/sensors?device=${s.id}`,
      });
    }
  }

  for (const u of inScope(scope.units)) {
    const where = `${scope.buildingName(u.buildingId)} / ${scope.roomLabel(u.roomId)}`;
    const label = scope.typeLabel(u.typeId);

    if (u.condition === "faulty") {
      out.push({
        id: `faulty:${u.id}`,
        sev: "faulty",
        tone: TONE.faulty,
        detail: `${label} marked faulty`,
        location: `${where} · ${u.tag}`,
        since: u.nextServiceDue,
        href: "/equipment",
      });
      continue;
    }
    if (u.condition === "under-maintenance") {
      out.push({
        id: `maint:${u.id}`,
        sev: "maint",
        tone: TONE.maint,
        detail: `${label} held under maintenance`,
        location: `${where} · ${u.tag}`,
        since: u.lastServiceAt ?? u.installedAt,
        href: "/equipment",
      });
      continue;
    }
    // Overdue, not merely due: a service date in the past is a failure, a
    // service date next week is a board column.
    if (u.condition === "healthy" && daysUntilService(u, now) < 0) {
      const over = Math.abs(daysUntilService(u, now));
      out.push({
        id: `overdue:${u.id}`,
        sev: "overdue",
        tone: TONE.overdue,
        detail: `${label} service ${over} day${over === 1 ? "" : "s"} overdue`,
        location: `${where} · ${u.tag}`,
        since: u.nextServiceDue,
        href: "/equipment",
      });
    }
  }

  return out.sort(
    (a, b) => ORDER[a.sev] - ORDER[b.sev] || a.since.localeCompare(b.since),
  );
}
