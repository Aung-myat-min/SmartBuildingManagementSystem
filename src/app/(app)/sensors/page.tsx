"use client";

import {
  Bell,
  ChevronDown,
  DoorClosed,
  Flame,
  Lock,
  LockOpen,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
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
import { FormDrawer } from "@/components/shared/form-drawer";
import { PulseDot } from "@/components/shared/pulse-dot";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { useLiveClock } from "@/hooks/use-live-clock";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppState } from "@/lib/app-state";
import { isAlarmStatus, isSensorOffline } from "@/lib/derive";
import { formatRelative } from "@/lib/format";
import {
  BUILDING_META,
  BUILDINGS,
  buildingName,
  EQUIPMENT_UNITS,
  equipmentForSensor,
  roomLabel,
  roomsForBuilding,
  SENSOR_TYPES,
  SENSORS,
} from "@/lib/mock-data";
import {
  canAct,
  canActOnSensor,
  isBuildingLocked,
  SENSOR_LOCK_REASON,
} from "@/lib/permissions";
import type { EnvironmentalSensor, SensorAction } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Each sensor type carries its own status vocabulary, so this is a lookup
 * over whatever a SensorTypeDef declares rather than a fixed union. A new
 * sensor type only needs a tone here, not a change to the page.
 */
const STATUS_TONE: Record<string, Tone> = {
  normal: "success",
  locked: "success",
  unlocked: "info",
  triggered: "danger",
  "forced-open": "danger",
  offline: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  normal: "Normal",
  locked: "Locked",
  unlocked: "Unlocked",
  triggered: "Triggered",
  "forced-open": "Forced open",
  offline: "Offline",
};

const ACTION_ICON: Record<string, React.ElementType> = {
  reset: RotateCcw,
  lock: Lock,
  unlock: LockOpen,
};

const TYPE_ICON: Record<string, React.ElementType> = {
  "fire-alarm": Flame,
  "door-lock": DoorClosed,
};

type Filter = "all" | "alarms" | "offline";

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

