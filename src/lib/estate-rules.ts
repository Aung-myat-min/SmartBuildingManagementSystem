// Estate rules that have to hold whatever is writing — pure, so they can be
// tested without a browser or a database, the same reason derive.ts imports
// no data.

import { isRequestOpen } from "@/lib/derive";
import type {
  EnvironmentalSensor,
  EquipmentUnit,
  MaintenanceRequest,
  Room,
} from "@/lib/types";

/**
 * Why a building cannot be deleted, or null when it can.
 *
 * Deleting cascades to its rooms — they belong to it — but refuses while
 * equipment, sensors or open requests still point at the id, and says how many
 * of each. Same shape as archiveSensorType. Orphaned references were invisible
 * in memory and are permanent as documents.
 */
export function buildingDeletionRefusal(
  buildingId: string,
  estate: {
    units: Pick<EquipmentUnit, "buildingId">[];
    sensors: Pick<EnvironmentalSensor, "buildingId">[];
    requests: Pick<MaintenanceRequest, "buildingId" | "status">[];
  },
): string | null {
  const units = estate.units.filter((u) => u.buildingId === buildingId).length;
  const sensors = estate.sensors.filter(
    (s) => s.buildingId === buildingId,
  ).length;
  const requests = estate.requests.filter(
    (r) => r.buildingId === buildingId && isRequestOpen(r.status),
  ).length;

  const held: string[] = [];
  if (units > 0) held.push(`${units} equipment unit${units === 1 ? "" : "s"}`);
  if (sensors > 0) held.push(`${sensors} sensor${sensors === 1 ? "" : "s"}`);
  if (requests > 0) {
    held.push(`${requests} open request${requests === 1 ? "" : "s"}`);
  }
  if (held.length === 0) return null;

  return `This building still holds ${listPhrase(held)}. Move or remove them before deleting it.`;
}

/** The rooms that go with a building when it is deleted. */
export function roomsToCascade(buildingId: string, rooms: Room[]): Room[] {
  return rooms.filter((r) => r.buildingId === buildingId);
}

function listPhrase(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The floors a room in this building can be on: ground, then 1..floors.
 *
 * The room form used to offer a fixed G/1/2/3 regardless of the building it
 * was adding to, so a two-storey block happily accepted a Floor 3 room.
 */
export function floorsFor(floors: number): string[] {
  const count = Math.max(0, Math.floor(floors));
  return ["G", ...Array.from({ length: count }, (_, i) => String(i + 1))];
}
