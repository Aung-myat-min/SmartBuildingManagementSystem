"use client";

import {
  Archive,
  Camera,
  CheckCircle2,
  LayoutGrid,
  MoveRight,
  Search,
  Table as TableIcon,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { FormDrawer, FormField } from "@/components/shared/form-drawer";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppState } from "@/lib/app-state";
import {
  boardColumnFor,
  DUE_SERVICE_DAYS,
  daysUntilService,
  type EquipmentBoardColumn,
  isDueService,
} from "@/lib/derive";
import { formatDate, formatRelative } from "@/lib/format";
import {
  BUILDINGS,
  buildingName,
  EQUIPMENT_HISTORY,
  EQUIPMENT_TYPES,
  EQUIPMENT_UNITS,
  equipmentUnitLabel,
  roomLabel,
  roomsForBuilding,
  sensorForEquipment,
} from "@/lib/mock-data";
import {
  canDecommissionEquipment,
  DECOMMISSION_LOCK_REASON,
  isBuildingLocked,
} from "@/lib/permissions";
import type { EquipmentCondition, EquipmentUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMN_META: Record<
  EquipmentBoardColumn,
  { label: string; tone: Tone; accent: string }
> = {
  healthy: { label: "Healthy", tone: "success", accent: "border-t-success" },
  "due-service": {
    label: "Due service",
    tone: "warning",
    accent: "border-t-warning",
  },
  faulty: { label: "Faulty", tone: "danger", accent: "border-t-danger" },
  "under-maintenance": {
    label: "Under maintenance",
    tone: "info",
    accent: "border-t-info",
  },
  decommissioned: {
    label: "Decommissioned",
    tone: "neutral",
    accent: "border-t-neutral-foreground",
  },
};

const BOARD_ORDER: EquipmentBoardColumn[] = [
  "healthy",
  "due-service",
  "faulty",
  "under-maintenance",
];

function typeLabel(typeId: string) {
  return EQUIPMENT_TYPES.find((t) => t.id === typeId)?.label ?? typeId;
}

export default function EquipmentPage() {
  const router = useRouter();
  const { role, activeBuildingId, equipmentCondition, setEquipmentCondition } =
    useAppState();
  const locked = isBuildingLocked(role);

  const [view, setView] = usePersistedState<"register" | "board">(
    "equipment.view",
    "register",
  );
  const [query, setQuery] = React.useState("");
  const [buildingFilter, setBuildingFilter] = React.useState(
    locked ? activeBuildingId : "all",
  );
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [showDecommissioned, setShowDecommissioned] = usePersistedState(
    "equipment.showDecommissioned",
    false,
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);

  const effectiveBuilding = locked ? activeBuildingId : buildingFilter;

  const conditionOf = React.useCallback(
    (u: EquipmentUnit) => equipmentCondition(u.id, u.condition),
    [equipmentCondition],
  );

  const units = EQUIPMENT_UNITS.filter((u) => {
    const condition = conditionOf(u);
    if (condition === "decommissioned" && !showDecommissioned) return false;
    if (effectiveBuilding !== "all" && u.buildingId !== effectiveBuilding)
      return false;
    if (typeFilter !== "all" && u.typeId !== typeFilter) return false;
    if (query.trim().length === 0) return true;
    const q = query.toLowerCase();
    return (
      u.tag.toLowerCase().includes(q) ||
      typeLabel(u.typeId).toLowerCase().includes(q) ||
      roomLabel(u.roomId).toLowerCase().includes(q)
    );
  });

  const faultyCount = units.filter((u) => conditionOf(u) === "faulty").length;
  const dueCount = units.filter((u) => isDueService(u, conditionOf(u))).length;

  const selected = selectedId
    ? (EQUIPMENT_UNITS.find((u) => u.id === selectedId) ?? null)
    : null;

  const boardColumns = [
    ...BOARD_ORDER,
    ...(showDecommissioned ? (["decommissioned"] as const) : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
        <div className="border-input focus-within:border-primary bg-card flex min-w-45 flex-1 items-center gap-1.5 rounded border px-2">
          <Search className="text-muted-foreground size-3.25 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tag, type or room"
            className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none"
          />
        </div>

        <select
          value={effectiveBuilding}
          disabled={locked}
          title={
            locked
              ? "Office Staff are scoped to their own building."
              : undefined
          }
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="all">All buildings</option>
          {BUILDINGS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          <option value="all">All types</option>
          {EQUIPMENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          title="Decommissioned units are hidden by default"
          onClick={() => setShowDecommissioned((s) => !s)}
          className={cn(
            "shrink-0 cursor-pointer rounded border px-2.5 py-2 text-[11.5px] leading-none font-medium",
            showDecommissioned
              ? "border-primary bg-accent text-accent-foreground"
              : "border-input text-neutral-foreground hover:border-primary",
          )}
        >
          {showDecommissioned ? "Hide" : "Show"} decommissioned
        </button>

        <span className="bg-divider h-5.5 w-px shrink-0" />

        <Chip title="Units in scope" className="bg-primary text-white">
          {units.length}
        </Chip>
        <Chip title="Faulty" className="bg-danger-muted text-danger-foreground">
          !{faultyCount}
        </Chip>
        <Chip
          title={`Service due within ${DUE_SERVICE_DAYS} days`}
          className="bg-warning-muted text-warning-foreground"
        >
          {dueCount}
        </Chip>

        <div className="bg-secondary border-border flex shrink-0 items-center gap-1 rounded-[5px] border p-[3px]">
          <ViewButton
            icon={TableIcon}
            title="Register"
            active={view === "register"}
            onClick={() => setView("register")}
          />
          <ViewButton
            icon={LayoutGrid}
            title="Condition board"
            active={view === "board"}
            onClick={() => setView("board")}
          />
        </div>

        <button
          type="button"
          title="Add a unit to the register"
          onClick={() => setNewOpen(true)}
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer rounded border px-3 py-2 text-[11.5px] leading-none font-medium"
        >
          + New unit
        </button>
      </div>

      {view === "register" ? (
        <div className="border-border bg-card overflow-hidden rounded-[5px] border">
          <div className="bg-surface-subtle border-divider text-muted-foreground flex border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
            <span className="w-26">Tag</span>
            <span className="w-37.5">Type</span>
            <span className="flex-1">Location</span>
            <span className="w-33">Condition</span>
            <span className="w-24">Installed</span>
            <span className="w-29.5">Next service</span>
            <span className="w-20.5 text-right">Requests</span>
            <span className="w-18.5 text-right">Detail</span>
          </div>

          {units.map((u) => {
            const condition = conditionOf(u);
            const due = isDueService(u, condition);
            return (
              <button
                type="button"
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={cn(
                  "border-rule hover:bg-surface-hover flex w-full items-center border-b px-4 py-2.5 text-left",
                  condition === "faulty" && "border-l-danger border-l-[3px]",
                  due && "border-l-warning border-l-[3px]",
                )}
              >
                <span className="text-accent-foreground w-26 font-mono text-[11px] font-medium">
                  {u.tag}
                </span>
                <span className="w-37.5 truncate text-[12px] font-[450]">
                  {typeLabel(u.typeId)}
                </span>
                <span className="text-neutral-foreground min-w-0 flex-1 truncate text-[12px]">
                  {roomLabel(u.roomId)} · {buildingName(u.buildingId)}
                </span>
                <span className="w-33">
                  <ToneBadge tone={COLUMN_META[condition].tone}>
                    {COLUMN_META[condition].label}
                  </ToneBadge>
                </span>
                <span className="text-muted-foreground w-24 font-mono text-[11px]">
                  {formatDate(u.installedAt)}
                </span>
                <span
                  className={cn(
                    "w-29.5 font-mono text-[11px]",
                    due ? "text-warning-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatDate(u.nextServiceDue)}
                </span>
                <span
                  className={cn(
                    "w-20.5 text-right font-mono text-[11px] font-medium",
                    u.openRequestCount > 0
                      ? "text-warning-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {u.openRequestCount}
                </span>
                <span className="text-accent-foreground w-18.5 text-right text-[10.5px] font-medium">
                  Open →
                </span>
              </button>
            );
          })}

          {units.length === 0 && (
            <EmptyState className="m-4">
              No equipment matches these filters — widen the search, or clear
              the building and type filters.
            </EmptyState>
          )}
        </div>
      ) : (
        <div
          className="grid items-start gap-3"
          style={{
            gridTemplateColumns: `repeat(${boardColumns.length}, minmax(0,1fr))`,
          }}
        >
          {boardColumns.map((col) => {
            const items = units.filter(
              (u) => boardColumnFor(u, conditionOf(u)) === col,
            );
            const meta = COLUMN_META[col];
            return (
              <div
                key={col}
                className="border-border bg-card overflow-hidden rounded-[5px] border"
              >
                <div
                  className={cn(
                    "border-divider flex items-center gap-2 border-t-[3px] border-b px-3 py-2.5",
                    meta.accent,
                  )}
                >
                  <span className="flex-1 text-[11px] leading-none font-semibold">
                    {meta.label}
                  </span>
                  <ToneBadge tone={meta.tone}>{items.length}</ToneBadge>
                </div>
                <div className="flex min-h-30 flex-col gap-2 p-2.5">
                  {items.map((u) => {
                    const days = daysUntilService(u);
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedId(u.id)}
                        className={cn(
                          "border-divider hover:border-primary bg-card cursor-pointer rounded border border-l-[3px] px-2.75 py-2.5 text-left",
                          col === "faulty"
                            ? "border-l-danger"
                            : col === "due-service"
                              ? "border-l-warning"
                              : "border-l-transparent",
                        )}
                      >
                        <div className="flex items-center gap-1.75">
                          <span className="text-accent-foreground font-mono text-[10.5px] font-medium">
                            {u.tag}
                          </span>
                          <div className="flex-1" />
                          <span
                            className={cn(
                              "font-mono text-[10px] font-medium",
                              col === "due-service"
                                ? "text-warning-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {days < 0 ? `${Math.abs(days)}d over` : `${days}d`}
                          </span>
                        </div>
                        <div className="mt-1.75 text-[12px] leading-snug font-[450]">
                          {typeLabel(u.typeId)}
                        </div>
                        <div className="text-muted-foreground mt-0.75 text-[10.5px] leading-snug">
                          {roomLabel(u.roomId)}
                        </div>
                      </button>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="text-muted-foreground px-0.5 py-2 text-[11px]">
                      Nothing here.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EquipmentDrawer
        unit={selected}
        conditionOf={conditionOf}
        onClose={() => setSelectedId(null)}
        onSetCondition={setEquipmentCondition}
        onGoToSensor={(sensorId) => {
          setSelectedId(null);
          router.push(`/sensors?device=${sensorId}`);
        }}
        canDecommission={canDecommissionEquipment(role)}
      />

      <NewUnitDrawer
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultBuildingId={locked ? activeBuildingId : BUILDINGS[0].id}
      />
    </div>
  );
}

/**
 * Adding a unit has no record open yet, so it takes its own form drawer —
 * the same 392px shape as registering a sensor.
 */
function NewUnitDrawer({
  open,
  onOpenChange,
  defaultBuildingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBuildingId: string;
}) {
  const { log } = useAppState();
  const [tag, setTag] = React.useState("");
  const [typeId, setTypeId] = React.useState(EQUIPMENT_TYPES[0]?.id ?? "");
  const [buildingId, setBuildingId] = React.useState(defaultBuildingId);
  const [roomId, setRoomId] = React.useState("");
  const [installed, setInstalled] = React.useState("");
  const [serviceInterval, setServiceInterval] = React.useState("180");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTag("");
    setTypeId(EQUIPMENT_TYPES[0]?.id ?? "");
    setBuildingId(defaultBuildingId);
    setRoomId(roomsForBuilding(defaultBuildingId)[0]?.id ?? "");
    setInstalled(new Date().toISOString().slice(0, 10));
    setServiceInterval("180");
    setError(null);
  }, [open, defaultBuildingId]);

  const rooms = roomsForBuilding(buildingId);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New unit"
      description="A unit joins the register as healthy. Its first service is scheduled from the install date."
      submitLabel="Add to register"
      error={error}
      onSubmit={() => {
        if (tag.trim().length === 0) {
          setError("A unit needs an asset tag.");
          return;
        }
        if (EQUIPMENT_UNITS.some((u) => u.tag === tag.trim())) {
          setError(`${tag.trim()} is already on the register.`);
          return;
        }
        log({
          source: "equipment",
          actionType: "equipment-status-changed",
          title: "Unit added to the register",
          detail: `${tag.trim()} — ${roomLabel(roomId)}, ${buildingName(buildingId)}.`,
          targetType: "equipment",
          targetId: tag.trim(),
          buildingId,
          refId: tag.trim(),
        });
        toast.success(`${tag.trim()} added to the register`);
        onOpenChange(false);
      }}
    >
      <FormField
        label="Asset tag"
        hint="Follows the unit for the rest of its life."
      >
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. EQ-216-09"
          className="border-input focus:border-primary bg-card w-full rounded border px-2.25 py-2 font-mono text-[11.5px] outline-none"
        />
      </FormField>

      <FormField label="Equipment type">
        <select
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          {EQUIPMENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-2.75">
        <FormField label="Building">
          <select
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setRoomId(roomsForBuilding(e.target.value)[0]?.id ?? "");
            }}
            className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
          >
            {BUILDINGS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Room">
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-2.75">
        <FormField label="Installed">
          <input
            type="date"
            value={installed}
            onChange={(e) => setInstalled(e.target.value)}
            className="border-input focus:border-primary bg-card w-full rounded border px-2.25 py-2 text-[12px] outline-none"
          />
        </FormField>
        <FormField label="Service interval">
          <select
            value={serviceInterval}
            onChange={(e) => setServiceInterval(e.target.value)}
            className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
          >
            <option value="90">Every 90 days</option>
            <option value="180">Every 180 days</option>
            <option value="365">Every year</option>
          </select>
        </FormField>
      </div>
    </FormDrawer>
  );
}

function Chip({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ViewButton({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-[3px] px-2.5 py-1.75",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground/70 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

// ---- Detail drawer ---------------------------------------------------------

function EquipmentDrawer({
  unit,
  conditionOf,
  onClose,
  onSetCondition,
  onGoToSensor,
  canDecommission,
}: {
  unit: EquipmentUnit | null;
  conditionOf: (u: EquipmentUnit) => EquipmentCondition;
  onClose: () => void;
  onSetCondition: (unitId: string, condition: EquipmentCondition) => void;
  onGoToSensor: (sensorId: string) => void;
  canDecommission: boolean;
}) {
  const { log } = useAppState();
  const confirm = useConfirm();
  const [form, setForm] = React.useState<"none" | "service" | "move" | "edit">(
    "none",
  );
  const [photo, setPhoto] = React.useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: unit id is the reset trigger
  React.useEffect(() => {
    setForm("none");
    setPhoto(null);
  }, [unit?.id]);

  // Rendered closed rather than unmounted, so the drawer animates out.
  if (!unit) {
    return (
      <DetailDrawer open={false} onOpenChange={onClose}>
        {null}
      </DetailDrawer>
    );
  }

  const condition = conditionOf(unit);
  const meta = COLUMN_META[condition];
  const history = EQUIPMENT_HISTORY.filter(
    (h) => h.equipmentUnitId === unit.id,
  );
  const linkedSensor = sensorForEquipment(unit.tag);
  const days = daysUntilService(unit);

  // Decommission retires a unit but keeps its history; Delete removes the
  // record from the register outright, which is why it asks for a reason too.
  const onDelete = async () => {
    const result = await confirm({
      title: `Delete ${unit.tag}?`,
      body: `${equipmentUnitLabel(unit)} in ${roomLabel(unit.roomId)} is removed from the register.`,
      note: "Its Log Book and Historical Records entries stay — only the asset record goes. Decommission instead if you want to retire it but keep it on the books.",
      tone: "danger",
      confirmLabel: "Delete unit",
      requireReason: true,
    });
    if (!result.confirmed) return;
    log({
      source: "equipment",
      actionType: "equipment-status-changed",
      title: "Unit deleted from the register",
      detail: `${unit.tag} — ${roomLabel(unit.roomId)}, ${buildingName(unit.buildingId)}.`,
      targetType: "equipment",
      targetId: unit.id,
      buildingId: unit.buildingId,
      refId: unit.tag,
    });
    toast.success(`${unit.tag} deleted from the register`);
    onClose();
  };

  const setCondition = async (
    next: EquipmentCondition,
    title: string,
    tone: "danger" | "warning" | "info",
    note?: string,
    requireReason = false,
  ) => {
    const result = await confirm({
      title,
      body: `${unit.tag} — ${equipmentUnitLabel(unit)} in ${roomLabel(unit.roomId)}.`,
      note,
      tone,
      confirmLabel: title.replace(/\?$/, ""),
      requireReason,
    });
    if (!result.confirmed) return;
    onSetCondition(unit.id, next);
    toast.success(`${unit.tag} → ${COLUMN_META[next].label}`);
  };

  return (
    <DetailDrawer open onOpenChange={(o) => !o && onClose()}>
      <DetailDrawerHeader
        tag={unit.tag}
        chip={<ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>}
        action={
          <>
            <button
              type="button"
              title="Edit this unit's details"
              onClick={() => setForm("edit")}
              className="border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground shrink-0 cursor-pointer rounded border px-2.25 py-1.25 text-[10.5px] leading-none font-medium"
            >
              Edit details
            </button>
            <button
              type="button"
              disabled={!canDecommission}
              title={
                canDecommission
                  ? "Delete this unit from the register"
                  : DECOMMISSION_LOCK_REASON
              }
              onClick={onDelete}
              className={cn(
                "bg-card shrink-0 cursor-pointer rounded border px-2.25 py-1.25 text-[10.5px] leading-none font-medium",
                canDecommission
                  ? "border-danger/40 text-danger-foreground hover:bg-danger-muted"
                  : "border-border text-muted-foreground cursor-not-allowed opacity-45",
              )}
            >
              Delete
            </button>
          </>
        }
        onClose={onClose}
      >
        <div className="mt-3 flex gap-3">
          <label
            title="Choose a photo of this unit"
            className="border-divider bg-background hover:border-primary relative flex h-21 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border"
          >
            {photo ? (
              // biome-ignore lint/performance/noImgElement: a local object URL, not a remote asset
              <img
                src={photo}
                alt={`${unit.tag} — ${equipmentUnitLabel(unit)}`}
                className="size-full object-cover"
              />
            ) : (
              <Camera className="text-muted-foreground size-5" />
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPhoto(URL.createObjectURL(file));
                log({
                  source: "equipment",
                  actionType: "equipment-status-changed",
                  title: "Photo added to a unit",
                  detail: `${unit.tag} — ${roomLabel(unit.roomId)}.`,
                  targetType: "equipment",
                  targetId: unit.id,
                  buildingId: unit.buildingId,
                  refId: unit.tag,
                });
                toast.success(`Photo added to ${unit.tag}`);
              }}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] leading-tight font-semibold">
              {equipmentUnitLabel(unit)}
            </div>
            <div className="text-muted-foreground mt-1 text-[11.5px] leading-snug">
              {roomLabel(unit.roomId)} · {buildingName(unit.buildingId)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[10.5px]">
                {photo ? "Photo attached" : "Drop a photo of this unit"}
              </span>
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="text-danger-foreground cursor-pointer text-[10.5px] font-medium hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </DetailDrawerHeader>

      <DetailMetaGrid>
        <DetailMeta label="Installed" value={formatDate(unit.installedAt)} />
        <DetailMeta
          label="Next service"
          value={formatDate(unit.nextServiceDue)}
          tone={
            isDueService(unit, condition)
              ? "text-warning-foreground"
              : undefined
          }
        />
        <DetailMeta
          label="Open requests"
          value={String(unit.openRequestCount)}
          tone={
            unit.openRequestCount > 0 ? "text-warning-foreground" : undefined
          }
        />
        <DetailMeta
          label="Last service"
          value={unit.lastServiceAt ? formatDate(unit.lastServiceAt) : "—"}
        />
        <DetailMeta
          label="Service due in"
          value={days < 0 ? `${Math.abs(days)} days over` : `${days} days`}
        />
        <DetailMeta label="Condition" value={meta.label} />
      </DetailMetaGrid>

      {linkedSensor && (
        <SameDevicePanel
          id={linkedSensor.id}
          note={`${typeLabel(unit.typeId)} live state — status, last report and reset live on the sensor record.`}
          linkLabel="Sensors →"
          onOpen={() => onGoToSensor(linkedSensor.id)}
        />
      )}

      <DetailDrawerSection label="Actions">
        {form === "none" && (
          <>
            <DrawerActionGrid>
              <DrawerAction
                icon={Wrench}
                label="Mark faulty"
                caption="Raises it on the board and the dashboard"
                onClick={() =>
                  setCondition(
                    "faulty",
                    "Mark as faulty?",
                    "danger",
                    `${unit.tag} shows as faulty everywhere it is counted until it is returned to service.`,
                  )
                }
              />
              <DrawerAction
                icon={CheckCircle2}
                label="Return to service"
                caption="Clears the fault and the maintenance flag"
                onClick={() =>
                  setCondition("healthy", "Return to service?", "info")
                }
              />
              <DrawerAction
                icon={Wrench}
                label="Under maintenance"
                caption="Held out of use while it is worked on"
                onClick={() =>
                  setCondition(
                    "under-maintenance",
                    "Mark under maintenance?",
                    "warning",
                  )
                }
              />
              <DrawerAction
                icon={Camera}
                label="Record a service"
                caption="Logs parts, cost and the next due date"
                onClick={() => setForm("service")}
              />
              <DrawerAction
                icon={MoveRight}
                label="Move unit"
                caption="Reassign it to another room"
                onClick={() => setForm("move")}
              />
              <DrawerAction
                icon={Archive}
                label="Decommission"
                caption="Retires the asset for good"
                tone="danger"
                lockedReason={
                  canDecommission ? undefined : DECOMMISSION_LOCK_REASON
                }
                onClick={() =>
                  setCondition(
                    "decommissioned",
                    "Decommission this unit?",
                    "danger",
                    `${unit.tag} stops reporting and drops out of every count on the estate. Its history stays in the Log Book.`,
                    true,
                  )
                }
              />
            </DrawerActionGrid>
            <p className="text-muted-foreground mt-2.25 text-[11px] leading-relaxed">
              Every action here writes an entry to the Log Book.
            </p>
          </>
        )}
        {form === "service" && (
          <ServiceForm unit={unit} onDone={() => setForm("none")} />
        )}
        {form === "move" && (
          <MoveForm unit={unit} onDone={() => setForm("none")} />
        )}
        {form === "edit" && (
          <EditUnitForm unit={unit} onDone={() => setForm("none")} />
        )}
      </DetailDrawerSection>

      <DetailDrawerSection label="History">
        <div className="flex flex-col gap-3">
          {history.length === 0 && (
            <p className="text-muted-foreground text-[11.5px]">
              No history recorded yet.
            </p>
          )}
          {history.map((h) => (
            <div key={h.id} className="flex gap-2.5">
              <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
              <div>
                <div className="text-[12px] font-[450]">{h.summary}</div>
                <div className="text-muted-foreground mt-0.5 font-mono text-[10.5px]">
                  {formatRelative(h.at)} · {h.actorName}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DetailDrawerSection>
    </DetailDrawer>
  );
}

function EditUnitForm({
  unit,
  onDone,
}: {
  unit: EquipmentUnit;
  onDone: () => void;
}) {
  const [tag, setTag] = React.useState(unit.tag);
  const [typeId, setTypeId] = React.useState(unit.typeId);
  const [installed, setInstalled] = React.useState(
    unit.installedAt.slice(0, 10),
  );
  const [serviceInterval, setServiceInterval] = React.useState("180");
  const [error, setError] = React.useState<string | null>(null);
  const { log } = useAppState();

  return (
    <DrawerInlineForm
      title="Edit unit details"
      description="The tag follows the unit, so changing it renames every record that points at this asset."
      submitLabel="Save details"
      error={error}
      onCancel={onDone}
      onSubmit={() => {
        if (tag.trim().length === 0) {
          setError("A unit needs an asset tag.");
          return;
        }
        log({
          source: "equipment",
          actionType: "equipment-status-changed",
          title: "Unit details edited",
          detail: `${tag.trim()} — registration saved.`,
          targetType: "equipment",
          targetId: unit.id,
          buildingId: unit.buildingId,
          refId: unit.tag,
        });
        toast.success(`${tag.trim()} updated`);
        onDone();
      }}
    >
      <DrawerField label="Asset tag">
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="border-input focus:border-primary bg-card w-full rounded border px-2.25 py-1.75 font-mono text-[11.5px] outline-none"
        />
      </DrawerField>
      <DrawerField label="Equipment type">
        <select
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="border-input bg-card w-full cursor-pointer rounded border px-2 py-1.75 text-[11.5px] font-medium"
        >
          {EQUIPMENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </DrawerField>
      <div className="grid grid-cols-2 gap-2.25">
        <DrawerField label="Installed">
          <input
            type="date"
            value={installed}
            onChange={(e) => setInstalled(e.target.value)}
            className="border-input focus:border-primary bg-card w-full rounded border px-2.25 py-1.75 text-[12px] outline-none"
          />
        </DrawerField>
        <DrawerField label="Service interval">
          <select
            value={serviceInterval}
            onChange={(e) => setServiceInterval(e.target.value)}
            className="border-input bg-card w-full cursor-pointer rounded border px-2 py-1.75 text-[11.5px] font-medium"
          >
            <option value="90">Every 90 days</option>
            <option value="180">Every 180 days</option>
            <option value="365">Every year</option>
          </select>
        </DrawerField>
      </div>
    </DrawerInlineForm>
  );
}

function ServiceForm({
  unit,
  onDone,
}: {
  unit: EquipmentUnit;
  onDone: () => void;
}) {
  const { log } = useAppState();
  const [cost, setCost] = React.useState("");
  const [parts, setParts] = React.useState("");

  return (
    <DrawerInlineForm
      title="Record a service"
      description={`The next service date moves on by ${DUE_SERVICE_DAYS * 6} days.`}
      submitLabel="Save service"
      onCancel={onDone}
      onSubmit={() => {
        log({
          source: "equipment",
          actionType: "equipment-status-changed",
          title: "Service recorded",
          detail: `${unit.tag} — ${roomLabel(unit.roomId)}, ${buildingName(unit.buildingId)}.`,
          targetType: "equipment",
          targetId: unit.id,
          buildingId: unit.buildingId,
          refId: unit.tag,
        });
        toast.success(`Service recorded for ${unit.tag}`);
        onDone();
      }}
    >
      <DrawerField label="Parts used">
        <input
          value={parts}
          onChange={(e) => setParts(e.target.value)}
          placeholder="Lamp module, filter"
          className="border-input focus:border-primary bg-card w-full rounded border px-2.25 py-1.75 text-[12px] outline-none"
        />
      </DrawerField>
      <DrawerField label="Cost">
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="145,000 MMK"
          className="border-input focus:border-primary bg-card w-full rounded border px-2.25 py-1.75 text-[12px] outline-none"
        />
      </DrawerField>
    </DrawerInlineForm>
  );
}

function MoveForm({
  unit,
  onDone,
}: {
  unit: EquipmentUnit;
  onDone: () => void;
}) {
  const { log } = useAppState();
  const [buildingId, setBuildingId] = React.useState(unit.buildingId);
  const [roomId, setRoomId] = React.useState(unit.roomId);
  const rooms = roomsForBuilding(buildingId);

  return (
    <DrawerInlineForm
      title="Move unit"
      description={`${unit.tag} keeps its tag and its history; only its location changes.`}
      submitLabel="Move unit"
      onCancel={onDone}
      onSubmit={() => {
        log({
          source: "equipment",
          actionType: "equipment-status-changed",
          title: "Unit moved",
          detail: `${unit.tag} — ${roomLabel(unit.roomId)} → ${roomLabel(roomId)}, ${buildingName(buildingId)}.`,
          targetType: "equipment",
          targetId: unit.id,
          buildingId,
          refId: unit.tag,
        });
        toast.success(`${unit.tag} moved to ${roomLabel(roomId)}`);
        onDone();
      }}
    >
      <div className="grid grid-cols-2 gap-2.25">
        <DrawerField label="Building">
          <select
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setRoomId(roomsForBuilding(e.target.value)[0]?.id ?? "");
            }}
            className="border-input bg-card w-full cursor-pointer rounded border px-2 py-1.75 text-[11.5px] font-medium"
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
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="border-input bg-card w-full cursor-pointer rounded border px-2 py-1.75 text-[11.5px] font-medium"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber}
              </option>
            ))}
          </select>
        </DrawerField>
      </div>
    </DrawerInlineForm>
  );
}
