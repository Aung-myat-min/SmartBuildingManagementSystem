"use client";

import {
  Kanban,
  Lock,
  MapPin,
  Package,
  Search,
  Table as TableIcon,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { PulseDot } from "@/components/shared/pulse-dot";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/app-state";
import { formatAge, isAging } from "@/lib/format";
import {
  BUILDINGS,
  EQUIPMENT_UNITS,
  equipmentUnitLabel,
  MAINTENANCE_REQUESTS,
  REQUEST_NEXT_ACTION,
  roomLabel,
} from "@/lib/mock-data";
import { canAdvanceRequest, isBuildingLocked } from "@/lib/permissions";
import type {
  MaintenanceRequest,
  RequestPriority,
  RequestStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: { status: RequestStatus; label: string; tone: Tone }[] = [
  { status: "pending", label: "Pending", tone: "warning" },
  { status: "in-progress", label: "In Progress", tone: "info" },
  { status: "resolved", label: "Resolved", tone: "success" },
  { status: "completed", label: "Completed", tone: "neutral" },
];

const PRIORITY_TONE: Record<RequestPriority, Tone> = {
  high: "danger",
  normal: "neutral",
};
const STATUS_TONE: Record<RequestStatus, Tone> = {
  pending: "warning",
  "in-progress": "info",
  resolved: "success",
  completed: "neutral",
};
const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "PENDING",
  "in-progress": "IN PROGRESS",
  resolved: "RESOLVED",
  completed: "COMPLETED",
};

function equipmentLabel(equipmentId: string) {
  const unit = EQUIPMENT_UNITS.find((u) => u.id === equipmentId);
  return unit ? equipmentUnitLabel(unit) : equipmentId;
}

export default function RequestsPage() {
  const { role, activeBuildingId, requestStatus, moveRequest } = useAppState();
  const staff = !canAdvanceRequest(role);
  const locked = isBuildingLocked(role);

  const [view, setView] = React.useState<"kanban" | "table">("kanban");
  const [query, setQuery] = React.useState("");
  const [buildingFilter, setBuildingFilter] = React.useState(
    locked ? activeBuildingId : "all",
  );
  const [sort, setSort] = React.useState<"time" | "priority">("time");
  const [collapsedDone, setCollapsedDone] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [extra, setExtra] = React.useState<MaintenanceRequest[]>([]);

  const effectiveBuilding = locked ? activeBuildingId : buildingFilter;

  const all = [...extra, ...MAINTENANCE_REQUESTS];
  const filtered = all.filter((r) => {
    if (effectiveBuilding !== "all" && r.buildingId !== effectiveBuilding)
      return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${r.id} ${r.issue} ${roomLabel(r.roomId)} ${equipmentLabel(r.equipmentId)} ${r.submittedByName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "priority") {
      if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    }
    return (
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );
  });

  const total = filtered.length;
  const highCount = filtered.filter((r) => r.priority === "high").length;
  const agingCount = filtered.filter((r) =>
    isAging(r.submittedAt, r.priority),
  ).length;

  const handleAdvance = (r: MaintenanceRequest) => {
    moveRequest(r.id, "next");
    toast.success(`${r.id} → ${REQUEST_NEXT_ACTION[requestStatus(r)]}`, {
      description: r.issue,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex-row flex-wrap items-center gap-2 p-2.5">
        <div className="border-input focus-within:border-primary relative min-w-32 flex-1 rounded-md border">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests"
            className="w-full bg-transparent py-1.5 pr-7 pl-8 text-[12px] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </button>
          )}
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
          value={sort}
          onValueChange={(v) => v && setSort(v as typeof sort)}
        >
          <SelectTrigger size="sm" className="text-[12px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="time">Time open</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>

        <div className="bg-border h-5.5 w-px" />

        <ToneBadge tone="info" title="All requests in scope">
          {total} total
        </ToneBadge>
        <ToneBadge tone="warning" title="High priority">
          {highCount} high
        </ToneBadge>
        <ToneBadge
          tone="danger"
          title="Aging — high priority unresolved past 24h"
        >
          {agingCount} aging
        </ToneBadge>

        <div className="bg-border h-5.5 w-px" />

        <div className="bg-secondary flex items-center gap-1 rounded-md p-[3px]">
          <button
            type="button"
            title="Board view"
            onClick={() => setView("kanban")}
            className={cn(
              "rounded p-1.5",
              view === "kanban"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60",
            )}
          >
            <Kanban className="size-3.5" />
          </button>
          <button
            type="button"
            title="Table view"
            onClick={() => setView("table")}
            className={cn(
              "rounded p-1.5",
              view === "table"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60",
            )}
          >
            <TableIcon className="size-3.5" />
          </button>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="border-primary text-info-foreground"
          onClick={() => setNewOpen(true)}
        >
          New request
        </Button>
      </Card>

      {view === "kanban" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = sorted.filter((r) => requestStatus(r) === col.status);
            const isDone = col.status === "completed";
            if (isDone && collapsedDone) {
              return (
                <button
                  type="button"
                  key={col.status}
                  onClick={() => setCollapsedDone(false)}
                  title="Expand completed requests"
                  className="bg-muted hover:bg-surface-hover border-border flex min-h-85 flex-col items-center gap-2.5 rounded-md border pt-3 pb-3.5"
                  style={{
                    borderTop: `2px solid var(--color-neutral-foreground)`,
                  }}
                >
                  <span className="bg-card flex size-5.5 items-center justify-center rounded font-mono text-[13px]">
                    »
                  </span>
                  <span className="bg-card rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
                    {items.length}
                  </span>
                  <span className="text-muted-foreground mt-1 [writing-mode:vertical-rl] text-[11.5px] font-semibold tracking-wide">
                    {col.label}
                  </span>
                </button>
              );
            }
            return (
              <div
                key={col.status}
                className="bg-muted border-border flex flex-col rounded-md border"
              >
                <div
                  className="bg-card border-border flex items-center gap-2 rounded-t-[5px] border-b px-3 py-2.5"
                  style={{
                    borderTop: `2px solid var(--color-${col.tone === "neutral" ? "neutral-foreground" : col.tone})`,
                  }}
                >
                  <PulseDot tone={col.tone} />
                  <span className="text-[11.5px] font-semibold">
                    {col.label}
                  </span>
                  <span className="bg-secondary rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
                    {items.length}
                  </span>
                  <div className="flex-1" />
                  {isDone && (
                    <button
                      type="button"
                      title="Collapse completed requests"
                      onClick={() => setCollapsedDone(true)}
                      className="text-muted-foreground hover:text-primary text-[10px]"
                    >
                      Collapse
                    </button>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2.5">
                  {items.length === 0 && (
                    <EmptyState>Nothing in this column</EmptyState>
                  )}
                  {items.map((r) => {
                    const aging = isAging(r.submittedAt, r.priority);
                    return (
                      <Card
                        key={r.id}
                        className="border-border gap-1.5 border-l-[3px] p-2.5 shadow-none"
                        style={{
                          borderLeftColor: aging
                            ? "var(--color-danger)"
                            : "var(--color-border)",
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary font-mono text-[10.5px] font-medium">
                            {r.id}
                          </span>
                          <div className="flex-1" />
                          {aging ? (
                            <ToneBadge tone="danger">
                              Aging {formatAge(r.submittedAt)}
                            </ToneBadge>
                          ) : (
                            <span className="text-muted-foreground font-mono text-[10.5px]">
                              {formatAge(r.submittedAt)}
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] font-medium">
                          {r.issue}
                        </div>
                        <div className="text-foreground/70 flex items-center gap-1 text-[11px]">
                          <MapPin className="size-3" /> {roomLabel(r.roomId)}
                        </div>
                        <div className="text-foreground/70 flex items-center gap-1 text-[11px]">
                          <Package className="size-3" />{" "}
                          {equipmentLabel(r.equipmentId)}
                        </div>
                        <div className="border-border flex items-center justify-between border-t pt-1.5">
                          <ToneBadge tone={PRIORITY_TONE[r.priority]}>
                            {r.priority}
                          </ToneBadge>
                          <span className="text-muted-foreground text-[10.5px]">
                            {r.submittedByName}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={staff}
                          onClick={() => handleAdvance(r)}
                          className="mt-1 w-full text-[11px]"
                        >
                          {staff && <Lock className="size-2.5" />}
                          {REQUEST_NEXT_ACTION[col.status]}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="bg-surface-subtle border-border text-muted-foreground flex border-b px-4 py-2 font-mono text-[10px] tracking-wider">
            <span className="w-20">ID</span>
            <span className="w-24">BUILDING</span>
            <span className="w-30">LOCATION</span>
            <span className="w-30">EQUIPMENT</span>
            <span className="flex-1">ISSUE</span>
            <span className="w-18">PRIORITY</span>
            <span className="w-26">STATUS</span>
            <span className="w-14 text-right">AGE</span>
            <span className="w-24 text-right">SUBMITTED BY</span>
            <span className="w-26 text-right">ACTION</span>
          </div>
          {sorted.length === 0 && (
            <EmptyState className="m-4">
              No requests match these filters.
            </EmptyState>
          )}
          {sorted.map((r) => {
            const status = requestStatus(r);
            const aging = isAging(r.submittedAt, r.priority);
            return (
              <div
                key={r.id}
                className={cn(
                  "border-border flex items-center border-b border-l-[3px] px-4 py-2.5 text-[12px] last:border-b-0",
                )}
                style={{
                  borderLeftColor: aging
                    ? "var(--color-danger)"
                    : "transparent",
                }}
              >
                <span className="text-primary w-20 font-mono text-[11px] font-medium">
                  {r.id}
                </span>
                <span className="w-24 truncate">
                  {BUILDINGS.find((b) => b.id === r.buildingId)?.name}
                </span>
                <span className="text-foreground/70 w-30 truncate">
                  {roomLabel(r.roomId)}
                </span>
                <span className="text-foreground/70 w-30 truncate">
                  {equipmentLabel(r.equipmentId)}
                </span>
                <span className="flex-1 truncate pr-3" title={r.issue}>
                  {r.issue}
                </span>
                <span className="w-18">
                  <ToneBadge tone={PRIORITY_TONE[r.priority]}>
                    {r.priority}
                  </ToneBadge>
                </span>
                <span className="w-26">
                  <ToneBadge tone={STATUS_TONE[status]}>
                    {STATUS_LABEL[status]}
                  </ToneBadge>
                </span>
                <span
                  className={cn(
                    "w-14 text-right font-mono text-[11px] font-medium",
                    aging ? "text-danger-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatAge(r.submittedAt)}
                </span>
                <span className="text-foreground/70 w-24 truncate text-right text-[11.5px]">
                  {r.submittedByName}
                </span>
                <span className="flex w-26 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={staff}
                    onClick={() => handleAdvance(r)}
                    className="text-[11px]"
                  >
                    {staff && <Lock className="size-2.5" />}
                    {REQUEST_NEXT_ACTION[status]}
                  </Button>
                </span>
              </div>
            );
          })}
          {sorted.length > 0 && (
            <div className="text-muted-foreground flex items-center justify-between px-4 py-2.5 text-[11.5px]">
              <span>
                {total} requests · {agingCount} aging past 24h
              </span>
              <button
                type="button"
                onClick={() =>
                  toast.info("Exported filtered set to CSV (demo only).")
                }
                className="text-primary cursor-pointer"
              >
                Export filtered set to CSV
              </button>
            </div>
          )}
        </Card>
      )}

      <NewRequestSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultBuildingId={locked ? activeBuildingId : undefined}
        onCreate={(r) => {
          setExtra((prev) => [r, ...prev]);
          toast.success(`${r.id} created`, {
            description: "Visible in this session only.",
          });
        }}
      />
    </div>
  );
}

function NewRequestSheet({
  open,
  onOpenChange,
  defaultBuildingId,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBuildingId?: string;
  onCreate: (r: MaintenanceRequest) => void;
}) {
  const [buildingId, setBuildingId] = React.useState(
    defaultBuildingId ?? BUILDINGS[0].id,
  );
  const [equipmentId, setEquipmentId] = React.useState("");
  const [issue, setIssue] = React.useState("");
  const [priority, setPriority] = React.useState<RequestPriority>("normal");
  const { currentUser } = useAppState();

  const roomOptions = EQUIPMENT_UNITS.filter(
    (u) => u.buildingId === buildingId,
  );

  const submit = () => {
    if (!issue.trim() || !equipmentId) return;
    const unit = EQUIPMENT_UNITS.find((u) => u.id === equipmentId);
    if (!unit) return;
    const now = new Date().toISOString();
    onCreate({
      id: `REQ-${Math.floor(4000 + Math.random() * 900)}`,
      buildingId,
      roomId: unit.roomId,
      equipmentId,
      issue: issue.trim(),
      priority,
      status: "pending",
      submittedBy: currentUser.uid,
      submittedByName: currentUser.name,
      submittedAt: now,
      updatedAt: now,
    });
    setIssue("");
    setEquipmentId("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-105">
        <SheetHeader>
          <SheetTitle className="font-mono text-[11px] tracking-wider uppercase">
            New request
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3.5 px-4">
          <Field label="Building">
            <Select
              value={buildingId}
              onValueChange={(v) => {
                if (v) {
                  setBuildingId(v);
                  setEquipmentId("");
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
          </Field>
          <Field label="Equipment">
            <Select
              value={equipmentId}
              onValueChange={(v) => setEquipmentId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.tag} · {equipmentUnitLabel(u)} · {roomLabel(u.roomId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Issue">
            <Textarea
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Describe the fault"
              className="min-h-20"
            />
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              onValueChange={(v) => v && setPriority(v as RequestPriority)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <SheetFooter className="flex-row">
          <Button
            onClick={submit}
            className="flex-1"
            disabled={!issue.trim() || !equipmentId}
          >
            Submit request
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
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