// useSearchParams opts the subtree into client rendering, so the deep-link
// read sits behind its own boundary rather than blocking the whole route.
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
  const { role, activeBuildingId, sensorStatus, setSensorStatus } =
    useAppState();
  const confirm = useConfirm();
  const clock = useLiveClock();

  const locked = isBuildingLocked(role);
  const mayAct = canActOnSensor(role);

  const [filter, setFilter] = usePersistedState<Filter>("sensors.show", "all");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);

  // Arriving from an equipment unit's SAME PHYSICAL DEVICE panel.
  const deviceParam = params.get("device");
  React.useEffect(() => {
    if (deviceParam) setOpenId(deviceParam);
  }, [deviceParam]);

  const statusOf = React.useCallback(
    (s: EnvironmentalSensor) => sensorStatus(s.id, s.status),
    [sensorStatus],
  );

  const inScope = SENSORS.filter(
    (s) => !locked || s.buildingId === activeBuildingId,
  );

  const matchesFilter = (s: EnvironmentalSensor) => {
    const status = statusOf(s);
    if (filter === "alarms") return isAlarmStatus(status);
    if (filter === "offline") return isSensorOffline(status);
    return true;
  };

  const visible = inScope.filter(matchesFilter);
  const alarmCount = inScope.filter((s) => isAlarmStatus(statusOf(s))).length;
  const offlineCount = inScope.filter((s) =>
    isSensorOffline(statusOf(s)),
  ).length;

  const buildings = BUILDINGS.filter(
    (b) => !locked || b.id === activeBuildingId,
  );

  const selected = openId
    ? (SENSORS.find((s) => s.id === openId) ?? null)
    : null;

  const runAction = async (s: EnvironmentalSensor, action: SensorAction) => {
    const result = await confirm({
      title: `${action.label} ${s.id}?`,
      body: `${roomLabel(s.roomId)} · ${buildingName(s.buildingId)}. The device moves to ${statusLabel(action.resultStatus)}.`,
      note: action.requiresNote
        ? "Resetting a fire alarm is recorded against your name in the Log Book."
        : undefined,
      tone: action.requiresNote ? "danger" : "info",
      confirmLabel: action.label,
      requireReason: action.requiresNote,
    });
    if (!result.confirmed) return;
    setSensorStatus(s.id, action.resultStatus);
    toast.success(`${s.id} → ${statusLabel(action.resultStatus)}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
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
              "cursor-pointer rounded border px-2.5 py-1.75 text-[11.5px] leading-none font-medium",
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

        {canAct(role) && (
          <button
            type="button"
            title="Register a new sensor on the network"
            onClick={() => setFormOpen(true)}
            className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer rounded border px-3 py-2 text-[11.5px] leading-none font-medium"
          >
            + New sensor
          </button>
        )}
      </div>

      {buildings.map((b) => {
        const group = visible.filter((s) => s.buildingId === b.id);
        const groupAlarms = group.filter((s) =>
          isAlarmStatus(statusOf(s)),
        ).length;
        const isOpen = !collapsed[b.id];
        return (
          <div
            key={b.id}
            className="border-border bg-card overflow-hidden rounded-[5px] border"
          >
            <button
              type="button"
              title={isOpen ? "Collapse this building" : "Expand this building"}
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [b.id]: isOpen }))
              }
              className={cn(
                "hover:bg-surface-hover flex w-full items-center gap-2.5 px-4 py-3 text-left",
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
                {BUILDING_META[b.id]?.code}
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

            {isOpen && (
              <div className="grid grid-cols-2 max-lg:grid-cols-1">
                {SENSOR_TYPES.map((type) => {
                  const items = group.filter((s) => s.typeId === type.id);
                  const Icon = TYPE_ICON[type.id] ?? Flame;
                  return (
                    <div
                      key={type.id}
                      className="border-divider border-r last:border-r-0 max-lg:border-r-0 max-lg:border-b"
                    >
                      <div className="border-divider text-muted-foreground flex items-center gap-2 border-b px-4 py-2.25">
                        <Icon className="size-3.25" />
                        <span className="flex-1 font-mono text-[10px] tracking-[0.06em] uppercase">
                          {type.label === "Fire detector"
                            ? "Fire detection"
                            : "Door hardware"}
                        </span>
                        <span className="font-mono text-[10.5px]">
                          {items.length}
                        </span>
                      </div>

                      {items.map((s) => {
                        const status = statusOf(s);
                        const alarm = isAlarmStatus(status);
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
                              className="flex w-full items-center gap-2.5 text-left"
                            >
                              <PulseDot
                                tone={STATUS_TONE[status] ?? "neutral"}
                                pulse={alarm}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12.5px] font-[450]">
                                  {s.id}
                                </div>
                                <div className="text-muted-foreground mt-0.5 text-[10.5px] leading-snug">
                                  {roomLabel(s.roomId)} ·{" "}
                                  {formatRelative(s.updatedAt)}
                                </div>
                              </div>
                              <ToneBadge
                                tone={STATUS_TONE[status] ?? "neutral"}
                              >
                                {statusLabel(status)}
                              </ToneBadge>
                            </button>

                            {(alarm || offline) && (
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                {actions.map((a) => {
                                  const allowed =
                                    mayAct && a.allowedRoles.includes(role);
                                  return (
                                    <button
                                      key={a.id}
                                      type="button"
                                      disabled={!allowed}
                                      title={
                                        allowed ? a.caption : SENSOR_LOCK_REASON
                                      }
                                      onClick={() => runAction(s, a)}
                                      className={cn(
                                        "bg-card flex cursor-pointer items-center gap-1 rounded border px-2.25 py-1.25 text-[10.5px] leading-none font-medium",
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
            )}
          </div>
        );
      })}

      {visible.length === 0 && (
        <EmptyState>
          No devices match this filter — every sensor in scope is reporting
          normally.
        </EmptyState>
      )}

      <SensorDrawer
        sensor={selected}
        status={selected ? statusOf(selected) : ""}
        role={role}
        mayAct={mayAct}
        onClose={() => {
          setOpenId(null);
          if (deviceParam) router.replace("/sensors");
        }}
        onRunAction={runAction}
        onGoToEquipment={() => {
          setOpenId(null);
          router.push("/equipment");
        }}
      />

      <NewSensorDrawer open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function SensorDrawer({
  sensor,
  status,
  role,
  mayAct,
  onClose,
  onRunAction,
  onGoToEquipment,
}: {
  sensor: EnvironmentalSensor | null;
  status: string;
  role: ReturnType<typeof useAppState>["role"];
  mayAct: boolean;
  onClose: () => void;
  onRunAction: (s: EnvironmentalSensor, a: SensorAction) => void;
  onGoToEquipment: () => void;
}) {
  // Editing stays in this drawer rather than stacking a second one on top of
  // the record being edited.
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

  const type = SENSOR_TYPES.find((t) => t.id === sensor.typeId);
  const linked = equipmentForSensor(sensor);
  const offline = isSensorOffline(status);

  return (
    <DetailDrawer open size="narrow" onOpenChange={(o) => !o && onClose()}>
      <DetailDrawerHeader
        tag={sensor.id}
        chip={
          <ToneBadge tone={STATUS_TONE[status] ?? "neutral"}>
            {statusLabel(status)}
          </ToneBadge>
        }
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
        <DetailMeta label="Status" value={statusLabel(status)} />
        <DetailMeta
          label="Last report"
          value={formatRelative(sensor.updatedAt)}
        />
        <DetailMeta
          label="Vocabulary"
          value={type?.statuses.map(statusLabel).join(" / ") ?? "—"}
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
            onSubmit={() => {
              if (fields.name.trim().length === 0) {
                fields.setError("A device needs a name.");
                return;
              }
              toast.success(`${fields.name} updated`);
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
                const allowed = mayAct && a.allowedRoles.includes(role);
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
            <button
              type="button"
              disabled={!mayAct}
              title={mayAct ? "Edit this sensor's details" : SENSOR_LOCK_REASON}
              onClick={() => setEditing(true)}
              className={cn(
                "bg-card flex cursor-pointer items-center gap-1 rounded border px-2.75 py-1.75 text-[11px] leading-none font-medium",
                mayAct
                  ? "border-input text-neutral-foreground hover:border-primary hover:text-accent-foreground"
                  : "border-border cursor-not-allowed opacity-45",
              )}
            >
              {!mayAct && <Lock className="size-2.5" />}
              Edit details
            </button>
            <button
              type="button"
              disabled={!mayAct}
              title={mayAct ? "Remove this sensor" : SENSOR_LOCK_REASON}
              onClick={() => toast.info("Removing a sensor is demo-only here.")}
              className={cn(
                "bg-card flex cursor-pointer items-center gap-1 rounded border px-2.75 py-1.75 text-[11px] leading-none font-medium",
                mayAct
                  ? "border-danger/40 text-danger-foreground hover:bg-danger-muted"
                  : "border-border cursor-not-allowed opacity-45",
              )}
            >
              <Trash2 className="size-2.5" />
              Remove
            </button>
          </DetailDrawerSection>
        </>
      )}
    </DetailDrawer>
  );
}

/** The registration fields, shared by the inline edit and the new-sensor drawer. */
function useSensorFields(seed: EnvironmentalSensor | null, active: boolean) {
  const [name, setName] = React.useState("");
  const [typeId, setTypeId] = React.useState(SENSOR_TYPES[0]?.id ?? "");
  const [buildingId, setBuildingId] = React.useState(BUILDINGS[0]?.id ?? "");
  const [roomId, setRoomId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [linkTag, setLinkTag] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reseed when the form opens
  React.useEffect(() => {
    if (!active) return;
    setName(seed?.id ?? "");
    setTypeId(seed?.typeId ?? SENSOR_TYPES[0]?.id ?? "");
    setBuildingId(seed?.buildingId ?? BUILDINGS[0]?.id ?? "");
    setRoomId(seed?.roomId ?? "");
    setStatus(seed?.status ?? SENSOR_TYPES[0]?.statuses[0] ?? "");
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
  "border-input focus:border-primary bg-card w-full rounded border px-2.25 py-1.75 text-[12px] outline-none";
const FIELD_SELECT =
  "border-input bg-card w-full cursor-pointer rounded border px-2 py-1.75 text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60";

function SensorFields({ f, isEdit }: { f: SensorFieldState; isEdit: boolean }) {
  const type = SENSOR_TYPES.find((t) => t.id === f.typeId);
  const rooms = roomsForBuilding(f.buildingId);
  const linkable = EQUIPMENT_UNITS.filter((u) => u.buildingId === f.buildingId);

  return (
    <>
      <DrawerField label="Device name">
        <input
          value={f.name}
          onChange={(e) => f.setName(e.target.value)}
          placeholder="e.g. Room 305 detector"
          className={FIELD_INPUT}
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
            const next = SENSOR_TYPES.find((t) => t.id === e.target.value);
            f.setStatus(next?.statuses[0] ?? "");
          }}
          className={FIELD_SELECT}
        >
          {SENSOR_TYPES.map((t) => (
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
            {BUILDINGS.map((b) => (
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
            <option key={st} value={st}>
              {statusLabel(st)}
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

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New sensor"
      description="Register a device already on the network. It starts reporting at the next poll."
      submitLabel="Register sensor"
      error={f.error}
      onSubmit={() => {
        if (f.name.trim().length === 0) {
          f.setError("A device needs a name.");
          return;
        }
        toast.success(`${f.name} registered on the network`);
        onOpenChange(false);
      }}
    >
      <SensorFields f={f} isEdit={false} />
    </FormDrawer>
  );
}
