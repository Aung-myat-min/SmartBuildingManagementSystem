"use client";

import { Camera } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppState } from "@/lib/app-state";
import {
  BUILDING_LOAD_KW,
  BUILDING_META,
  BUILDINGS,
  buildingStats,
  EQUIPMENT_UNITS,
  roomsForBuilding,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function BuildingsPage() {
  const { role, activeBuildingId } = useAppState();
  const visible =
    role === "office-staff"
      ? BUILDINGS.filter((b) => b.id === activeBuildingId)
      : BUILDINGS;

  return (
    <div className="flex flex-col gap-4">
      {visible.map((b) => {
        const meta = BUILDING_META[b.id];
        const stats = buildingStats(b.id);
        const totalUnits = EQUIPMENT_UNITS.filter(
          (u) => u.buildingId === b.id,
        ).length;
        const rooms = roomsForBuilding(b.id).map((r) => ({
          ...r,
          devices: EQUIPMENT_UNITS.filter((u) => u.roomId === r.id).length,
        }));

        const statTiles = [
          { label: "ROOMS", value: stats.roomCount, tone: "text-foreground" },
          { label: "DEVICES", value: totalUnits, tone: "text-foreground" },
          {
            label: "FAULTY",
            value: stats.faulty,
            tone:
              stats.faulty > 0 ? "text-danger-foreground" : "text-foreground",
          },
          {
            label: "OPEN REQUESTS",
            value: stats.openReq,
            tone:
              stats.openReq > 0 ? "text-warning-foreground" : "text-foreground",
          },
          {
            label: "LOAD",
            value: `${BUILDING_LOAD_KW[b.id]} kW`,
            tone: "text-foreground",
          },
        ];

        return (
          <Card key={b.id} className="flex-row gap-0 overflow-hidden p-0">
            <div className="bg-muted text-muted-foreground flex w-70 shrink-0 flex-col items-center justify-center gap-2 border-r max-md:hidden">
              <Camera className="size-6" />
              <span className="px-4 text-center text-[10.5px]">
                {meta?.photoHint}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3.5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-[17px] font-semibold">{b.name}</h2>
                    <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
                      {meta?.code}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[11.5px]">
                    {meta?.address}
                  </div>
                </div>
              </div>

              <p className="text-foreground/80 max-w-[72ch] text-[12.5px] leading-relaxed">
                {meta?.description}
              </p>

              <div className="border-border flex flex-wrap gap-6 border-y py-3">
                {statTiles.map((s) => (
                  <div key={s.label}>
                    <div
                      className={cn(
                        "font-mono text-[17px] leading-none font-semibold",
                        s.tone,
                      )}
                    >
                      {s.value}
                    </div>
                    <div className="text-muted-foreground mt-1.5 font-mono text-[9.5px] tracking-wider">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-muted-foreground mb-1.5 font-mono text-[9.5px] tracking-wider">
                  ROOMS
                </div>
                {rooms.length === 0 ? (
                  <p className="text-muted-foreground text-[11.5px]">
                    No rooms yet — add them under Administration › Buildings.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {rooms.map((r) => (
                      <span
                        key={r.id}
                        title={`Floor ${r.floor}`}
                        className="bg-surface-subtle border-border rounded-[3px] border px-2.5 py-1.5 text-[11.5px] font-[450]"
                      >
                        {r.roomNumber}
                        <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                          {r.devices}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
