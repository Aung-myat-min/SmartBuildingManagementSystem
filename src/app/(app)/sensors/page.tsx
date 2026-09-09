"use client";

import { Bell, ChevronDown, DoorClosed, Flame, Lock } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PulseDot } from "@/components/shared/pulse-dot";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAppState } from "@/lib/app-state";
import { BUILDING_META, BUILDINGS, roomLabel, SENSORS } from "@/lib/mock-data";
import { canActOnSensor } from "@/lib/permissions";
import type { EnvironmentalSensor } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  string,
  { label: string; tone: Tone; pulse?: boolean }
> = {
  normal: { label: "NORMAL", tone: "success" },
  triggered: { label: "TRIGGERED", tone: "danger", pulse: true },
  offline: { label: "OFFLINE", tone: "neutral" },
  locked: { label: "LOCKED", tone: "success" },
  unlocked: { label: "UNLOCKED", tone: "warning" },
  "forced-open": { label: "FORCED OPEN", tone: "danger", pulse: true },
};

type Filter = "all" | "alarm" | "offline";
const IS_ALARM = (status: string) =>
  status === "triggered" || status === "forced-open";

export default function SensorsPage() {
  const {
    role,
    activeBuildingId,
    alarmActive,
    alarmSeconds,
    liveAlarmSensorId,
    sensorStatus,
    setSensorStatus,
  } = useAppState();
  const staff = !canActOnSensor(role);
  const confirm = useConfirm();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const buildings =
    role === "office-staff"
      ? BUILDINGS.filter((b) => b.id === activeBuildingId)
      : BUILDINGS;

  const effectiveStatus = (s: EnvironmentalSensor) =>
    sensorStatus(
      s.id,
      s.id === liveAlarmSensorId && alarmActive ? "triggered" : s.status,
    );

  const allAlarm = SENSORS.filter((s) => IS_ALARM(effectiveStatus(s))).length;
  const allOffline = SENSORS.filter(
    (s) => effectiveStatus(s) === "offline",
  ).length;
  const inScope = SENSORS.filter((s) =>
    buildings.some((b) => b.id === s.buildingId),
  ).length;

  const matchesFilter = (status: string) => {
    if (filter === "alarm") return IS_ALARM(status);
    if (filter === "offline") return status === "offline";
    return true;
  };

  const handleAction = async (
    s: EnvironmentalSensor,
    action: "reset" | "lock" | "unlock",
  ) => {
    if (action === "reset") {
      const result = await confirm({
        title: "Reset fire alarm?",
        body: (
          <>
            This clears the triggered state on <strong>{s.id}</strong> (
            {roomLabel(s.roomId)}). A written reason is logged against this
            action.
          </>
        ),
        tone: "danger",
        confirmLabel: "Reset alarm",
        requireReason: true,
      });
      if (!result.confirmed) return;
      setSensorStatus(s.id, "normal");
      toast.success(`${s.id} reset to normal`, { description: result.reason });
      return;
    }
    const nextStatus = action === "lock" ? "locked" : "unlocked";
    const result = await confirm({
      title: action === "lock" ? "Lock this door?" : "Unlock this door?",
      body: (
        <>
          {s.id} — {roomLabel(s.roomId)}
        </>
      ),
      tone: "info",
      confirmLabel: action === "lock" ? "Lock door" : "Unlock door",
    });
    if (!result.confirmed) return;
    setSensorStatus(s.id, nextStatus);
    toast.success(`${s.id} ${nextStatus}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex-row flex-wrap items-center gap-2 p-2.5">
        <span className="text-muted-foreground pl-1 font-mono text-[10px] tracking-wider">
          SHOW
        </span>
        {(["all", "alarm", "offline"] as Filter[]).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium capitalize",
              filter === f
                ? "border-primary bg-accent text-info-foreground"
                : "border-border text-foreground/70",
            )}
          >
            {f === "all" ? "All devices" : f}
          </button>
        ))}
        <div className="bg-border mx-1 h-5.5 w-px" />
        <ToneBadge
          tone={allAlarm > 0 ? "danger" : "neutral"}
          className="gap-1.5"
        >
          <Bell className="size-2.5" /> {allAlarm} in alarm
        </ToneBadge>
        <ToneBadge tone="neutral">OFFLINE {allOffline}</ToneBadge>
        <ToneBadge tone="info">{inScope} in scope</ToneBadge>
        <div className="flex-1" />
        <span className="text-muted-foreground font-mono text-[11px]">
          Polled every 30s · last poll just now
        </span>
      </Card>

      <div className="flex flex-col gap-3">
        {buildings.map((b) => {
          const sensors = SENSORS.filter((s) => s.buildingId === b.id);
          const hasAlarm = sensors.some((s) => IS_ALARM(effectiveStatus(s)));
          const isOpen = !collapsed[b.id];
          const fireSensors = sensors
            .filter((s) => s.typeId === "fire-alarm")
            .filter((s) => matchesFilter(effectiveStatus(s)));
          const doorSensors = sensors
            .filter((s) => s.typeId === "door-lock")
            .filter((s) => matchesFilter(effectiveStatus(s)));

          return (
            <Collapsible
              key={b.id}
              open={isOpen}
              onOpenChange={(open) =>
                setCollapsed((p) => ({ ...p, [b.id]: !open }))
              }
            >
              <Card
                className={cn(
                  "gap-0 overflow-hidden border-l-[3px] p-0",
                  hasAlarm ? "border-l-danger" : "border-l-border",
                )}
              >
                <CollapsibleTrigger className="bg-surface-subtle hover:bg-surface-hover flex w-full items-center gap-2.5 px-4 py-2.5 text-left">
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground size-3.5 shrink-0 transition-transform",
                      !isOpen && "-rotate-90",
                    )}
                  />
                  <span className="text-[12.5px] font-semibold">{b.name}</span>
                  <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
                    {BUILDING_META[b.id]?.code}
                  </span>
                  {hasAlarm && (
                    <ToneBadge tone="danger" className="gap-1.5">
                      <PulseDot tone="danger" pulse />{" "}
                      {
                        sensors.filter((s) => IS_ALARM(effectiveStatus(s)))
                          .length
                      }{" "}
                      ALARM
                    </ToneBadge>
                  )}
                  <div className="flex-1" />
                  <span className="text-muted-foreground font-mono text-[10.5px]">
                    {sensors.length} devices
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid divide-x sm:grid-cols-2">
                    <SensorSection
                      icon={Flame}
                      title="Fire Detection"
                      sensors={fireSensors}
                      effectiveStatus={effectiveStatus}
                      staff={staff}
                      alarmSeconds={alarmSeconds}
                      liveAlarmSensorId={liveAlarmSensorId}
                      onAction={handleAction}
                    />
                    <SensorSection
                      icon={DoorClosed}
                      title="Door Hardware"
                      sensors={doorSensors}
                      effectiveStatus={effectiveStatus}
                      staff={staff}
                      alarmSeconds={alarmSeconds}
                      liveAlarmSensorId={liveAlarmSensorId}
                      onAction={handleAction}
                    />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

function SensorSection({
  icon: Icon,
  title,
  sensors,
  effectiveStatus,
  staff,
  alarmSeconds,
  liveAlarmSensorId,
  onAction,
}: {
  icon: typeof Flame;
  title: string;
  sensors: EnvironmentalSensor[];
  effectiveStatus: (s: EnvironmentalSensor) => string;
  staff: boolean;
  alarmSeconds: number;
  liveAlarmSensorId: string;
  onAction: (
    s: EnvironmentalSensor,
    action: "reset" | "lock" | "unlock",
  ) => void;
}) {
  return (
    <div className="p-3.5">
      <div className="border-border mb-2 flex items-center gap-1.5 border-b pb-2">
        <Icon className="text-muted-foreground size-3.5" />
        <span className="text-muted-foreground font-mono text-[10px] tracking-wider">
          {title.toUpperCase()}
        </span>
        <span className="text-muted-foreground/70 font-mono text-[10px]">
          {sensors.length}
        </span>
      </div>
      {sensors.length === 0 && (
        <EmptyState>No devices match this filter.</EmptyState>
      )}
      <div className="flex flex-col gap-1.5">
        {sensors.map((s) => {
          const status = effectiveStatus(s);
          const meta = STATUS_META[status] ?? {
            label: status.toUpperCase(),
            tone: "neutral" as Tone,
          };
          const alarm = IS_ALARM(status);
          const since =
            s.id === liveAlarmSensorId && status === "triggered"
              ? `${alarmSeconds}s ago`
              : undefined;
          const showActions =
            (status === "triggered" ||
              status === "locked" ||
              status === "unlocked" ||
              status === "forced-open") &&
            !!s;

          return (
            <div
              key={s.id}
              className={cn(
                "rounded-md px-2.5 py-2",
                alarm
                  ? "bg-danger-muted border-danger border border-l-[3px]"
                  : "hover:bg-surface-hover",
              )}
            >
              <div className="flex items-center gap-2">
                <PulseDot tone={meta.tone} pulse={meta.pulse} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-[450]">
                  {s.id.startsWith("FD") || s.id.startsWith("DL")
                    ? roomLabel(s.roomId)
                    : s.id}
                </span>
                <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
              </div>
              <div className="text-muted-foreground mt-0.5 pl-3.5 font-mono text-[10.5px]">
                {s.id} · {since ?? "reported just now"}
              </div>
              {showActions && (
                <div className="mt-2 flex gap-1.5 pl-3.5">
                  {status === "triggered" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={staff}
                      onClick={() => onAction(s, "reset")}
                      className="border-danger text-danger-foreground text-[11px]"
                    >
                      {staff && <Lock className="size-2.5" />} Reset
                    </Button>
                  )}
                  {(status === "unlocked" || status === "forced-open") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={staff}
                      onClick={() => onAction(s, "lock")}
                      className="text-[11px]"
                    >
                      {staff && <Lock className="size-2.5" />} Lock
                    </Button>
                  )}
                  {status === "locked" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={staff}
                      onClick={() => onAction(s, "unlock")}
                      className="text-[11px]"
                    >
                      {staff && <Lock className="size-2.5" />} Unlock
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
