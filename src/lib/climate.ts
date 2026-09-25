// The estate's climate, one row per room.
//
// Every summary on the Monitoring tab — the floor grid, the status donut, the
// KPI row, the needs-attention list — is a different view of the same list, so
// the list is built once, here, and they cannot disagree about how many rooms
// are in trouble.
//
// A room has several sensors and one status, which means a rule for picking:
// the worst one wins, because a room that is comfortable on temperature and
// choking on CO2 is not comfortable.
//
// Pure, so the arithmetic behind a number on a dashboard is testable without
// Firestore, a clock or a browser.

import { isSensorOffline } from "@/lib/derive";
import { bandFor } from "@/lib/sensor-readings";
import type {
  EnvironmentalSensor,
  Room,
  RoomType,
  SensorTypeDef,
  Tone,
} from "@/lib/types";

/** One measuring sensor, resolved against the limits its room is judged by. */
export interface RoomReading {
  sensorId: string;
  typeId: string;
  typeLabel: string;
  value: number;
  unit: string;
  decimals: number;
  statusId: string;
  statusLabel: string;
  tone: Tone;
  isAlarm: boolean;
  /** When this sensor last changed band — how long it has been like this. */
  since?: string;
}

export interface RoomClimate {
  roomId: string;
  buildingId: string;
  floor: string;
  roomNumber: string;
  roomType: RoomType;
  readings: RoomReading[];
  /** The worst tone across this room's measuring sensors. */
  tone: Tone;
  /** The reading driving that tone, if any measuring sensor reported. */
  worst?: RoomReading;
  /** No measuring sensor in this room is reporting. */
  offline: boolean;
  /** Any sensor in the room sitting in an alarm status. */
  hasAlarm: boolean;
}

/**
 * Worst first. A room shows one status and this decides which.
 *
 * `info` outranks `success` but not `warning`: too cold is worth seeing and
 * not worth interrupting anyone over.
 */
const SEVERITY: Record<Tone, number> = {
  danger: 4,
  warning: 3,
  info: 2,
  neutral: 1,
  success: 0,
};

export function roomClimates(
  rooms: Room[],
  sensors: EnvironmentalSensor[],
  types: SensorTypeDef[],
  /** Live values where the simulation has them; the stored reading otherwise. */
  readings: Record<string, number>,
): RoomClimate[] {
  const typeById = new Map(types.map((t) => [t.id, t]));

  return rooms.map((room) => {
    const inRoom = sensors.filter((s) => s.roomId === room.id);
    const resolved: RoomReading[] = [];

    for (const sensor of inRoom) {
      const type = typeById.get(sensor.typeId);
      const m = type?.measurement;
      if (!type || !m) continue; // a door lock has no number to summarise
      const value = readings[sensor.id] ?? sensor.reading;
      if (value === undefined || isSensorOffline(sensor.status)) continue;

      const band = bandFor(type, value, room.type);
      const def = type.statuses.find((st) => st.id === band?.statusId);
      if (!band || !def) continue;

      resolved.push({
        sensorId: sensor.id,
        typeId: type.id,
        typeLabel: type.label,
        value,
        unit: m.unit,
        decimals: m.decimals,
        statusId: def.id,
        statusLabel: def.label,
        tone: def.tone,
        isAlarm: def.isAlarm,
        since: sensor.statusChangedAt,
      });
    }

    // Worst first, so `worst` is simply the head and the list reads in the
    // order somebody would want to be told.
    resolved.sort((a, b) => SEVERITY[b.tone] - SEVERITY[a.tone]);
    const worst = resolved[0];
    const measuring = inRoom.some((s) =>
      Boolean(typeById.get(s.typeId)?.measurement),
    );

    return {
      roomId: room.id,
      buildingId: room.buildingId,
      floor: room.floor,
      roomNumber: room.roomNumber,
      roomType: room.type,
      readings: resolved,
      // A room with measuring sensors that are all quiet is offline, not
      // comfortable — saying "comfortable" about a room nobody can hear is the
      // one answer that is worse than saying nothing.
      tone: worst ? worst.tone : "neutral",
      worst,
      offline: measuring && resolved.length === 0,
      hasAlarm: resolved.some((r) => r.isAlarm),
    };
  });
}

export interface ClimateSummary {
  total: number;
  comfortable: number;
  warning: number;
  alarm: number;
  offline: number;
  /** Rooms in a good band, as a share of those actually reporting. */
  comfortPct: number;
}

/**
 * The counts every headline on the tab is drawn from.
 *
 * `comfortPct` is a share of the rooms that are *reporting*, not of every
 * room. A building where half the sensors are dark is not 50% comfortable; it
 * is unknown, and the offline count beside it is what says so.
 */
export function summarise(climates: RoomClimate[]): ClimateSummary {
  let comfortable = 0;
  let warning = 0;
  let alarm = 0;
  let offline = 0;

  for (const c of climates) {
    if (c.offline) offline += 1;
    else if (c.hasAlarm || c.tone === "danger") alarm += 1;
    else if (c.tone === "warning" || c.tone === "info") warning += 1;
    else if (c.readings.length > 0) comfortable += 1;
  }

  const reporting = comfortable + warning + alarm;
  return {
    total: climates.length,
    comfortable,
    warning,
    alarm,
    offline,
    comfortPct:
      reporting === 0 ? 0 : Math.round((comfortable / reporting) * 100),
  };
}

/**
 * The average of one measure across the estate, or null where nothing reports.
 *
 * Null rather than zero: "0 ppm" is a reading, and a dashboard that shows one
 * when every sensor is dark is lying rather than silent.
 */
export function averageOf(
  climates: RoomClimate[],
  typeId: string,
): { value: number; unit: string; decimals: number } | null {
  const rows = climates
    .flatMap((c) => c.readings)
    .filter((r) => r.typeId === typeId);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return {
    value: total / rows.length,
    unit: rows[0].unit,
    decimals: rows[0].decimals,
  };
}

/** Rooms that want attention, worst and longest-standing first. */
export function needsAttention(climates: RoomClimate[]): RoomClimate[] {
  return climates
    .filter((c) => c.hasAlarm || c.tone === "danger" || c.tone === "warning")
    .sort((a, b) => {
      const bySeverity = SEVERITY[b.tone] - SEVERITY[a.tone];
      if (bySeverity !== 0) return bySeverity;
      // Then whichever has been wrong longest — an hour of stuffiness is a
      // worse miss than a minute of it.
      return (a.worst?.since ?? "").localeCompare(b.worst?.since ?? "");
    });
}
