"use client";

import type { RoomClimate } from "@/lib/climate";
import type { Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Every room in a building, by floor, coloured by how it is doing.
 *
 * The one view that answers "is the building all right?" without reading
 * anything. Twelve cards in a grid make you scan twelve numbers; this makes
 * you scan for a colour that is not green, and the floors give it the shape of
 * the actual building so the answer carries a location with it.
 *
 * Each tile still carries its room number and status in words — the colour is
 * the fast path, never the only one.
 */
export function ClimateGrid({
  climates,
  selectedRoomId,
  onSelect,
}: {
  climates: RoomClimate[];
  selectedRoomId?: string;
  onSelect?: (roomId: string) => void;
}) {
  // Top floor first, the way a building is drawn rather than the way strings
  // sort: "G" and "B" are floors too, and they belong at the bottom.
  const byFloor = new Map<string, RoomClimate[]>();
  for (const c of climates) {
    byFloor.set(c.floor, [...(byFloor.get(c.floor) ?? []), c]);
  }
  const floors = [...byFloor.entries()].sort(([a], [b]) => compareFloors(a, b));

  if (climates.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {floors.map(([floor, inFloor]) => (
        <div key={floor} className="flex items-stretch gap-2">
          <span className="text-muted-foreground flex w-6 shrink-0 items-center justify-center font-mono text-[10.5px] font-medium">
            {floor}
          </span>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
            {[...inFloor]
              .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
              .map((c) => (
                <RoomTile
                  key={c.roomId}
                  climate={c}
                  selected={c.roomId === selectedRoomId}
                  onSelect={onSelect}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoomTile({
  climate,
  selected,
  onSelect,
}: {
  climate: RoomClimate;
  selected: boolean;
  onSelect?: (roomId: string) => void;
}) {
  const tone: Tone = climate.offline ? "neutral" : climate.tone;
  const status = climate.offline
    ? "Not reporting"
    : (climate.worst?.statusLabel ?? "No readings");

  return (
    <button
      type="button"
      onClick={() => onSelect?.(climate.roomId)}
      title={
        climate.readings.length > 0
          ? climate.readings
              .map(
                (r) =>
                  `${r.typeLabel} ${r.value.toFixed(r.decimals)} ${r.unit} — ${r.statusLabel}`,
              )
              .join("\n")
          : status
      }
      className={cn(
        "interactive focus-ring pressable flex min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded border px-2 py-1.75 text-left",
        TILE[tone],
        selected && "ring-primary ring-2 ring-offset-1",
      )}
    >
      <span className="w-full truncate font-mono text-[10.5px] font-medium">
        {climate.roomNumber}
      </span>
      <span className="w-full truncate text-[10px] opacity-80">{status}</span>
    </button>
  );
}

/**
 * Basements below ground, ground below the numbered floors, and the numbered
 * ones highest-first — so the grid reads like the building it describes.
 */
function compareFloors(a: string, b: string): number {
  return floorRank(b) - floorRank(a);
}

function floorRank(floor: string): number {
  const f = floor.trim().toUpperCase();
  if (f === "B" || f.startsWith("B")) return -2;
  if (f === "G") return -1;
  const n = Number.parseInt(f, 10);
  return Number.isFinite(n) ? n : 0;
}

const TILE: Record<Tone, string> = {
  success: "border-success/35 bg-success-muted text-success-foreground",
  warning: "border-warning/40 bg-warning-muted text-warning-foreground",
  danger: "border-danger/45 bg-danger-muted text-danger-foreground",
  info: "border-info/35 bg-info-muted text-info-foreground",
  neutral: "border-border bg-surface-subtle text-muted-foreground",
};
