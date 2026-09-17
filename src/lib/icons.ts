import {
  Activity,
  DoorClosed,
  Droplet,
  Flame,
  Lock,
  type LucideIcon,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import type { SensorIconKey } from "@/lib/types";

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
