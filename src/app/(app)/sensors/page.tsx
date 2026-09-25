"use client";

import {
  Bell,
  Building2,
  ChevronDown,
  Gauge,
  Lock,
  LockOpen,
  type LucideIcon,
  RotateCcw,
  Thermometer,
  Trash2,
  TriangleAlert,
  Wind,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ClimateGrid } from "@/components/shared/climate-grid";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  DetailDrawer,
  DetailDrawerHeader,
  DetailDrawerSection,
  DetailMeta,
  DetailMetaGrid,
  DrawerAction,
  DrawerActionGrid,
  DrawerField,
  DrawerInlineForm,
  SameDevicePanel,
} from "@/components/shared/detail-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { FormDrawer, WideSheet } from "@/components/shared/form-drawer";
import { Hint } from "@/components/shared/hint";
import { PulseDot } from "@/components/shared/pulse-dot";
import { ReadingChart } from "@/components/shared/reading-chart";
import { SensorTypeRegistry } from "@/components/shared/sensor-type-registry";
import { StatusDonut } from "@/components/shared/status-donut";
import { StickyToolbar } from "@/components/shared/sticky-toolbar";
import { type Tone, ToneBadge, toneIcon } from "@/components/shared/tone-badge";
import { Card } from "@/components/ui/card";
import { useCountUp } from "@/hooks/use-count-up";
import { useLiveClock } from "@/hooks/use-live-clock";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { TICK_SECONDS } from "@/hooks/use-simulation";
import { useAppState } from "@/lib/app-state";
import { bandZones, liveSeries, recordedSeries } from "@/lib/chart-data";
import {
  averageOf,
  needsAttention,
  type RoomClimate,
  roomClimates,
  summarise,
} from "@/lib/climate";
import { isSensorOffline, statusTone } from "@/lib/derive";
import { formatAge, formatRelative } from "@/lib/format";
import { ROOM_TYPE_ICONS, sensorIcon } from "@/lib/icons";
import {
  buildingName,
  equipmentForSensor,
  roomLabel,
  roomsForBuilding,
  sensorType,
  sensorTypes,
  statusDef,
} from "@/lib/mock-data";
import {
  canAct,
  canActOnSensor,
  canManageSensorTypes,
  isBuildingLocked,
  SENSOR_LOCK_REASON,
  SENSOR_TYPE_LOCK_REASON,
} from "@/lib/permissions";
import {
  bandFor,
  bandsFor,
  gaugeFraction,
  hasOverride,
  isMeasuring,
  nextThreshold,
  trendOf,
} from "@/lib/sensor-readings";
import type {
  EnvironmentalSensor,
  RoomType,
  SensorAction,
  SensorBand,
  SensorTypeDef,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Actions are registry data, but a glyph is not something a registry entry
 * carries, so known action ids keep their icon and anything else falls back.
 */
const ACTION_ICON: Record<string, React.ElementType> = {
  reset: RotateCcw,
  lock: Lock,
  unlock: LockOpen,
};

/**
 * How a status should be drawn right now. Everything here comes from the
 * sensor type's registry entry — this page holds no vocabulary of its own.
 * `since` is when the sensor entered the status, which matters for the
 * statuses whose tone changes once the state has persisted.
 */
function statusView(
  typeId: string,
  status: string,
  since: string,
  nowMs: number | null,
) {
  const def = statusDef(typeId, status);
  if (!def) {
    return {
      label: status,
      tone: "neutral" as Tone,
      pulse: false,
      alarm: false,
    };
  }
  return {
    label: def.label,
    // Before mount there is no clock, so the status reads as brand new and
    // renders its resting tone — the same thing the server rendered.
    tone: statusTone(def, since, nowMs ?? new Date(since).getTime()),
    pulse: def.pulse ?? false,
    alarm: def.isAlarm,
  };
}

type Filter = "all" | "alarms" | "offline";

// useSearchParams opts the subtree into client rendering, so the deep-link
// read sits behind its own boundary rather than blocking the whole route.
/** The building panel opening and closing. */
const PANEL_MOVE = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const;

export default function SensorsPage() {
  return (
    <React.Suspense fallback={null}>
      <SensorsView />
    </React.Suspense>
  );
}

function SensorsView() {
  const router = useRouter();
  const params = useSearchParams();
  const {
    buildings,
    role,
    activeBuildingId,
    sensors,
    removeSensor,
    setSensorStatus,
  } = useAppState();
  const confirm = useConfirm();
  const clock = useLiveClock();
  const [tab, setTab] = usePersistedState<"monitoring" | "thresholds">(
    "sensors.tab",
    "monitoring",
  );

  const locked = isBuildingLocked(role);
  const mayAct = canActOnSensor(role);

  const [filter, setFilter] = usePersistedState<Filter>("sensors.show", "all");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [typesOpen, setTypesOpen] = React.useState(false);

  // Arriving from an equipment unit's SAME PHYSICAL DEVICE panel.
  const deviceParam = params.get("device");
  React.useEffect(() => {
    if (deviceParam) setOpenId(deviceParam);
  }, [deviceParam]);

  // A device that has never changed status has no `statusChangedAt`, and its
  // last report is the best answer there is to "since when".
  const changedAtOf = React.useCallback(
    (s: EnvironmentalSensor) => s.statusChangedAt ?? s.updatedAt,
    [],
  );

  // The clock only exists after mount, and it re-reads every second, which is
  // what lets a status cross its escalation threshold while the page is open.
  const nowMs = clock ? Date.now() : null;

  const viewOf = React.useCallback(
    (s: EnvironmentalSensor) =>
      statusView(s.typeId, s.status, changedAtOf(s), nowMs),
    [changedAtOf, nowMs],
  );

  const inScope = sensors.filter(
    (s) => !locked || s.buildingId === activeBuildingId,
  );

  const matchesFilter = (s: EnvironmentalSensor) => {
    if (filter === "alarms") return viewOf(s).alarm;
    // TODO: "offline" is the one status id this page still knows by name.
    // It needs a registry flag of its own (isOffline, beside isAlarm) before
    // a runtime-created type can have a not-reporting state.
    if (filter === "offline") return isSensorOffline(s.status);
    return true;
  };

  const visible = inScope.filter(matchesFilter);
  const alarmCount = inScope.filter((s) => viewOf(s).alarm).length;
  const offlineCount = inScope.filter((s) => isSensorOffline(s.status)).length;

  const visibleBuildings = buildings.filter(
    (b) => !locked || b.id === activeBuildingId,
  );

  const selected = openId
    ? (sensors.find((s) => s.id === openId) ?? null)
    : null;

  const runAction = async (s: EnvironmentalSensor, action: SensorAction) => {
    const result = await confirm({
      title: `${action.label} ${s.id}?`,
      body: `${roomLabel(s.roomId)} · ${buildingName(s.buildingId)}. The device moves to ${statusDef(s.typeId, action.resultStatus)?.label ?? action.resultStatus}.`,
      note: action.requiresNote
        ? "Resetting a fire alarm is recorded against your name in the Log Book."
        : undefined,
      tone: action.requiresNote ? "danger" : "info",
      confirmLabel: action.label,
      requireReason: action.requiresNote,
    });
    if (!result.confirmed) return;
    const written = await setSensorStatus(
      s.id,
      action.resultStatus,
      undefined,
      result.reason,
    );
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    toast.success(
      `${s.id} → ${statusDef(s.typeId, action.resultStatus)?.label ?? action.resultStatus}`,
    );
  };

  const remove = async (s: EnvironmentalSensor) => {
    const type = sensorType(s.typeId);
    const result = await confirm({
      title: `Remove ${s.id}?`,
      body: `${type?.label ?? "This device"} in ${roomLabel(s.roomId)}, ${buildingName(s.buildingId)}.`,
      note: "It stops reporting and leaves every count. Its history stays in the Log Book and Historical Records.",
      tone: "danger",
      confirmLabel: "Remove device",
      requireReason: true,
    });
    if (!result.confirmed) return;
    const written = await removeSensor(s.id, result.reason);
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    setOpenId(null);
    toast.success(`${s.id} removed from the network`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* The page does two jobs and they are not the same job: watching the
          estate, and setting the limits it is watched against. Two tabs rather
          than one long scroll, because nobody arrives wanting both. */}
      <div className="border-border bg-card flex w-fit items-center rounded-[5px] border p-[3px]">
        {(
          [
            ["monitoring", "Monitoring"],
            ["thresholds", "Thresholds"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "interactive focus-ring cursor-pointer rounded-[3px] px-3.5 py-1.5 text-[12px] font-medium",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "thresholds" ? (
        <ThresholdsTab />
      ) : (
        <>
          <StickyToolbar className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
            <span className="text-muted-foreground font-mono text-[10px] tracking-[0.07em] uppercase">
              Show
            </span>
            {(
              [
                ["all", "All devices"],
                ["alarms", "Alarms only"],
                ["offline", "Offline"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "focus-ring interactive cursor-pointer rounded border px-2.5 py-1.75 text-[11.5px] leading-none font-medium",
                  filter === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-neutral-foreground hover:border-primary",
                )}
              >
                {label}
              </button>
            ))}

            <span className="bg-divider h-5.5 w-px shrink-0" />

            <span
              title="Devices in an alarm state"
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium",
                alarmCount > 0
                  ? "bg-danger-muted text-danger-foreground"
                  : "bg-neutral-muted text-neutral-foreground",
              )}
            >
              <Bell className="size-3" />
              {alarmCount}
            </span>
            <span
              title="Devices not reporting"
              className="bg-neutral-muted text-neutral-foreground shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium"
            >
              OFFLINE {offlineCount}
            </span>
            <span
              title="Devices in scope"
              className="bg-primary shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium text-white"
            >
              {inScope.length}
            </span>

            <div className="flex-1" />

            <span className="text-muted-foreground shrink-0 text-[11px]">
              Polled every 30s · {clock ?? "—"}
            </span>

            {canManageSensorTypes(role) ? (
              <button
                type="button"
                title="Add, rename or archive the kinds of device this estate has"
                onClick={() => setTypesOpen(true)}
                className="interactive focus-ring pressable border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground shrink-0 cursor-pointer rounded border px-3 py-2 text-[11.5px] leading-none font-medium"
              >
                Manage types
              </button>
            ) : (
              <Hint text={SENSOR_TYPE_LOCK_REASON}>
                <button
                  type="button"
                  aria-disabled
                  className="interactive focus-ring border-border text-muted-foreground bg-card flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded border px-3 py-2 text-[11.5px] leading-none font-medium opacity-45"
                >
                  <Lock className="size-2.75" />
                  Manage types
                </button>
              </Hint>
            )}

            {canAct(role) && (
              <button
                type="button"
                title="Register a new sensor on the network"
                onClick={() => setFormOpen(true)}
                className="interactive focus-ring pressable border-primary bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer rounded border px-3 py-2 text-[11.5px] leading-none font-medium"
              >
                + New sensor
              </button>
            )}
          </StickyToolbar>

          <ClimateOverview onRoomPicked={setOpenId} />

          {visibleBuildings.map((b) => {
            const group = visible.filter((s) => s.buildingId === b.id);
            const groupAlarms = group.filter((s) => viewOf(s).alarm).length;
            const isOpen = !collapsed[b.id];
            return (
              <div
                key={b.id}
                className="border-border bg-card overflow-hidden rounded-[5px] border"
              >
                <button
                  type="button"
                  title={
                    isOpen ? "Collapse this building" : "Expand this building"
                  }
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [b.id]: isOpen }))
                  }
                  className={cn(
                    "focus-ring interactive hover:bg-surface-hover flex w-full items-center gap-2.5 px-4 py-3 text-left",
                    isOpen && "border-divider border-b",
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground size-3.5 shrink-0 transition-transform",
                      !isOpen && "-rotate-90",
                    )}
                  />
                  <span className="text-[13px] font-semibold">{b.name}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {b.code}
                  </span>
                  {groupAlarms > 0 && (
                    <ToneBadge tone="danger" className="gap-1.5">
                      <PulseDot tone="danger" pulse />
                      {groupAlarms} in alarm
                    </ToneBadge>
                  )}
                  <div className="flex-1" />
                  <span className="text-muted-foreground font-mono text-[10.5px]">
                    {group.length} devices
                  </span>
                </button>

                {/* The chevron rotated and the panel it controls just appeared —
                half the interaction animated and half did not. Height is the
                one property CSS cannot transition to `auto`, so this is the
                library's job. */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <m.div
                      key="panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={PANEL_MOVE}
                      className="overflow-hidden"
                    >
                      <BuildingReadings sensors={group} />

                      <div className="grid grid-cols-2 max-lg:grid-cols-1">
                        {sensorTypes()
                          .filter((t) => !isMeasuring(t))
                          .map((type) => {
                            const items = group.filter(
                              (s) => s.typeId === type.id,
                            );
                            const Icon = sensorIcon(type.icon);
                            return (
                              <div
                                key={type.id}
                                className="border-divider border-r last:border-r-0 max-lg:border-r-0 max-lg:border-b"
                              >
                                <div className="border-divider text-muted-foreground flex items-center gap-2 border-b px-4 py-2.25">
                                  <Icon className="size-3.75" />
                                  <span className="flex-1 font-mono text-[10px] tracking-[0.06em] uppercase">
                                    {type.label}
                                  </span>
                                  <span className="font-mono text-[10.5px]">
                                    {items.length}
                                  </span>
                                </div>

                                {items.map((s) => {
                                  const status = s.status;
                                  const view = viewOf(s);
                                  const alarm = view.alarm;
                                  const offline = isSensorOffline(status);
                                  const actions = type.actions.filter(
                                    (a) => a.resultStatus !== status,
                                  );
                                  return (
                                    <div
                                      key={s.id}
                                      className={cn(
                                        "border-rule border-b px-4 py-2.75 last:border-b-0",
                                        // Alarm states lift out and break the row rhythm.
                                        alarm &&
                                          "bg-danger-muted/50 border-l-danger border-l-[3px]",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        title="Open this sensor"
                                        onClick={() => setOpenId(s.id)}
                                        className="interactive focus-ring flex w-full items-center gap-2.5 text-left"
                                      >
                                        <PulseDot
                                          tone={view.tone}
                                          pulse={view.pulse}
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-[12.5px] font-[450]">
                                            {s.id}
                                          </div>
                                          <div className="text-muted-foreground mt-0.5 text-[10.5px] leading-snug">
                                            {roomLabel(s.roomId)} ·{" "}
                                            {formatRelative(changedAtOf(s))}
                                          </div>
                                        </div>
                                        <ToneBadge tone={view.tone}>
                                          {view.label}
                                        </ToneBadge>
                                      </button>

                                      {(alarm || offline) && (
                                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                          {actions.map((a) => {
                                            // The registry's own per-action roles, not a
                                            // blanket page-level gate.
                                            const allowed =
                                              a.allowedRoles.includes(role);
                                            return (
                                              <Hint
                                                key={a.id}
                                                text={
                                                  allowed
                                                    ? a.caption
                                                    : SENSOR_LOCK_REASON
                                                }
                                              >
                                                <button
                                                  type="button"
                                                  aria-disabled={!allowed}
                                                  onClick={() =>
                                                    allowed && runAction(s, a)
                                                  }
                                                  className={cn(
                                                    "focus-ring interactive bg-card flex cursor-pointer items-center gap-1 rounded border px-2.25 py-1.25 text-[10.5px] leading-none font-medium",
                                                    allowed
                                                      ? "border-input text-neutral-foreground hover:border-primary hover:text-accent-foreground"
                                                      : "border-border cursor-not-allowed opacity-45",
                                                  )}
                                                >
                                                  {!allowed && (
                                                    <Lock className="size-2.5" />
                                                  )}
                                                  {a.label}
                                                </button>
                                              </Hint>
                                            );
                                          })}
                                          <span className="text-muted-foreground text-[10.5px]">
                                            {offline
                                              ? "Offline devices raise no alarms."
                                              : "Recorded in the Log Book."}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {items.length === 0 && (
                                  <div className="text-muted-foreground px-4 py-6 text-center text-[11px]">
                                    No devices match this filter.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {visible.length === 0 && (
            <EmptyState>
              No devices match this filter — every sensor in scope is reporting
              normally.
            </EmptyState>
          )}
        </>
      )}

      <SensorDrawer
        sensor={selected}
        status={selected?.status ?? ""}
        view={
          selected
            ? viewOf(selected)
            : { label: "", tone: "neutral", pulse: false, alarm: false }
        }
        since={selected ? changedAtOf(selected) : ""}
        role={role}
        mayAct={mayAct}
        onClose={() => {
          setOpenId(null);
          if (deviceParam) router.replace("/sensors");
        }}
        onRunAction={runAction}
        onRemove={remove}
        onGoToEquipment={() => {
          setOpenId(null);
          router.push("/equipment");
        }}
      />

      <SensorTypeSheet open={typesOpen} onOpenChange={setTypesOpen} />

      <NewSensorDrawer open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function SensorDrawer({
  sensor,
  status,
  view,
  since,
  role,
  mayAct,
  onClose,
  onRunAction,
  onRemove,
  onGoToEquipment,
}: {
  sensor: EnvironmentalSensor | null;
  status: string;
  view: ReturnType<typeof statusView>;
  since: string;
  role: ReturnType<typeof useAppState>["role"];
  mayAct: boolean;
  onClose: () => void;
  onRunAction: (s: EnvironmentalSensor, a: SensorAction) => void;
  onRemove: (s: EnvironmentalSensor) => void;
  onGoToEquipment: () => void;
}) {
  // Editing stays in this drawer rather than stacking a second one on top of
  // the record being edited.
  const { editSensor } = useAppState();
  const [editing, setEditing] = React.useState(false);
  const fields = useSensorFields(sensor, editing);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sensor id is the reset trigger
  React.useEffect(() => setEditing(false), [sensor?.id]);
  if (!sensor) {
    return (
      <DetailDrawer open={false} size="narrow" onOpenChange={onClose}>
        {null}
      </DetailDrawer>
    );
  }

  const type = sensorType(sensor.typeId);
  const linked = equipmentForSensor(sensor);
  const offline = isSensorOffline(status);

  return (
    <DetailDrawer open size="narrow" onOpenChange={(o) => !o && onClose()}>
      <DetailDrawerHeader
        tag={sensor.id}
        chip={<ToneBadge tone={view.tone}>{view.label}</ToneBadge>}
        onClose={onClose}
      >
        <div className="mt-2.5 text-[15px] leading-tight font-semibold">
          {type?.label} — {roomLabel(sensor.roomId)}
        </div>
        <div className="text-muted-foreground mt-1 text-[11.5px] leading-snug">
          {roomLabel(sensor.roomId)} · {buildingName(sensor.buildingId)}
        </div>
      </DetailDrawerHeader>

      <DetailMetaGrid>
        <DetailMeta label="Type" value={type?.label ?? sensor.typeId} />
        <DetailMeta label="Status" value={view.label} />
        <DetailMeta label="Last report" value={formatRelative(since)} />
        <DetailMeta
          label="Vocabulary"
          value={type?.statuses.map((st) => st.label).join(" / ") ?? "—"}
        />
      </DetailMetaGrid>

      {linked && (
        <SameDevicePanel
          id={linked.tag}
          note="The asset record — service history, condition and decommissioning live there."
          linkLabel="Equipment →"
          onOpen={onGoToEquipment}
        />
      )}

      {editing ? (
        <DetailDrawerSection label="Edit device details">
          <DrawerInlineForm
            title="Registration"
            description="The device keeps its reporting history; only its registration changes."
            submitLabel="Save changes"
            error={fields.error}
            onCancel={() => setEditing(false)}
            onSubmit={async () => {
              if (fields.roomId.length === 0) {
                fields.setError("A device needs a room.");
                return;
              }
              // The id is not in the patch: it is the document id, and the
              // unit this device shares a body with points at it by name.
              const written = await editSensor(sensor.id, {
                buildingId: fields.buildingId,
                roomId: fields.roomId,
                linkedEquipmentId: fields.linkTag || undefined,
              });
              if (!written.ok) {
                fields.setError(written.message);
                return;
              }
              toast.success(`${sensor.id} updated`);
              setEditing(false);
            }}
          >
            <SensorFields f={fields} isEdit />
          </DrawerInlineForm>
        </DetailDrawerSection>
      ) : (
        <>
          <DetailDrawerSection label={`${type?.label ?? "Device"} actions`}>
            <DrawerActionGrid>
              {(type?.actions ?? []).map((a) => {
                const allowed = a.allowedRoles.includes(role);
                return (
                  <DrawerAction
                    key={a.id}
                    icon={ACTION_ICON[a.id] ?? RotateCcw}
                    label={a.label}
                    caption={a.caption}
                    lockedReason={allowed ? undefined : SENSOR_LOCK_REASON}
                    onClick={() => onRunAction(sensor, a)}
                  />
                );
              })}
            </DrawerActionGrid>
            <p className="text-muted-foreground mt-2.25 text-[11px] leading-relaxed">
              {offline
                ? "This device is not reporting, so it raises no alarms until it comes back."
                : "Every action here writes an entry to the Log Book."}
            </p>
          </DetailDrawerSection>

          <DetailDrawerSection className="flex gap-1.75">
            <Hint
              text={mayAct ? "Edit this sensor's details" : SENSOR_LOCK_REASON}
            >
              <button
                type="button"
                aria-disabled={!mayAct}
                onClick={() => mayAct && setEditing(true)}
                className={cn(
                  "focus-ring interactive bg-card flex cursor-pointer items-center gap-1 rounded border px-2.75 py-1.75 text-[11px] leading-none font-medium",
                  mayAct
                    ? "border-input text-neutral-foreground hover:border-primary hover:text-accent-foreground"
                    : "border-border cursor-not-allowed opacity-45",
                )}
              >
                {!mayAct && <Lock className="size-2.5" />}
                Edit details
              </button>
            </Hint>
            <Hint text={mayAct ? "Remove this sensor" : SENSOR_LOCK_REASON}>
              <button
                type="button"
                aria-disabled={!mayAct}
                onClick={() => mayAct && onRemove(sensor)}
                className={cn(
                  "focus-ring interactive bg-card flex cursor-pointer items-center gap-1 rounded border px-2.75 py-1.75 text-[11px] leading-none font-medium",
                  mayAct
                    ? "border-danger/40 text-danger-foreground hover:bg-danger-muted"
                    : "border-border cursor-not-allowed opacity-45",
                )}
              >
                <Trash2 className="size-2.5" />
                Remove
              </button>
            </Hint>
          </DetailDrawerSection>
        </>
      )}
    </DetailDrawer>
  );
}

/** The registration fields, shared by the inline edit and the new-sensor drawer. */
function useSensorFields(seed: EnvironmentalSensor | null, active: boolean) {
  const { buildings } = useAppState();
  const [name, setName] = React.useState("");
  const [typeId, setTypeId] = React.useState(sensorTypes()[0]?.id ?? "");
  const [buildingId, setBuildingId] = React.useState(buildings[0]?.id ?? "");
  const [roomId, setRoomId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [linkTag, setLinkTag] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reseed when the form opens
  React.useEffect(() => {
    if (!active) return;
    setName(seed?.id ?? "");
    setTypeId(seed?.typeId ?? sensorTypes()[0]?.id ?? "");
    setBuildingId(seed?.buildingId ?? buildings[0]?.id ?? "");
    setRoomId(seed?.roomId ?? "");
    setStatus(seed?.status ?? sensorTypes()[0]?.statuses[0]?.id ?? "");
    setLinkTag(seed?.linkedEquipmentId ?? "");
    setError(null);
  }, [active, seed?.id]);

  return {
    name,
    setName,
    typeId,
    setTypeId,
    buildingId,
    setBuildingId,
    roomId,
    setRoomId,
    status,
    setStatus,
    linkTag,
    setLinkTag,
    error,
    setError,
  };
}

type SensorFieldState = ReturnType<typeof useSensorFields>;

const FIELD_INPUT =
  "interactive focus:ring-3 focus:ring-primary/15 border-input focus:border-primary bg-card w-full rounded border px-2.25 py-1.75 text-[12px] outline-none";
const FIELD_SELECT =
  "border-input bg-card w-full cursor-pointer rounded border px-2 py-1.75 text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60";

function SensorFields({ f, isEdit }: { f: SensorFieldState; isEdit: boolean }) {
  const { buildings, equipmentUnits } = useAppState();
  const type = sensorType(f.typeId);
  const rooms = roomsForBuilding(f.buildingId);
  const linkable = equipmentUnits.filter((u) => u.buildingId === f.buildingId);

  return (
    <>
      <DrawerField label="Device id">
        <input
          value={f.name}
          disabled={isEdit}
          onChange={(e) => f.setName(e.target.value.toUpperCase())}
          placeholder="e.g. FD-216-14"
          title={
            isEdit
              ? "A device's id is the one printed on it, and the equipment unit it shares a body with points at it by name. Remove the device and register the replacement instead."
              : undefined
          }
          className={cn(
            FIELD_INPUT,
            "font-mono",
            isEdit && "cursor-not-allowed opacity-60",
          )}
        />
      </DrawerField>

      <DrawerField label="Sensor type">
        <select
          value={f.typeId}
          disabled={isEdit}
          title={
            isEdit
              ? "A registered device cannot change type — remove it and register the replacement."
              : undefined
          }
          onChange={(e) => {
            f.setTypeId(e.target.value);
            const next = sensorType(e.target.value);
            f.setStatus(next?.statuses[0]?.id ?? "");
          }}
          className={FIELD_SELECT}
        >
          {sensorTypes().map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </DrawerField>

      <div className="grid grid-cols-2 gap-2.25">
        <DrawerField label="Building">
          <select
            value={f.buildingId}
            onChange={(e) => {
              f.setBuildingId(e.target.value);
              f.setRoomId(roomsForBuilding(e.target.value)[0]?.id ?? "");
            }}
            className={FIELD_SELECT}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </DrawerField>
        <DrawerField label="Room">
          <select
            value={f.roomId}
            onChange={(e) => f.setRoomId(e.target.value)}
            className={FIELD_SELECT}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber}
              </option>
            ))}
          </select>
        </DrawerField>
      </div>

      <DrawerField label="Status">
        <select
          value={f.status}
          onChange={(e) => f.setStatus(e.target.value)}
          className={FIELD_SELECT}
        >
          {(type?.statuses ?? []).map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>
      </DrawerField>

      <DrawerField label="Linked equipment unit · optional">
        <select
          value={f.linkTag}
          onChange={(e) => f.setLinkTag(e.target.value)}
          className={FIELD_SELECT}
        >
          <option value="">Not linked</option>
          {linkable.map((u) => (
            <option key={u.id} value={u.tag}>
              {u.tag} · {roomLabel(u.roomId)}
            </option>
          ))}
        </select>
      </DrawerField>
      <p className="text-muted-foreground text-[10.5px] leading-relaxed">
        A fire detector is one physical device with two records — the equipment
        unit that gets serviced, and the sensor that reports its state. Linking
        them keeps both in step.
      </p>
    </>
  );
}

/** Registering a device has no record open yet, so it gets its own drawer. */
function NewSensorDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const f = useSensorFields(null, open);
  const { addSensor, sensors } = useAppState();

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New sensor"
      description="Register a device already on the network. It starts reporting at the next poll."
      submitLabel="Register sensor"
      error={f.error}
      onSubmit={async () => {
        const id = f.name.trim();
        if (id.length === 0) {
          f.setError("A device needs the id printed on it.");
          return;
        }
        // The id is the document id, so a duplicate would overwrite the
        // device already wearing it rather than be refused.
        if (sensors.some((s) => s.id === id)) {
          f.setError(`${id} is already on the network.`);
          return;
        }
        if (f.roomId.length === 0) {
          f.setError("A device needs a room.");
          return;
        }
        const now = new Date().toISOString();
        const written = await addSensor({
          id,
          buildingId: f.buildingId,
          roomId: f.roomId,
          typeId: f.typeId,
          status: f.status,
          linkedEquipmentId: f.linkTag || undefined,
          statusChangedAt: now,
          updatedAt: now,
        });
        if (!written.ok) {
          f.setError(written.message);
          return;
        }
        toast.success(`${id} registered on the network`);
        onOpenChange(false);
      }}
    >
      <SensorFields f={f} isEdit={false} />
    </FormDrawer>
  );
}

/** The registry, opened from the toolbar rather than living in Administration. */
function SensorTypeSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const confirm = useConfirm();
  return (
    <WideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Sensor types"
      description="Each type carries its own statuses and actions. The page above renders whatever is here — it holds no vocabulary of its own."
    >
      <SensorTypeRegistry confirm={confirm} />
    </WideSheet>
  );
}

/**
 * The measuring sensors, live.
 *
 * Readings come from the simulation in app-state — a local series that starts
 * empty on load. Only a band crossing reaches Firestore, so holding a value
 * here writes once rather than every tick.
 */
/** The room kinds a threshold can be written for, in the order they are listed. */
const ROOM_TYPES: { id: RoomType; label: string }[] = [
  { id: "office", label: "Office" },
  { id: "lecture", label: "Lecture hall" },
  { id: "lab", label: "Teaching lab" },
  { id: "plant", label: "Plant / server room" },
  { id: "common", label: "Common area" },
];

/**
 * What every reading in the estate is judged against.
 *
 * Read top to bottom it is one sentence per type — "Temperature: comfortable
 * between 18 and 26" — and under it, only where they exist, the rooms that
 * disagree. A grid of five room types against every sensor type would be
 * thirty cells nobody fills in; the exceptions list stays short because it
 * only holds the rooms that genuinely differ.
 */
function ThresholdsTab() {
  const { sensorTypeRegistry, rooms, role } = useAppState();
  const [typesOpen, setTypesOpen] = React.useState(false);
  const measuring = sensorTypeRegistry.filter(
    (t) => !t.archived && isMeasuring(t),
  );

  const roomsOfType = (rt: RoomType) =>
    rooms.filter((r) => r.type === rt).length;

  return (
    <div className="flex flex-col gap-3">
      <Card className="gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold">
              Limits every reading is judged against
            </div>
            <div className="text-muted-foreground text-[11px] leading-relaxed">
              A reading takes the first band it fits, and that band decides the
              status, the colour and whether anything raises an alarm. Changing
              a number here changes what the estate reports — it does not change
              any reading.
            </div>
          </div>
          <Hint
            text={
              canManageSensorTypes(role)
                ? "Add, rename or archive the kinds of device this estate has"
                : SENSOR_TYPE_LOCK_REASON
            }
          >
            <button
              type="button"
              aria-disabled={!canManageSensorTypes(role)}
              onClick={() => canManageSensorTypes(role) && setTypesOpen(true)}
              className={cn(
                "interactive focus-ring pressable bg-card shrink-0 cursor-pointer rounded border px-3 py-2 text-[11.5px] leading-none font-medium",
                canManageSensorTypes(role)
                  ? "border-input text-neutral-foreground hover:border-primary hover:text-accent-foreground"
                  : "border-border text-muted-foreground cursor-not-allowed opacity-45",
              )}
            >
              Manage types
            </button>
          </Hint>
        </div>
      </Card>

      {measuring.length === 0 && (
        <EmptyState>
          No sensor type in this estate reads a number yet. A door lock is open
          or closed, not 23.4 of anything — add a measuring type to set limits.
        </EmptyState>
      )}

      {measuring.map((type) => {
        const m = type.measurement;
        if (!m) return null;
        const exceptions = ROOM_TYPES.filter((rt) => hasOverride(type, rt.id));
        const Icon = sensorIcon(type.icon);
        return (
          <Card key={type.id} className="gap-3 p-3.5">
            <div className="flex items-center gap-2">
              <Icon className="text-muted-foreground size-4.5 shrink-0" />
              <span className="flex-1 text-[12.5px] font-semibold">
                {type.label}
              </span>
              <span className="text-muted-foreground font-mono text-[10.5px]">
                {m.min}–{m.max} {m.unit}
              </span>
            </div>

            <BandTable
              type={type}
              bands={m.bands}
              icon={Building2}
              caption="Everywhere"
            />

            {exceptions.map((rt) => (
              <BandTable
                key={rt.id}
                type={type}
                bands={bandsFor(type, rt.id)}
                icon={ROOM_TYPE_ICONS[rt.id]}
                caption={`${rt.label} — ${roomsOfType(rt.id)} room${
                  roomsOfType(rt.id) === 1 ? "" : "s"
                }`}
                exception
              />
            ))}

            {exceptions.length === 0 && (
              <p className="text-muted-foreground text-[10.5px] leading-relaxed">
                Every kind of room is judged by the same limits. A room type
                only appears here when it needs different ones.
              </p>
            )}
          </Card>
        );
      })}

      <SensorTypeSheet open={typesOpen} onOpenChange={setTypesOpen} />
    </div>
  );
}

/** One set of limits, read as a row per band rather than a list of numbers. */
function BandTable({
  type,
  bands,
  caption,
  icon: Icon,
  exception = false,
}: {
  type: SensorTypeDef;
  bands: SensorBand[];
  caption: string;
  icon: LucideIcon;
  exception?: boolean;
}) {
  const m = type.measurement;
  if (!m) return null;
  let from = m.min;

  return (
    <div
      className={cn(
        "border-divider overflow-hidden rounded border",
        exception && "border-l-warning border-l-[3px]",
      )}
    >
      <div className="bg-surface-subtle border-divider text-muted-foreground flex items-center gap-1.5 border-b px-2.5 py-1.5 font-mono text-[10px] tracking-[0.06em] uppercase">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1">{caption}</span>
        {exception && (
          <span className="text-warning-foreground">Exception</span>
        )}
      </div>
      <ul>
        {bands.map((band) => {
          const def = type.statuses.find((st) => st.id === band.statusId);
          const to = band.upTo;
          const range =
            to === null
              ? `above ${from} ${m.unit}`
              : `${from} – ${to} ${m.unit}`;
          from = to ?? from;
          return (
            <li
              key={band.statusId}
              className="border-rule flex items-center gap-2 border-b px-2.5 py-1.5 last:border-b-0"
            >
              <span className="w-38 shrink-0">
                <ToneBadge tone={def?.tone ?? "neutral"}>
                  {React.createElement(toneIcon(def?.tone ?? "neutral"), {
                    "aria-hidden": true,
                    className: "size-3 shrink-0",
                  })}
                  {def?.label ?? band.statusId}
                </ToneBadge>
              </span>
              <span className="text-neutral-foreground min-w-0 flex-1 font-mono text-[11px]">
                {range}
              </span>
              {def?.isAlarm && (
                <span className="text-danger-foreground shrink-0 font-mono text-[9.5px] tracking-[0.06em] uppercase">
                  Raises an alarm
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One room that wants something doing, with how long it has wanted it. */
function AttentionRow({
  climate,
  onOpen,
  onRaise,
}: {
  climate: RoomClimate;
  onOpen: () => void;
  onRaise: () => void;
}) {
  const worst = climate.worst;
  if (!worst) return null;
  const WorstIcon = toneIcon(worst.tone);
  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded border border-l-[3px] px-2.5 py-2",
        worst.isAlarm
          ? "border-divider border-l-danger bg-danger-muted/30"
          : "border-divider border-l-warning",
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[12px] font-[450]">
          {roomLabel(climate.roomId)}
        </span>
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {worst.value.toFixed(worst.decimals)}
        </span>
        <span className="text-muted-foreground text-[10px]">{worst.unit}</span>
      </div>
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10.5px]">
        <ToneBadge tone={worst.tone}>
          <WorstIcon aria-hidden className="size-3 shrink-0" />
          {worst.statusLabel}
        </ToneBadge>
        {worst.since && <span>for {formatAge(worst.since)}</span>}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onOpen}
          className="interactive focus-ring pressable border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground cursor-pointer rounded border px-2 py-1 text-[10.5px] leading-none font-medium"
        >
          Open device
        </button>
        <button
          type="button"
          onClick={onRaise}
          className="interactive focus-ring pressable border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground cursor-pointer rounded border px-2 py-1 text-[10.5px] leading-none font-medium"
        >
          Raise a request
        </button>
      </div>
    </li>
  );
}

/**
 * A building's measuring devices, as cards with their own graph.
 *
 * These used to live in one "Live monitoring" strip above every building at
 * once, which meant the estate's readings were in a different place from the
 * estate. They belong to the building, so they are in it — and the categorical
 * devices below keep the compact list they were always right for, because a
 * door is locked or it is not and a chart of that says nothing.
 */
function BuildingReadings({ sensors }: { sensors: EnvironmentalSensor[] }) {
  const { simulation } = useAppState();
  const { readings, series, manual, hold, release } = simulation;
  const measuring = sensors.filter((s) => isMeasuring(sensorType(s.typeId)));
  if (measuring.length === 0) return null;

  return (
    <div className="border-divider grid gap-2.5 border-b p-3 sm:grid-cols-2 xl:grid-cols-3">
      {measuring.map((s) => (
        <ReadingCard
          key={s.id}
          sensor={s}
          reading={readings[s.id] ?? s.reading}
          history={series[s.id] ?? []}
          held={manual[s.id] !== undefined}
          onHold={(v) => hold(s.id, v)}
          onRelease={() => release(s.id)}
        />
      ))}
    </div>
  );
}

/**
 * The building, answered before anything is read.
 *
 * Four views of one list — `roomClimates` in lib/climate.ts — so the headline,
 * the grid, the donut and the attention queue cannot disagree about how many
 * rooms are in trouble. A room takes its worst sensor's status, because a room
 * that is comfortable on temperature and choking on CO2 is not comfortable.
 */
function ClimateOverview({
  onRoomPicked,
}: {
  onRoomPicked: (sensorId: string) => void;
}) {
  const router = useRouter();
  const {
    rooms,
    sensors,
    sensorTypeRegistry,
    simulation,
    role,
    activeBuildingId,
  } = useAppState();
  const locked = isBuildingLocked(role);

  const scopedRooms = React.useMemo(
    () =>
      locked ? rooms.filter((r) => r.buildingId === activeBuildingId) : rooms,
    [rooms, locked, activeBuildingId],
  );

  const climates = React.useMemo(
    () =>
      roomClimates(
        scopedRooms,
        sensors,
        sensorTypeRegistry,
        simulation.readings,
      ),
    [scopedRooms, sensors, sensorTypeRegistry, simulation.readings],
  );

  const summary = summarise(climates);
  const attention = needsAttention(climates);
  const avgTemp = averageOf(climates, "temperature");
  const avgCo2 = averageOf(climates, "co2");

  if (climates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Gauge}
          label="Comfortable"
          value={
            summary.comfortable + summary.warning + summary.alarm === 0
              ? "—"
              : `${summary.comfortPct}%`
          }
          note={
            summary.monitored === 0
              ? "No room on this estate has a sensor yet"
              : `${summary.comfortable} of ${
                  summary.comfortable + summary.warning + summary.alarm
                } monitored rooms · ${summary.total - summary.monitored} unwatched`
          }
          tone={
            summary.comfortPct >= 80
              ? "success"
              : summary.alarm > 0
                ? "danger"
                : "warning"
          }
        />
        <Kpi
          icon={TriangleAlert}
          label="Needs attention"
          value={String(summary.warning + summary.alarm)}
          note={
            summary.alarm > 0 ? `${summary.alarm} in alarm` : "None in alarm"
          }
          tone={
            summary.alarm > 0
              ? "danger"
              : summary.warning > 0
                ? "warning"
                : "success"
          }
        />
        <Kpi
          icon={Thermometer}
          label="Avg temperature"
          value={
            avgTemp
              ? `${avgTemp.value.toFixed(avgTemp.decimals)} ${avgTemp.unit}`
              : "—"
          }
          note={avgTemp ? "Across reporting rooms" : "Nothing reporting"}
          tone="neutral"
        />
        <Kpi
          icon={Wind}
          label="Avg air quality"
          value={avgCo2 ? `${Math.round(avgCo2.value)} ${avgCo2.unit}` : "—"}
          note={avgCo2 ? "Across reporting rooms" : "Nothing reporting"}
          tone="neutral"
        />
      </div>

      <div className="grid items-start gap-2.5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="gap-3 p-3.5">
          <div>
            <div className="text-[12.5px] font-semibold">Building climate</div>
            <div className="text-muted-foreground text-[11px]">
              Every room, by floor. Colour is its worst reading right now.
            </div>
          </div>
          <ClimateGrid
            climates={climates}
            onSelect={(roomId) => {
              // Straight to the device that is actually complaining.
              const worst = climates.find((c) => c.roomId === roomId)?.worst;
              if (worst) onRoomPicked(worst.sensorId);
            }}
          />
        </Card>

        <div className="flex flex-col gap-2.5">
          <Card className="gap-3 p-3.5">
            <div className="text-[12.5px] font-semibold">Room status</div>
            <StatusDonut
              centreLabel="rooms"
              slices={[
                {
                  label: "Comfortable",
                  value: summary.comfortable,
                  tone: "success",
                },
                {
                  label: "Needs watching",
                  value: summary.warning,
                  tone: "warning",
                },
                { label: "In alarm", value: summary.alarm, tone: "danger" },
                {
                  label: "Not reporting",
                  value: summary.offline,
                  tone: "neutral",
                },
              ]}
            />
          </Card>

          <Card className="gap-2.5 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[12.5px] font-semibold">
                Needs attention
              </span>
              {attention.length > 0 && (
                <ToneBadge tone={attention[0].hasAlarm ? "danger" : "warning"}>
                  {attention.length}
                </ToneBadge>
              )}
            </div>
            {attention.length === 0 ? (
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Nothing is outside its limits. Every reporting room is in a good
                band.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {attention.slice(0, 3).map((c) => (
                  <AttentionRow
                    key={c.roomId}
                    climate={c}
                    onOpen={() => c.worst && onRoomPicked(c.worst.sensorId)}
                    onRaise={() =>
                      router.push(`/requests?new=1&room=${c.roomId}`)
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  tone: Tone;
}) {
  return (
    <Card className="gap-1 p-3.5">
      <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] uppercase">
        <Icon aria-hidden className={cn("size-4 shrink-0", KPI_TONE[tone])} />
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[24px] leading-none font-semibold tabular-nums",
          KPI_TONE[tone],
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[10.5px]">{note}</span>
    </Card>
  );
}

const KPI_TONE: Record<Tone, string> = {
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
  info: "text-info-foreground",
  neutral: "text-foreground",
};

/**
 * One measuring device, read the way somebody actually asks about it.
 *
 * The first version of this card put seven things on screen — a device id, a
 * number, a unit, a status chip, a sparkline, a scale with four numbers under
 * it, a slider and a word about the simulation — and the one thing it never
 * said was what any of it meant. "STUFFY" was the smallest text on it.
 *
 * The order now matches the questions, in the order they are asked:
 *
 *   1. Where is this?        the room, not the device id
 *   2. Is it all right?      a colour down the edge, and a word
 *   3. What is the number?   still there, just no longer the headline
 *   4. Where is it heading?  a trend, in a word
 *   5. When should I care?   "Poor ventilation above 1400 ppm"
 *
 * Everything an operator needs and a reader does not — the device id, the
 * numbered scale, the history, the dial that forces a value — is one click
 * away, not on screen by default.
 */
function ReadingCard({
  sensor,
  reading,
  history,
  held,
  onHold,
  onRelease,
}: {
  sensor: EnvironmentalSensor;
  reading: number | undefined;
  history: number[];
  held: boolean;
  onHold: (value: number) => void;
  onRelease: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<Range>("live");
  const { equipmentUnits, rooms } = useAppState();
  const type = sensorType(sensor.typeId);
  const m = type?.measurement;
  const value = reading ?? m?.min ?? 0;
  // The simulation steps every few seconds; counting between steps makes a
  // reading look like it is being measured rather than re-fetched. Called
  // before the guard below, because a hook cannot sit after a return.
  const shown = useCountUp(value, m?.decimals ?? 0);
  // Judged by this room's limits, which may not be the estate's — a server
  // rack and a lecture hall do not agree about 27 °C.
  const roomType = rooms.find((r) => r.id === sensor.roomId)?.type;
  const zones = React.useMemo(
    () => bandZones(type, roomType),
    [type, roomType],
  );
  const livePoints = React.useMemo(
    () => liveSeries(history, TICK_SECONDS, Date.now()),
    [history],
  );
  if (!m) return null;

  const band = bandFor(type, value, roomType);
  const def = type?.statuses.find((st) => st.id === band?.statusId);
  const tone = def?.tone ?? "neutral";
  const Icon = sensorIcon(type?.icon ?? "activity");
  // The HVAC unit in this room, if one is running. `stepReadings` drives the
  // temperature toward its setpoint, so the setpoint belongs on the chart —
  // same unit, same axis, and the convergence is the thing worth watching.
  const setpoint =
    type?.id === "temperature"
      ? equipmentUnits.find(
          (u) =>
            u.roomId === sensor.roomId &&
            u.hvac &&
            u.hvac.mode !== "off" &&
            u.condition !== "faulty" &&
            u.condition !== "decommissioned",
        )?.hvac?.setpointC
      : undefined;
  const next = nextThreshold(type, value);
  const nextLabel = next
    ? type?.statuses.find((st) => st.id === next.statusId)?.label
    : undefined;
  const trend = held ? "steady" : trendOf(type, history);

  return (
    <div
      className={cn(
        "border-divider bg-background flex flex-col gap-2 rounded border border-l-[3px] p-2.75",
        // The edge does the scanning work: twelve cards at a glance, and the
        // eye finds the one that is not green without reading a word.
        BAND_EDGE[tone],
        def?.isAlarm && "border-danger bg-danger-muted/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-[450]">
          {roomLabel(sensor.roomId)}
        </span>
        {trend !== "steady" && (
          <span className="text-muted-foreground shrink-0 text-[10.5px]">
            {trend === "rising" ? "↑ rising" : "↓ falling"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={open ? "Hide the detail" : "Device, scale and manual control"}
          className="interactive focus-ring text-muted-foreground hover:text-foreground shrink-0 cursor-pointer rounded"
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[21px] leading-none font-semibold tabular-nums">
          {shown.toFixed(m.decimals)}
        </span>
        <span className="text-muted-foreground text-[11px]">{m.unit}</span>
        <div className="flex-1" />
        <ToneBadge tone={tone}>{def?.label ?? "—"}</ToneBadge>
      </div>

      {/* The graph is the default now, not the number alone. Until a couple
          of readings are in there is no shape to draw, so the band strip
          stands in — it needs one reading, not two. */}
      {livePoints.length >= 2 ? (
        <ReadingChart
          type={type}
          points={livePoints}
          zones={zones}
          mode="live"
          setpoint={setpoint}
          // Keep the next boundary in frame. Without it the domain hugs the
          // reading, only the band it is already in is on screen, and the
          // chart is a flat tinted block that says nothing the badge did not.
          // With it you can see the line travelling towards the edge.
          keepInView={next?.at}
          height={56}
          compact
        />
      ) : (
        <BandScale type={type} value={value} roomType={roomType} />
      )}

      {/* The line that replaces reading a scale: not where you are, but what
          happens next and when. */}
      <span className="text-muted-foreground text-[10.5px] leading-snug">
        {held
          ? "Held at this value — it is not drifting."
          : nextLabel && next
            ? `${nextLabel} ${next.direction} ${next.at} ${m.unit}`
            : "No threshold beyond this one."}
      </span>

      {open && (
        <div className="border-divider mt-0.5 flex flex-col gap-2 border-t pt-2.5">
          <div className="flex items-center gap-2">
            <span className="text-accent-foreground font-mono text-[10.5px] font-medium">
              {sensor.id}
            </span>
            <div className="flex-1" />
            <RangeSwitch value={range} onChange={setRange} />
          </div>

          <ReadingHistory
            sensor={sensor}
            type={type}
            roomType={roomType}
            range={range}
            live={history}
            setpoint={setpoint}
          />

          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[10px]">
              Drag to force a reading across a threshold
            </span>
            <input
              type="range"
              aria-label={`Force a reading for ${sensor.id}`}
              min={m.min}
              max={m.max}
              step={m.decimals > 0 ? 0.1 : 1}
              value={value}
              onChange={(e) => onHold(Number(e.target.value))}
              className="accent-primary w-full cursor-pointer"
            />
          </label>
          {held && (
            <button
              type="button"
              onClick={onRelease}
              className="interactive focus-ring text-primary w-fit cursor-pointer text-[10.5px] font-medium hover:underline"
            >
              Release and let it drift
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * How far back a reading chart looks.
 *
 * Live and the other two are not the same kind of data and are deliberately
 * never on one axis — see lib/chart-data.ts. This switch is what keeps that
 * difference in front of the reader rather than hiding it in a join.
 */
type Range = "live" | "24h" | "7d";

const RANGES: { id: Range; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "24h", label: "24h" },
  { id: "7d", label: "7 days" },
];

function RangeSwitch({
  value,
  onChange,
}: {
  value: Range;
  onChange: (next: Range) => void;
}) {
  return (
    <div className="border-input bg-card flex shrink-0 items-center rounded border p-[2px]">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={cn(
            "interactive focus-ring cursor-pointer rounded-[3px] px-1.75 py-0.75 text-[10px] font-medium",
            value === r.id
              ? "bg-primary text-primary-foreground"
              : "text-foreground/70",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The chart, and the honest empty state behind it.
 *
 * Live draws the in-memory window as a curve. The other two draw Log Book
 * crossings as a step, because that is what the record is — the moments a
 * reading changed band, not a continuous measurement. When there is nothing to
 * draw the panel says *why*, and the reason differs: live is about to have
 * data, history may genuinely never have had any.
 */
function ReadingHistory({
  sensor,
  type,
  roomType,
  range,
  live,
  setpoint,
}: {
  sensor: EnvironmentalSensor;
  type: SensorTypeDef | undefined;
  roomType?: RoomType;
  range: Range;
  live: number[];
  setpoint?: number;
}) {
  const { logBook } = useAppState();
  const zones = React.useMemo(
    () => bandZones(type, roomType),
    [type, roomType],
  );

  const points = React.useMemo(() => {
    if (range === "live") return liveSeries(live, TICK_SECONDS, Date.now());
    const days = range === "24h" ? 1 : 7;
    return recordedSeries(logBook, sensor.id, Date.now() - days * 86_400_000);
  }, [range, live, logBook, sensor.id]);

  if (points.length < 2) {
    return (
      <div className="border-divider text-muted-foreground flex h-[168px] items-center justify-center rounded border border-dashed px-4 text-center text-[10.5px] leading-relaxed">
        {range === "live"
          ? "Watching — the line starts once a few readings are in."
          : `Nothing recorded for this device in the last ${
              range === "24h" ? "24 hours" : "7 days"
            }. Only a change of band is written down, so a device sitting steady leaves no trace.`}
      </div>
    );
  }

  return (
    <ReadingChart
      type={type}
      points={points}
      zones={zones}
      mode={range === "live" ? "live" : "recorded"}
      setpoint={setpoint}
    />
  );
}

/** Tone → the left edge that makes a card scannable without being read. */
const BAND_EDGE: Record<Tone, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-danger",
  info: "border-l-info",
  neutral: "border-l-neutral-foreground/40",
};

/**
 * The type's thresholds, drawn to scale, with the reading marked on them.
 *
 * This is the piece that was missing. A card showed a number and a status
 * chip, and the number turned from one status into another at boundaries
 * nobody could see — so "STUFFY" was a word the app asserted rather than a
 * reading you could place. The bar is the type's own bands, each segment as
 * wide as the range it covers, so where the reading sits and how far it is
 * from the next band are both just visible.
 */
function BandScale({
  type,
  value,
  roomType,
  showNumbers = false,
}: {
  type: SensorTypeDef | undefined;
  value: number;
  roomType?: RoomType;
  /** Off by default: the colours answer the question, the numbers only add. */
  showNumbers?: boolean;
}) {
  const m = type?.measurement;
  if (!m) return null;
  const span = m.max - m.min || 1;
  const current = bandFor(type, value, roomType)?.statusId;

  // A band runs from the previous band's ceiling to its own; the last has no
  // ceiling, so it runs to the top of the dial.
  let from = m.min;
  const segments = bandsFor(type, roomType).map((b) => {
    const to = b.upTo ?? m.max;
    const seg = {
      statusId: b.statusId,
      upTo: b.upTo,
      width: (Math.max(0, Math.min(m.max, to) - from) / span) * 100,
    };
    from = to;
    return seg;
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex h-1 overflow-hidden rounded-full">
        {segments.map((seg) => {
          const def = type?.statuses.find((st) => st.id === seg.statusId);
          const here = seg.statusId === current;
          return (
            <span
              key={seg.statusId}
              title={`${def?.label ?? seg.statusId}${
                seg.upTo === null ? ` — above ${from}` : ` — up to ${seg.upTo}`
              } ${m.unit}`}
              style={{ width: `${seg.width}%` }}
              // Only the band the reading is in is at full strength. Painting
              // all four was a rainbow that drew the eye harder than the
              // number did, and said nothing the left edge had not already.
              className={cn(
                BAND_FILL[def?.tone ?? "neutral"],
                !here && "opacity-20",
              )}
            />
          );
        })}
        <span
          aria-hidden
          style={{ left: `${gaugeFraction(type, value) * 100}%` }}
          className="bg-foreground absolute top-[-2px] h-[calc(100%+4px)] w-[2px] -translate-x-1/2 rounded-full"
        />
      </div>
      {showNumbers && (
        <div className="text-muted-foreground relative h-2.5 font-mono text-[9px]">
          <span className="absolute left-0">{m.min}</span>
          {segments.slice(0, -1).map((seg, i) => (
            <span
              key={seg.statusId}
              style={{
                left: `${segments.slice(0, i + 1).reduce((a, x) => a + x.width, 0)}%`,
              }}
              className="absolute -translate-x-1/2"
            >
              {seg.upTo}
            </span>
          ))}
          <span className="absolute right-0">
            {m.max} {m.unit}
          </span>
        </div>
      )}
    </div>
  );
}

/** Tone → the fill a band segment takes. */
const BAND_FILL: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral-foreground/40",
};
