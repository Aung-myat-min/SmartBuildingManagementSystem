"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { PulseDot } from "@/components/shared/pulse-dot";
import { useAppState } from "@/lib/app-state";
import { formatAge } from "@/lib/format";
import {
  buildingName,
  roomLabel,
  sensorType,
  statusDef,
} from "@/lib/mock-data";
import { isBuildingLocked } from "@/lib/permissions";

/**
 * A device in an alarm status, across the top of every page.
 *
 * An alarm is not a decision anyone owes, so it does not belong in the bell
 * beside "approve this request" — it belongs where you cannot miss it. Before
 * this it appeared only on the Dashboard and the Sensors page, so walking away
 * from either meant not knowing.
 *
 * Unlike the bell this is for everyone. Office Staff see their own building's
 * alarms; a fire is not an approver's concern.
 */
export function AlarmBanner() {
  const { sensors, role, activeBuildingId } = useAppState();
  const router = useRouter();

  const alarming = sensors
    .filter(
      (s) =>
        (!isBuildingLocked(role) || s.buildingId === activeBuildingId) &&
        (statusDef(s.typeId, s.status)?.isAlarm ?? false),
    )
    // Longest-running first. Unsorted this was alphabetical by device id,
    // which put a door forced open ahead of a fire detector for no reason.
    // An alarm nobody has dealt with for a fortnight is the bigger failure.
    .sort((a, b) =>
      (a.statusChangedAt ?? a.updatedAt).localeCompare(
        b.statusChangedAt ?? b.updatedAt,
      ),
    );
  if (alarming.length === 0) return null;

  const first = alarming[0];
  const others = alarming.length - 1;
  const label = sensorType(first.typeId)?.label ?? "Sensor";
  const status = statusDef(first.typeId, first.status)?.label ?? first.status;

  return (
    <button
      type="button"
      onClick={() => router.push(`/sensors?device=${first.id}`)}
      className="interactive focus-ring pressable bg-danger-muted text-danger-foreground border-danger/30 hover:bg-danger-muted/70 animate-sb-drop flex w-full cursor-pointer items-center gap-2.5 border-b px-4 py-2 text-left lg:px-5"
    >
      <PulseDot tone="danger" pulse className="shrink-0" />
      <ShieldAlert className="size-3.5 shrink-0" />
      <span className="text-[11.5px] leading-snug font-semibold">
        {label} {status.toLowerCase()}
      </span>
      <span className="truncate text-[11.5px] leading-snug">
        {first.id} — {roomLabel(first.roomId)}, {buildingName(first.buildingId)}
      </span>
      {others > 0 && (
        <span className="bg-danger shrink-0 rounded-[3px] px-1.5 py-1 font-mono text-[9.5px] leading-none font-semibold text-white">
          +{others} more
        </span>
      )}
      <span className="flex-1" />
      <span className="shrink-0 font-mono text-[10.5px]">
        {formatAge(first.statusChangedAt ?? first.updatedAt)}
      </span>
    </button>
  );
}
