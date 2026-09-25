import {
  Activity,
  Briefcase,
  DoorClosed,
  Droplet,
  Flame,
  FlaskConical,
  Lock,
  type LucideIcon,
  Presentation,
  Server,
  Thermometer,
  Users,
  Wind,
  Zap,
} from "lucide-react";
import type { RoomType, SensorIconKey } from "@/lib/types";

/**
 * A sensor type stores an icon *key*, not a component, so a registry entry
 * stays serialisable plain data. This is the one place the key becomes a
 * glyph — the allowlist is the SensorIconKey union in lib/types.ts.
 */
export const SENSOR_ICONS: Record<SensorIconKey, LucideIcon> = {
  flame: Flame,
  lock: Lock,
  door: DoorClosed,
  thermometer: Thermometer,
  droplet: Droplet,
  wind: Wind,
  zap: Zap,
  activity: Activity,
};

/** The picker's order, and the fallback for a key that no longer resolves. */
export const SENSOR_ICON_KEYS = Object.keys(SENSOR_ICONS) as SensorIconKey[];

export function sensorIcon(key: SensorIconKey | string): LucideIcon {
  return SENSOR_ICONS[key as SensorIconKey] ?? Activity;
}

/**
 * A glyph per kind of room.
 *
 * `RoomType` is a closed union rather than a registry, so unlike the sensor
 * icons above this needs no key indirection and no fallback — the compiler
 * will not let a new room type ship without one.
 */
export const ROOM_TYPE_ICONS: Record<RoomType, LucideIcon> = {
  office: Briefcase,
  lecture: Presentation,
  lab: FlaskConical,
  plant: Server,
  common: Users,
};

/** How a room type is written where it is shown to somebody. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  office: "Office",
  lecture: "Lecture hall",
  lab: "Teaching lab",
  plant: "Plant / server room",
  common: "Common area",
};
