"use client";

import {
  Box,
  CalendarClock,
  CheckCheck,
  Clock,
  CornerUpLeft,
  LayoutGrid,
  Lock,
  MapPin,
  Receipt,
  Search,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormDrawer, FormField } from "@/components/shared/form-drawer";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppState } from "@/lib/app-state";
import {
  ESCALATION_WINDOW_HOURS,
  isEscalated,
  nextSequentialId,
} from "@/lib/derive";
import type { WriteResult } from "@/lib/firestore-store";
import { formatAge, formatMmk, formatStamp } from "@/lib/format";
import {
  buildingName,
  equipmentUnitLabel,
  equipmentUnits,
  REQUEST_NEXT_ACTION,
  REQUEST_NEXT_STATUS,
  REQUEST_PREV_ACTION,
  REQUEST_PREV_STATUS,
  roomLabel,
  roomsForBuilding,
} from "@/lib/mock-data";
import {
  canAdvanceRequest,
  canRequestVerification,
  canWithdrawRequest,
  isBuildingLocked,
  REQUEST_ADVANCE_LOCK_REASON,
} from "@/lib/permissions";
import type {
  AppUser,
  MaintenanceRequest,
  RequestPriority,
  RequestStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// Five columns. "Requested" is the approval queue — things asked for that
// nobody has let in yet — and everything to its right is committed work.
const COLUMNS: { status: RequestStatus; label: string; tone: Tone }[] = [
  { status: "requested", label: "Requested", tone: "warning" },
  { status: "approved", label: "Approved", tone: "info" },
  { status: "in-progress", label: "In progress", tone: "info" },
  { status: "resolved", label: "Resolved", tone: "success" },
  { status: "completed", label: "Completed", tone: "neutral" },
];

const STATUS_TONE: Record<RequestStatus, Tone> = {
  requested: "warning",
  approved: "info",
  "in-progress": "info",
  resolved: "success",
  completed: "neutral",
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  "in-progress": "In progress",
  resolved: "Resolved",
  completed: "Completed",
};

/** What either view can do to a request, gathered once and passed down. */
interface RequestActions {
  mayAdvance: boolean;
  /** The signed-in person, for the two ownership checks. */
  actor: AppUser;
  onMove: (r: MaintenanceRequest, d: "next" | "prev") => void;
  onDecline: (r: MaintenanceRequest) => void;
  onWithdraw: (r: MaintenanceRequest) => void;
  onVerify: (r: MaintenanceRequest) => void;
}

const TONE_DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral-foreground",
};

const TONE_BORDER: Record<Tone, string> = {
  success: "border-t-success",
  warning: "border-t-warning",
  danger: "border-t-danger",
  info: "border-t-info",
  neutral: "border-t-neutral-foreground",
};

function equipmentLabel(equipmentId: string) {
  // Requests name the unit by id, which is also its document id.
  const unit = equipmentUnits().find((u) => u.id === equipmentId);
  return unit ? equipmentUnitLabel(unit) : equipmentId;
}

