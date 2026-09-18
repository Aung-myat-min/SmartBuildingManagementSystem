// ============================================================================
// Estate rules that have to hold whatever is writing — pure, so they can be
// tested without a browser or a database, the same reason derive.ts imports
// no data.
// ============================================================================

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
 * Deleting used to cascade to the building's rooms and stop there, leaving its
 * equipment, sensors, requests and log entries pointing at an id that no
 * longer resolved — invisible while it was all in memory, permanent once it is
 * documents. Refusing is also the house pattern: archiveSensorType already
 * refuses while anything still uses a type, and says how many.
 *
 * Empty rooms are not a reason to refuse — they belong to the building and go
 * with it. Anything that could outlive it is.
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
