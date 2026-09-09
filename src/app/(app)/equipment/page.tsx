"use client";

import {
  Archive,
  ArrowRight,
  Camera,
  CheckCircle2,
  Kanban,
  Lock,
  MoveRight,
  Search,
  Table as TableIcon,
  Wrench,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/app-state";
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
} from "@/lib/mock-data";
import { canDecommissionEquipment, isBuildingLocked } from "@/lib/permissions";
import type { EquipmentCondition, EquipmentUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONDITION_META: Record<
  EquipmentCondition,
  { label: string; tone: Tone }
> = {
  healthy: { label: "HEALTHY", tone: "success" },
  faulty: { label: "FAULTY", tone: "danger" },
  "under-maintenance": { label: "MAINT.", tone: "warning" },
  decommissioned: { label: "DECOMMISSIONED", tone: "neutral" },
};

const BOARD_COLUMNS: EquipmentCondition[] = [
  "healthy",
  "under-maintenance",
  "faulty",
  "decommissioned",
];

export default function EquipmentPage() {
  const { role, activeBuildingId, equipmentCondition } = useAppState();
  const locked = isBuildingLocked(role);

  const [view, setView] = React.useState<"list" | "board">("list");
  const [query, setQuery] = React.useState("");
  const [buildingFilter, setBuildingFilter] = React.useState(
    locked ? activeBuildingId : "all",
  );
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [showDecom, setShowDecom] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const effectiveBuilding = locked ? activeBuildingId : buildingFilter;

  const conditionOf = (u: EquipmentUnit) =>
    equipmentCondition(u.id, u.condition);

  const filtered = EQUIPMENT_UNITS.filter((u) => {
    const condition = conditionOf(u);
    if (!showDecom && condition === "decommissioned") return false;
    if (effectiveBuilding !== "all" && u.buildingId !== effectiveBuilding)
      return false;
    if (typeFilter !== "all" && u.typeId !== typeFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${u.tag} ${equipmentUnitLabel(u)} ${roomLabel(u.roomId)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const faultyCount = filtered.filter(
    (u) => conditionOf(u) === "faulty",
  ).length;
  const dueSoonCount = filtered.filter(
    (u) => new Date(u.nextServiceDue).getTime() - Date.now() < 14 * 86400000,
  ).length;

  const selected = EQUIPMENT_UNITS.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex-row flex-wrap items-center gap-2 p-2.5">
        <div className="border-input focus-within:border-primary relative min-w-32 flex-1 rounded-md border">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tag, type or room"
            className="w-full bg-transparent py-1.5 pr-3 pl-8 text-[12px] outline-none"
          />
        </div>
        <Select
          value={effectiveBuilding}
          onValueChange={(v) => setBuildingFilter(v ?? "all")}
          disabled={locked}
        >
          <SelectTrigger size="sm" className="text-[12px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buildings</SelectItem>
            {BUILDINGS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v ?? "all")}
        >
          <SelectTrigger size="sm" className="text-[12px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EQUIPMENT_TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          title="Decommissioned units are hidden by default"
          onClick={() => setShowDecom((v) => !v)}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium",
            showDecom
              ? "border-primary bg-accent text-info-foreground"
              : "border-border text-foreground/70",
          )}
        >
          {showDecom ? "Hide decommissioned" : "Show decommissioned"}
        </button>
        <div className="bg-border h-5.5 w-px" />
        <ToneBadge tone="info" title="Units in scope">
          {filtered.length} in scope
        </ToneBadge>
        <ToneBadge tone="danger" title="Faulty">
          {faultyCount} faulty
        </ToneBadge>
        <ToneBadge tone="warning" title="Service due within 14 days">
          {dueSoonCount} due soon
        </ToneBadge>
        <div className="flex-1" />
        <div className="bg-secondary flex items-center gap-1 rounded-md p-[3px]">
          <button
            type="button"
            title="Register"
            onClick={() => setView("list")}
            className={cn(
              "rounded p-1.5",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60",
            )}
          >
            <TableIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Condition board"
            onClick={() => setView("board")}
            className={cn(
              "rounded p-1.5",
              view === "board"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60",
            )}
          >
            <Kanban className="size-3.5" />
          </button>
        </div>
      </Card>

      {view === "list" ? (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="bg-surface-subtle border-border text-muted-foreground flex border-b px-4 py-2 font-mono text-[10px] tracking-wider">
            <span className="w-24">TAG</span>
            <span className="w-36">TYPE</span>
            <span className="flex-1">LOCATION</span>
            <span className="w-24">CONDITION</span>
            <span className="w-22">INSTALLED</span>
            <span className="w-24">NEXT SERVICE</span>
            <span className="w-16 text-right">REQUESTS</span>
            <span className="w-14 text-right">DETAIL</span>
          </div>
          {filtered.length === 0 && (
            <EmptyState className="m-4">
              No equipment matches these filters.
            </EmptyState>
          )}
          {filtered.map((u) => {
            const condition = conditionOf(u);
            const meta = CONDITION_META[condition];
            const dueSoon =
              new Date(u.nextServiceDue).getTime() - Date.now() < 14 * 86400000;
            return (
              <button
                type="button"
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={cn(
                  "border-border hover:bg-surface-hover flex w-full items-center border-b border-l-[3px] px-4 py-2.5 text-left text-[12px] last:border-b-0",
                  condition === "decommissioned" && "opacity-55",
                )}
                style={{
                  borderLeftColor:
                    condition === "faulty"
                      ? "var(--color-danger)"
                      : "transparent",
                }}
              >
                <span className="text-primary w-24 font-mono text-[11px] font-medium">
                  {u.tag}
                </span>
                <span className="w-36 truncate">{equipmentUnitLabel(u)}</span>
                <span className="text-foreground/70 flex-1 truncate">
                  {roomLabel(u.roomId)}
                </span>
                <span className="w-24">
                  <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                </span>
                <span className="text-muted-foreground w-22 font-mono text-[11px]">
                  {formatDate(u.installedAt)}
                </span>
                <span
                  className={cn(
                    "w-24 font-mono text-[11px]",
                    dueSoon && "text-warning-foreground font-medium",
                  )}
                >
                  {formatDate(u.nextServiceDue)}
                </span>
                <span
                  className={cn(
                    "w-16 text-right font-mono text-[12px] font-medium",
                    u.openRequestCount > 0
                      ? "text-warning-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {u.openRequestCount}
                </span>
                <span className="text-primary flex w-14 items-center justify-end gap-0.5 text-[11px]">
                  Open <ArrowRight className="size-3" />
                </span>
              </button>
            );
          })}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BOARD_COLUMNS.filter((c) => c !== "decommissioned" || showDecom).map(
            (condition) => {
              const items = filtered.filter(
                (u) => conditionOf(u) === condition,
              );
              const meta = CONDITION_META[condition];
              return (
                <div
                  key={condition}
                  className="bg-muted border-border flex flex-col rounded-md border"
                >
                  <div
                    className="bg-card border-border flex items-center gap-2 rounded-t-[5px] border-b px-3 py-2.5"
                    style={{
                      borderTop: `2px solid var(--color-${meta.tone === "neutral" ? "neutral-foreground" : meta.tone})`,
                    }}
                  >
                    <span className="text-[11px] font-semibold">
                      {meta.label}
                    </span>
                    <span className="bg-secondary rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    {items.length === 0 && (
                      <EmptyState>Nothing here.</EmptyState>
                    )}
                    {items.map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedId(u.id)}
                        className="border-border hover:border-primary bg-card rounded-md border border-l-[3px] p-2.5 text-left"
                        style={{
                          borderLeftColor:
                            u.openRequestCount > 0
                              ? "var(--color-warning)"
                              : "var(--color-border)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-primary font-mono text-[10.5px] font-medium">
                            {u.tag}
                          </span>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {formatDate(u.nextServiceDue)}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[12px] font-[450]">
                          {equipmentUnitLabel(u)}
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-[10.5px]">
                          {roomLabel(u.roomId)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      <EquipmentDrawer unit={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function EquipmentDrawer({
  unit,
  onClose,
}: {
  unit: EquipmentUnit | null;
  onClose: () => void;
}) {
  const { role, equipmentCondition, setEquipmentCondition } = useAppState();
  const confirm = useConfirm();
  const canDecommission = canDecommissionEquipment(role);
  const [form, setForm] = React.useState<"none" | "service" | "move">("none");

  // biome-ignore lint/correctness/useExhaustiveDependencies: unit?.id is a deliberate reset trigger, not a value read by the effect
  React.useEffect(() => setForm("none"), [unit?.id]);

  if (!unit)
    return (
      <Sheet open={false} onOpenChange={onClose}>
        <SheetContent />
      </Sheet>
    );

  const condition = equipmentCondition(unit.id, unit.condition);
  const meta = CONDITION_META[condition];
  const history = EQUIPMENT_HISTORY.filter(
    (h) => h.equipmentUnitId === unit.id,
  );

  const setCondition = async (
    next: EquipmentCondition,
    label: string,
    tone: "danger" | "warning" | "info",
    requireReason = false,
  ) => {
    const result = await confirm({
      title: `${label}?`,
      body: (
        <>
          {unit.tag} — {equipmentUnitLabel(unit)} in {roomLabel(unit.roomId)}.
        </>
      ),
      tone,
      confirmLabel: label,
      requireReason,
    });
    if (!result.confirmed) return;
    setEquipmentCondition(unit.id, next);
    toast.success(`${unit.tag} → ${CONDITION_META[next].label}`);
  };

  return (
    <Sheet open={!!unit} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-105">
        <SheetHeader className="border-border border-b">
          <div className="flex items-center gap-2">
            <span className="text-primary font-mono text-[12px] font-medium">
              {unit.tag}
            </span>
            <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
          </div>
          <div className="mt-2 flex gap-3">
            <div className="bg-muted text-muted-foreground flex size-21 shrink-0 items-center justify-center rounded-md">
              <Camera className="size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-[15px] leading-tight">
                {equipmentUnitLabel(unit)}
              </SheetTitle>
              <div className="text-muted-foreground mt-1 text-[11.5px]">
                {roomLabel(unit.roomId)} · {buildingName(unit.buildingId)}
              </div>
              <div className="text-muted-foreground mt-1.5 font-mono text-[10px]">
                Drop a photo of this unit
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          <MetaField label="Installed" value={formatDate(unit.installedAt)} />
          <MetaField
            label="Next service"
            value={formatDate(unit.nextServiceDue)}
          />
          <MetaField
            label="Open requests"
            value={String(unit.openRequestCount)}
            tone={
              unit.openRequestCount > 0 ? "text-warning-foreground" : undefined
            }
          />
          <MetaField
            label="Last service"
            value={unit.lastServiceAt ? formatDate(unit.lastServiceAt) : "—"}
          />
        </div>

        <div className="border-border border-t px-4 py-4">
          <div className="text-muted-foreground mb-2 font-mono text-[9.5px] tracking-wider">
            ACTIONS
          </div>
          {form === "none" && (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                icon={Wrench}
                label="Mark faulty"
                onClick={() =>
                  setCondition("faulty", "Mark as faulty", "danger")
                }
              />
              <ActionButton
                icon={CheckCircle2}
                label="Return to service"
                onClick={() =>
                  setCondition("healthy", "Return to service", "info")
                }
              />
              <ActionButton
                icon={Wrench}
                label="Under maintenance"
                onClick={() =>
                  setCondition(
                    "under-maintenance",
                    "Mark under maintenance",
                    "warning",
                  )
                }
              />
              <ActionButton
                icon={Camera}
                label="Record a service"
                onClick={() => setForm("service")}
              />
              <ActionButton
                icon={MoveRight}
                label="Move unit"
                onClick={() => setForm("move")}
              />
              <ActionButton
                icon={Archive}
                label="Decommission"
                disabled={!canDecommission}
                caption={
                  !canDecommission
                    ? "Not available for Office Staff"
                    : undefined
                }
                onClick={() =>
                  setCondition(
                    "decommissioned",
                    "Decommission this unit",
                    "danger",
                    true,
                  )
                }
              />
            </div>
          )}
          {form === "service" && (
            <ServiceForm unit={unit} onDone={() => setForm("none")} />
          )}
          {form === "move" && (
            <MoveForm unit={unit} onDone={() => setForm("none")} />
          )}
        </div>

        <div className="border-border border-t px-4 py-4">
          <div className="text-muted-foreground mb-2 font-mono text-[9.5px] tracking-wider">
            HISTORY
          </div>
          <div className="flex flex-col gap-3">
            {history.length === 0 && (
              <p className="text-muted-foreground text-[11.5px]">
                No history recorded yet.
              </p>
            )}
            {history.map((h) => (
              <div key={h.id} className="flex gap-2.5">
                <span className="bg-primary mt-1 size-1.5 shrink-0 rounded-full" />
                <div>
                  <div className="text-[12px] font-[450]">{h.summary}</div>
                  <div className="text-muted-foreground mt-0.5 font-mono text-[10.5px]">
                    {formatRelative(h.at)} · {h.actorName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MetaField({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground font-mono text-[9.5px] tracking-wider">
        {label.toUpperCase()}
      </div>
      <div className={cn("mt-0.5 text-[12px] font-medium", tone)}>{value}</div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  caption,
  disabled,
  onClick,
}: {
  icon: typeof Wrench;
  label: string;
  caption?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border-border flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:border-primary hover:bg-accent/40",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium">
        {disabled ? <Lock className="size-3" /> : <Icon className="size-3" />}
        {label}
      </span>
      {caption && (
        <span className="text-muted-foreground text-[10.5px]">{caption}</span>
      )}
    </button>
  );
}

function ServiceForm({
  unit,
  onDone,
}: {
  unit: EquipmentUnit;
  onDone: () => void;
}) {
  const [cost, setCost] = React.useState("");
  const [parts, setParts] = React.useState("");
  const [notes, setNotes] = React.useState("");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date">
          <Input defaultValue={formatDate(new Date().toISOString())} disabled />
        </FormField>
        <FormField label="Cost">
          <Input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="145,000 MMK"
          />
        </FormField>
      </div>
      <FormField label="Parts used">
        <Input
          value={parts}
          onChange={(e) => setParts(e.target.value)}
          placeholder="Parts used"
        />
      </FormField>
      <FormField label="Notes">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="min-h-16"
        />
      </FormField>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => {
            toast.success(`Service recorded for ${unit.tag}`);
            onDone();
          }}
        >
          Save service
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function MoveForm({
  unit,
  onDone,
}: {
  unit: EquipmentUnit;
  onDone: () => void;
}) {
  const [buildingId, setBuildingId] = React.useState(unit.buildingId);
  const [roomId, setRoomId] = React.useState(unit.roomId);
  const rooms = roomsForBuilding(buildingId);
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Building">
        <Select
          value={buildingId}
          onValueChange={(v) => {
            if (v) {
              setBuildingId(v);
              setRoomId(roomsForBuilding(v)[0]?.id ?? "");
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUILDINGS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Room">
        <Select value={roomId} onValueChange={(v) => v && setRoomId(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.roomNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => {
            toast.success(`${unit.tag} moved to ${roomLabel(roomId)}`);
            onDone();
          }}
        >
          Move unit
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