export default function RequestsPage() {
  const {
    buildings,
    role,
    activeBuildingId,
    scopedRequests,
    moveRequest,
    declineRequest,
    withdrawRequest,
    requestVerification,
    requestIds,
    addRequest,
    currentUser,
  } = useAppState();
  const confirm = useConfirm();

  const locked = isBuildingLocked(role);
  const mayAdvance = canAdvanceRequest(role);

  const [view, setView] = usePersistedState<"board" | "table">(
    "requests.view",
    "board",
  );
  const [query, setQuery] = React.useState("");
  const [buildingFilter, setBuildingFilter] = React.useState("all");
  const [sort, setSort] = usePersistedState<"time" | "priority">(
    "requests.sort",
    "time",
  );
  const [doneCollapsed, setDoneCollapsed] = usePersistedState(
    "requests.doneCollapsed",
    false,
  );
  const [newOpen, setNewOpen] = React.useState(false);

  const effectiveBuilding = locked ? activeBuildingId : buildingFilter;

  const filtered = scopedRequests
    .filter((r) => {
      if (effectiveBuilding !== "all" && r.buildingId !== effectiveBuilding)
        return false;
      if (query.trim().length === 0) return true;
      const q = query.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.issue.toLowerCase().includes(q) ||
        roomLabel(r.roomId).toLowerCase().includes(q) ||
        r.submittedByName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sort === "priority") {
        if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
      }
      return (
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );
    });

  const highCount = filtered.filter((r) => r.priority === "high").length;
  const agingCount = filtered.filter((r) => isEscalated(r)).length;

  const move = async (r: MaintenanceRequest, direction: "next" | "prev") => {
    const target =
      direction === "next"
        ? REQUEST_NEXT_STATUS[r.status]
        : REQUEST_PREV_STATUS[r.status];
    if (!target) return;

    // Going backwards always asks: work gets marked done too early, and the
    // age never resets, so stepping back is visible rather than quiet.
    if (direction === "prev") {
      const result = await confirm({
        title: `Move ${r.id} back to ${STATUS_LABEL[target]}?`,
        body: `${r.issue}`,
        note: `Its age stays at ${formatAge(r.submittedAt)} — stepping back does not restart the clock.`,
        tone: "warning",
        confirmLabel: REQUEST_PREV_ACTION[r.status] ?? "Move back",
      });
      if (!result.confirmed) return;
    }

    // Resolving is the only forward step that asks anything. It is also the
    // only moment anyone knows what the work cost.
    let extra: { costMmk?: number } | undefined;
    if (target === "resolved") {
      const result = await confirm({
        title: `Mark ${r.id} resolved?`,
        body: r.issue,
        note: "Recorded against this request and counted in the cost report. Leave it at No cost if nothing was spent.",
        tone: "info",
        confirmLabel: "Mark resolved",
        requireCost: true,
      });
      if (!result.confirmed) return;
      extra = { costMmk: result.costMmk };
    }

    const written = await moveRequest(r.id, direction, extra);
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    toast.success(`${r.id} → ${STATUS_LABEL[target]}`);
  };

  // Declining is not a move. The request holds its place in the queue and
  // picks up a reason, so its submitter can see what was wrong with it.
  const decline = async (r: MaintenanceRequest) => {
    const result = await confirm({
      title: `Send ${r.id} back?`,
      body: r.issue,
      note: `It stays in Requested and starts no work. ${r.submittedByName} sees your reason and can withdraw it and raise a corrected one.`,
      tone: "warning",
      confirmLabel: "Send back",
      requireReason: true,
      reasonPlaceholder: "What needs to change before this can be approved?",
    });
    if (!result.confirmed || !result.reason) return;
    const written = await declineRequest(r.id, result.reason);
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    toast.success(`${r.id} sent back to ${r.submittedByName}`);
  };

  const withdraw = async (r: MaintenanceRequest) => {
    const result = await confirm({
      title: `Withdraw ${r.id}?`,
      body: r.issue,
      note: "It was never approved, so no work was scheduled against it. It leaves the board and every count.",
      tone: "danger",
      confirmLabel: "Withdraw request",
    });
    if (!result.confirmed) return;
    const written = await withdrawRequest(r.id);
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    toast.success(`${r.id} withdrawn`);
  };

  const verify = async (r: MaintenanceRequest) => {
    const written = await requestVerification(r.id);
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    toast.success(`${r.id} — close-out requested`);
  };

  const actions: RequestActions = {
    mayAdvance,
    actor: currentUser,
    onMove: move,
    onDecline: decline,
    onWithdraw: withdraw,
    onVerify: verify,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
        <div className="border-input focus-within:border-primary bg-card flex min-w-45 flex-1 items-center gap-1.5 rounded border px-2">
          <Search className="text-muted-foreground size-3.25 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search id, issue, room or person"
            className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none"
          />
          {query && (
            <button
              type="button"
              title="Clear search"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground cursor-pointer px-0.5 text-[15px] leading-none"
            >
              ×
            </button>
          )}
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
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          title="High priority first, or oldest first"
          onChange={(e) => setSort(e.target.value as "time" | "priority")}
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          <option value="time">Time open</option>
          <option value="priority">Priority</option>
        </select>

        <span className="bg-divider h-5.5 w-px shrink-0" />

        <span
          title="All requests in scope"
          className="bg-primary shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium text-white"
        >
          {filtered.length}
        </span>
        <span
          title="High priority"
          className="bg-warning-muted text-warning-foreground shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium"
        >
          !{highCount}
        </span>
        <span
          title={`Aging — high priority unresolved past ${ESCALATION_WINDOW_HOURS}h`}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium",
            agingCount > 0
              ? "bg-danger-muted text-danger-foreground"
              : "bg-neutral-muted text-neutral-foreground",
          )}
        >
          <Clock className="size-3" />
          {agingCount}
        </span>

        <div className="bg-secondary border-border flex shrink-0 items-center gap-1 rounded-[5px] border p-[3px]">
          <button
            type="button"
            title="Board view"
            onClick={() => setView("board")}
            className={cn(
              "cursor-pointer rounded-[3px] px-2.5 py-1.75",
              view === "board"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70",
            )}
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            type="button"
            title="Table view"
            onClick={() => setView("table")}
            className={cn(
              "cursor-pointer rounded-[3px] px-2.5 py-1.75",
              view === "table"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70",
            )}
          >
            <TableIcon className="size-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer rounded border px-3 py-2 text-[11.5px] leading-none font-medium"
        >
          New request
        </button>
      </div>

      {view === "board" ? (
        <div
          className="grid items-start gap-3"
          style={{
            // Completed collapses sideways to a rail rather than disappearing,
            // so the board keeps its width for active work.
            gridTemplateColumns: doneCollapsed
              ? "repeat(4, minmax(0,1fr)) 46px"
              : "repeat(5, minmax(0,1fr))",
          }}
        >
          {COLUMNS.map((col) => {
            const cards = filtered.filter((r) => r.status === col.status);
            const collapsible = col.status === "completed";

            if (collapsible && doneCollapsed) {
              return (
                <button
                  type="button"
                  key={col.status}
                  title="Expand completed requests"
                  onClick={() => setDoneCollapsed(false)}
                  className={cn(
                    "bg-neutral-muted hover:bg-neutral-muted/70 border-border flex min-h-85 cursor-pointer flex-col items-center gap-2.75 rounded-[5px] border border-t-2 px-0 pt-2.75 pb-3.5",
                    TONE_BORDER[col.tone],
                  )}
                >
                  <span className="border-input text-neutral-foreground bg-card flex size-5.5 items-center justify-center rounded-[3px] border font-mono text-[13px] leading-none font-medium">
                    ‹
                  </span>
                  <span className="text-neutral-foreground border-border bg-card rounded-[3px] border px-1.5 py-1 font-mono text-[10.5px] leading-none font-semibold">
                    {cards.length}
                  </span>
                  <span
                    className={cn(
                      "size-1.75 shrink-0 rounded-full",
                      TONE_DOT[col.tone],
                    )}
                  />
                  <span className="text-neutral-foreground text-[11.5px] font-semibold tracking-[0.03em] [writing-mode:vertical-rl]">
                    {col.label}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={col.status}
                className={cn(
                  "border-border bg-card overflow-hidden rounded-[5px] border border-t-2",
                  TONE_BORDER[col.tone],
                )}
              >
                <div className="border-divider flex items-center gap-2 border-b px-3 py-2.5">
                  <span
                    className={cn(
                      "size-1.75 shrink-0 rounded-full",
                      TONE_DOT[col.tone],
                    )}
                  />
                  <span className="flex-1 text-[11px] leading-none font-semibold">
                    {col.label}
                  </span>
                  <ToneBadge tone={col.tone}>{cards.length}</ToneBadge>
                  {collapsible && (
                    <button
                      type="button"
                      title="Collapse completed requests"
                      onClick={() => setDoneCollapsed(true)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer px-0.5 font-mono text-[13px] leading-none"
                    >
                      ›
                    </button>
                  )}
                </div>

                <div className="flex min-h-30 flex-col gap-2 p-2.5">
                  {cards.map((r) => (
                    <RequestCard key={r.id} request={r} actions={actions} />
                  ))}
                  {cards.length === 0 && (
                    <div className="text-muted-foreground px-0.5 py-2 text-[11px]">
                      Nothing in this column
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-[5px] border">
          <div className="bg-surface-subtle border-divider text-muted-foreground flex min-w-300 border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
            <span className="w-22">Id</span>
            <span className="w-28">Building</span>
            <span className="w-28">Location</span>
            <span className="w-36">Equipment</span>
            <span className="flex-1">Issue</span>
            <span className="w-22">Priority</span>
            <span className="w-26">Status</span>
            <span className="w-36">Submitted</span>
            <span className="w-18">Age</span>
            <span className="w-28">Submitted by</span>
            <span className="w-40 text-right">Action</span>
          </div>

          {filtered.map((r) => {
            const aging = isEscalated(r);
            return (
              <div
                key={r.id}
                className={cn(
                  "border-rule flex min-w-300 items-center border-b px-4 py-2.5",
                  aging && "border-l-danger border-l-[3px]",
                )}
              >
                <span className="text-accent-foreground w-22 font-mono text-[11px] font-medium">
                  {r.id}
                </span>
                <span className="text-neutral-foreground w-28 truncate text-[12px]">
                  {buildingName(r.buildingId)}
                </span>
                <span className="text-neutral-foreground w-28 truncate text-[12px]">
                  {roomLabel(r.roomId)}
                </span>
                <span className="text-muted-foreground w-36 truncate text-[11.5px]">
                  {equipmentLabel(r.equipmentId)}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 pr-3">
                  <span
                    title={r.issue}
                    className="min-w-0 truncate text-[12px] font-[450]"
                  >
                    {r.issue}
                  </span>
                  {r.verificationRequested && (
                    <CheckCheck
                      className="text-success size-3 shrink-0"
                      aria-label={`${r.submittedByName} says this looks done`}
                    />
                  )}
                  {r.declineNote && (
                    <CornerUpLeft
                      className="text-warning size-3 shrink-0"
                      aria-label={`Sent back — ${r.declineNote}`}
                    />
                  )}
                </span>
                <span className="w-22">
                  <ToneBadge
                    tone={r.priority === "high" ? "warning" : "neutral"}
                  >
                    {r.priority}
                  </ToneBadge>
                </span>
                <span className="w-26">
                  <ToneBadge tone={STATUS_TONE[r.status]}>
                    {STATUS_LABEL[r.status]}
                  </ToneBadge>
                </span>
                <span className="text-neutral-foreground w-36 font-mono text-[11px]">
                  {formatStamp(r.submittedAt)}
                </span>
                <span
                  title={`Submitted ${formatStamp(r.submittedAt)} · last moved ${formatStamp(r.updatedAt)}`}
                  className={cn(
                    "flex w-18 items-center gap-1 font-mono text-[11px]",
                    aging ? "text-danger-foreground" : "text-muted-foreground",
                  )}
                >
                  {aging && (
                    <Clock
                      className="size-3"
                      aria-label={`Aging — unresolved past ${ESCALATION_WINDOW_HOURS}h`}
                    />
                  )}
                  {formatAge(r.submittedAt)}
                </span>
                <span className="text-muted-foreground w-28 truncate text-[11.5px]">
                  {r.submittedByName}
                </span>
                <span className="flex w-40 justify-end gap-1.5">
                  <MoveButtons request={r} actions={actions} />
                </span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <EmptyState className="m-4">
              No requests match these filters.
            </EmptyState>
          )}
        </div>
      )}

      <NewRequestDrawer
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultBuildingId={locked ? activeBuildingId : buildings[0].id}
        existingIds={requestIds}
        onCreate={addRequest}
        submittedBy={currentUser}
      />
    </div>
  );
}

function MoveButtons({
  request,
  actions,
}: {
  request: MaintenanceRequest;
  actions: RequestActions;
}) {
  const { mayAdvance, actor, onMove, onDecline, onWithdraw, onVerify } =
    actions;
  const nextLabel = REQUEST_NEXT_ACTION[request.status];
  const backLabel = REQUEST_PREV_ACTION[request.status];
  const canBack = Boolean(REQUEST_PREV_STATUS[request.status]) && mayAdvance;
  const mayWithdraw = canWithdrawRequest(request, request.status, actor);
  const mayVerify = canRequestVerification(request, request.status, actor);

  return (
    <>
      {mayWithdraw && (
        <button
          type="button"
          title="Withdraw this request — it has not been approved yet"
          onClick={() => onWithdraw(request)}
          className="border-input bg-card text-neutral-foreground hover:border-danger/40 hover:text-danger-foreground shrink-0 cursor-pointer rounded-[3px] border px-2.25 py-2 text-[11px] leading-none font-medium"
        >
          Withdraw
        </button>
      )}
      {mayVerify && (
        <button
          type="button"
          title="Tell the approver this looks done, so they can close it out"
          onClick={() => onVerify(request)}
          className="border-primary bg-card text-accent-foreground hover:bg-accent/40 flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[3px] border px-2 py-2 text-[11px] leading-none font-medium"
        >
          <CheckCheck className="size-3" />
          Looks done
        </button>
      )}
      {request.status === "requested" && mayAdvance && (
        <button
          type="button"
          title="Send this back with a reason — it stays in the queue"
          onClick={() => onDecline(request)}
          className="border-input bg-card text-neutral-foreground hover:border-warning hover:text-warning-foreground shrink-0 cursor-pointer rounded-[3px] border px-2.25 py-2 text-[11px] leading-none font-medium"
        >
          Send back
        </button>
      )}
      {canBack && (
        <button
          type="button"
          title={backLabel ?? "Move back"}
          onClick={() => onMove(request, "prev")}
          className="border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground shrink-0 cursor-pointer rounded-[3px] border px-2.25 py-2"
        >
          <Undo2 className="size-3" />
        </button>
      )}
      {nextLabel && (
        <button
          type="button"
          disabled={!mayAdvance}
          title={mayAdvance ? nextLabel : REQUEST_ADVANCE_LOCK_REASON}
          onClick={() => onMove(request, "next")}
          className={cn(
            "bg-card flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-[3px] border px-2 py-2 text-[11px] leading-none font-medium",
            mayAdvance
              ? "border-primary text-accent-foreground hover:bg-accent/40"
              : "border-border text-muted-foreground cursor-not-allowed opacity-45",
          )}
        >
          {!mayAdvance && <Lock className="size-2.5" />}
          {nextLabel}
        </button>
      )}
    </>
  );
}

function RequestCard({
  request,
  actions,
}: {
  request: MaintenanceRequest;
  actions: RequestActions;
}) {
  const aging = isEscalated(request);
  return (
    <div
      className={cn(
        "border-divider bg-card rounded border border-l-[3px] px-2.75 py-2.5",
        aging
          ? "border-l-danger"
          : request.priority === "high"
            ? "border-l-warning"
            : "border-l-transparent",
      )}
    >
      <div className="flex items-center gap-1.75">
        <span className="text-accent-foreground font-mono text-[10.5px] font-medium">
          {request.id}
        </span>
        <div className="flex-1" />
        {aging ? (
          // Self-labelling: the red edge plus the tag, so no legend is needed.
          <span
            title={`Submitted ${formatStamp(request.submittedAt)}`}
            className="bg-danger-muted text-danger-foreground flex items-center gap-1 rounded-[3px] px-1.5 py-1 font-mono text-[9.5px] leading-none font-semibold tracking-[0.05em]"
          >
            <Clock className="size-2.75" />
            AGING {formatAge(request.submittedAt)}
          </span>
        ) : (
          <span
            title={`Submitted ${formatStamp(request.submittedAt)}`}
            className="text-muted-foreground font-mono text-[10px]"
          >
            {formatAge(request.submittedAt)}
          </span>
        )}
      </div>

      <div className="mt-1.75 text-[12.5px] leading-snug font-[450] text-pretty">
        {request.issue}
      </div>

      {request.verificationRequested && (
        <div className="bg-success-muted text-success-foreground mt-2 flex items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-[10.5px] leading-snug">
          <CheckCheck className="size-2.75 shrink-0" />
          {request.submittedByName} says this looks done
        </div>
      )}

      {request.declineNote && (
        <div className="bg-warning-muted text-warning-foreground mt-2 flex items-start gap-1.5 rounded-[3px] px-2 py-1.5 text-[10.5px] leading-snug">
          <CornerUpLeft className="mt-0.25 size-2.75 shrink-0" />
          <span>
            <span className="font-medium">Sent back —</span>{" "}
            {request.declineNote}
          </span>
        </div>
      )}

      <div className="text-muted-foreground mt-2 flex flex-col gap-1 text-[10.5px]">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-2.75 shrink-0" />
          {roomLabel(request.roomId)} · {buildingName(request.buildingId)}
        </span>
        <span className="flex items-center gap-1.5">
          <Box className="size-2.75 shrink-0" />
          {equipmentLabel(request.equipmentId)}
        </span>
        <span className="flex items-center gap-1.5 font-mono">
          <CalendarClock className="size-2.75 shrink-0" />
          {formatStamp(request.submittedAt)}
        </span>
        {request.costMmk !== undefined && (
          <span className="flex items-center gap-1.5 font-mono">
            <Receipt className="size-2.75 shrink-0" />
            {request.costMmk === 0 ? "No cost" : formatMmk(request.costMmk)}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <ToneBadge tone={request.priority === "high" ? "warning" : "neutral"}>
          {request.priority}
        </ToneBadge>
        <span className="text-muted-foreground truncate text-[10.5px]">
          {request.submittedByName}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <MoveButtons request={request} actions={actions} />
      </div>
    </div>
  );
}

function NewRequestDrawer({
  open,
  onOpenChange,
  defaultBuildingId,
  submittedBy,
  existingIds,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBuildingId: string;
  /** Every id already in use, so a new one cannot collide with one of them. */
  existingIds: string[];
  submittedBy: { uid: string; name: string };
  onCreate: (request: MaintenanceRequest) => Promise<WriteResult>;
}) {
  const { buildings } = useAppState();
  const [buildingId, setBuildingId] = React.useState(defaultBuildingId);
  const [roomId, setRoomId] = React.useState("");
  const [equipmentId, setEquipmentId] = React.useState("");
  const [issue, setIssue] = React.useState("");
  const [priority, setPriority] = React.useState<RequestPriority>("normal");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setBuildingId(defaultBuildingId);
    setRoomId(roomsForBuilding(defaultBuildingId)[0]?.id ?? "");
    setEquipmentId("");
    setIssue("");
    setPriority("normal");
    setError(null);
  }, [open, defaultBuildingId]);

  const rooms = roomsForBuilding(buildingId);
  const units = equipmentUnits().filter((u) => u.roomId === roomId);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New request"
      description="Raised against a specific unit so the register and the request stay in step."
      submitLabel="Raise request"
      error={error}
      onSubmit={async () => {
        if (issue.trim().length < 8) {
          setError("Describe the fault in a sentence so it can be triaged.");
          return;
        }
        const now = new Date().toISOString();
        const id = nextSequentialId("REQ", existingIds, 4200);
        const written = await onCreate({
          id,
          buildingId,
          roomId,
          equipmentId: equipmentId || units[0]?.id || "—",
          issue: issue.trim(),
          priority,
          status: "requested",
          submittedBy: submittedBy.uid,
          submittedByName: submittedBy.name,
          submittedAt: now,
          updatedAt: now,
        });
        if (!written.ok) {
          setError(written.message);
          return;
        }
        toast.success(`${id} raised`);
        onOpenChange(false);
      }}
    >
      <div className="grid grid-cols-2 gap-2.75">
        <FormField label="Building">
          <select
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setRoomId(roomsForBuilding(e.target.value)[0]?.id ?? "");
              setEquipmentId("");
            }}
            className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Room">
          <select
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setEquipmentId("");
            }}
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

      <FormField label="Equipment">
        <select
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
          className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          {units.length === 0 && (
            <option value="">No units in this room</option>
          )}
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.tag} · {equipmentUnitLabel(u)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Issue">
        <textarea
          rows={4}
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          placeholder="What is wrong, and what have you already tried?"
          className="border-input focus:border-primary w-full resize-y rounded border px-2.5 py-2.25 text-[12px] leading-relaxed outline-none"
        />
      </FormField>

      <FormField
        label="Priority"
        hint={`High priority is flagged as aging once it passes ${ESCALATION_WINDOW_HOURS} hours unresolved.`}
      >
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as RequestPriority)}
          className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </FormField>
    </FormDrawer>
  );
}
