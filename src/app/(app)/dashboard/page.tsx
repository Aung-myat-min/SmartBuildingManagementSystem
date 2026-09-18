"use client";

import { Bell, Lock } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PulseDot } from "@/components/shared/pulse-dot";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLiveClock } from "@/hooks/use-live-clock";
import { useAppState } from "@/lib/app-state";
import {
  countEscalated,
  countOpenRequests,
  equipmentBreakdown,
  isEscalated,
  isRequestOpen,
} from "@/lib/derive";
import { formatAge, formatTime } from "@/lib/format";
import {
  ATTENTION_ITEMS,
  buildingName,
  buildingStats,
  EQUIPMENT_UNITS,
  powerSeries,
  roomLabel,
  roomsForBuilding,
  sensorType,
  statusDef,
} from "@/lib/mock-data";
import { canAct } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<string, Tone> = {
  high: "danger",
  normal: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  requested: "REQUESTED",
  approved: "APPROVED",
  "in-progress": "IN PROGRESS",
  resolved: "RESOLVED",
  completed: "COMPLETED",
};
const STATUS_TONE: Record<string, Tone> = {
  requested: "warning",
  approved: "info",
  "in-progress": "info",
  resolved: "success",
  completed: "neutral",
};

export default function DashboardPage() {
  const {
    buildings,
    role,
    activeBuildingId,
    setActiveBuildingId,
    sensors,
    scopedRequests,
    moveRequest,
    logBook,
    equipmentCondition,
  } = useAppState();
  const clock = useLiveClock();
  const staff = !canAct(role);
  const visibleBuildings = staff
    ? buildings.filter((b) => b.id === activeBuildingId)
    : buildings;
  const rooms = roomsForBuilding(activeBuildingId);

  // Counted off the register, so marking a unit faulty moves this tile. There
  // used to be a separate table of these numbers, authored independently of
  // the units and drifted from them.
  const eq = equipmentBreakdown(
    EQUIPMENT_UNITS.filter((u) => u.buildingId === activeBuildingId).map(
      (u) => ({ condition: equipmentCondition(u.id, u.condition) }),
    ),
  );
  const eqRunning = eq.running;
  const eqMaint = eq.underMaintenance;
  const eqFaulty = eq.faulty;
  const eqTotal = Math.max(1, eq.total);

  const bars = powerSeries(activeBuildingId);
  const maxBar = Math.max(...bars);
  const kwNow = bars[bars.length - 1];
  const kwhToday =
    Math.round(bars.reduce((a, b) => a + b, 0) / bars.length) * 24;

  // Derived from real sensor state rather than a scripted timer: whatever is
  // in an alarm status right now, in the building being looked at.
  const alarming = sensors.filter(
    (s) =>
      s.buildingId === activeBuildingId &&
      (statusDef(s.typeId, s.status)?.isAlarm ?? false),
  );
  const alarm = alarming[0];
  const buildingAlarm = alarming.length > 0;
  const alarmAge = alarm
    ? formatAge(alarm.statusChangedAt ?? alarm.updatedAt)
    : "";

  const openRequests = scopedRequests.filter((r) => isRequestOpen(r.status));
  const decisionQueue = [...openRequests]
    .sort((a, b) => {
      const aging = Number(isEscalated(b)) - Number(isEscalated(a));
      if (aging !== 0) return aging;
      return (
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );
    })
    .slice(0, 4);
  const escalatedCount = countEscalated(scopedRequests);

  const attentionItems = ATTENTION_ITEMS.filter(
    (a) => !staff || a.buildingId === activeBuildingId,
  );
  const feed = logBook
    .filter((e) => !staff || e.buildingId === activeBuildingId)
    .slice(0, 7);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1fr_308px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* Building header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              {!staff && (
                <select
                  value={activeBuildingId}
                  onChange={(e) => setActiveBuildingId(e.target.value)}
                  className="border-border bg-card text-foreground rounded-md border px-2 py-1 text-[19px] font-semibold"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="text-muted-foreground mt-1 text-[12px]">
              {rooms.length} rooms monitored · last poll {clock ?? "—"}
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5",
              buildingAlarm ? "bg-danger-muted" : "bg-success-muted",
            )}
          >
            <PulseDot tone={buildingAlarm ? "danger" : "success"} pulse />
            <span
              className={cn(
                "font-mono text-[11px] font-medium tracking-wider",
                buildingAlarm
                  ? "text-danger-foreground"
                  : "text-success-foreground",
              )}
            >
              {buildingAlarm ? `ALARM · ${alarmAge}` : "ALL NORMAL"}
            </span>
          </div>
        </div>

        {/* Equipment status + Power */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-mono text-[10.5px] tracking-wider">
                EQUIPMENT STATUS
              </span>
              <Link
                href="/equipment"
                className="text-primary text-[11px] font-medium hover:underline"
              >
                Open register
              </Link>
            </div>
            <div className="flex gap-5">
              <Stat
                value={eqRunning}
                label="Running"
                className="text-success"
              />
              <Stat
                value={eqMaint}
                label="Under maint."
                className="text-warning"
              />
              <Stat value={eqFaulty} label="Faulty" className="text-danger" />
              <Stat
                value={eqRunning + eqMaint + eqFaulty}
                label="Total units"
                className="text-muted-foreground ml-auto text-right"
              />
            </div>
            <div className="bg-muted flex h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-success h-full"
                style={{ width: `${(eqRunning / eqTotal) * 100}%` }}
              />
              <div
                className="bg-warning h-full"
                style={{ width: `${(eqMaint / eqTotal) * 100}%` }}
              />
              <div
                className="bg-danger h-full"
                style={{ width: `${(eqFaulty / eqTotal) * 100}%` }}
              />
            </div>
          </Card>

          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-mono text-[10.5px] tracking-wider">
                POWER CONSUMPTION
              </span>
              <span className="text-success-foreground flex items-center gap-1 font-mono text-[9.5px]">
                <PulseDot tone="success" pulse /> LIVE
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[34px] leading-none font-semibold tracking-tight">
                {kwNow}
              </span>
              <span className="text-muted-foreground text-[13px]">
                kW demand
              </span>
            </div>
            <div className="flex h-8.5 items-end gap-[3px]">
              {bars.map((v, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length hourly series, no natural id
                  key={i}
                  className="bg-primary/70 flex-1 rounded-[1px]"
                  style={{ height: `${Math.max(6, (v / maxBar) * 100)}%` }}
                />
              ))}
            </div>
            <div className="border-border text-muted-foreground flex justify-between border-t pt-2.5 text-[11px]">
              <span>Last 24h</span>
              <span className="text-foreground font-mono font-medium">
                {kwhToday.toLocaleString()} kWh today
              </span>
            </div>
          </Card>
        </div>

        {/* Estate overview */}
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-border flex items-center border-b px-4 py-3">
            <span className="text-[13px] font-semibold">Estate overview</span>
            <div className="flex-1" />
            <span className="text-muted-foreground text-[11px]">
              {visibleBuildings.length} of {buildings.length} sites shown
            </span>
          </div>
          <div className="bg-surface-subtle border-border text-muted-foreground flex border-b px-4 py-2 font-mono text-[10px] tracking-wider">
            <span className="flex-1">BUILDING</span>
            <span className="w-21">STATUS</span>
            <span className="w-16 text-right">FAULTY</span>
            <span className="w-17 text-right">MAINT.</span>
            <span className="w-19 text-right">OPEN REQ</span>
            <span className="w-18 text-right">LOAD</span>
          </div>
          {visibleBuildings.map((b) => {
            const stats = buildingStats(b.id);
            const tone: Tone =
              stats.faulty > 0
                ? "danger"
                : stats.maint > 0
                  ? "warning"
                  : "success";
            const label =
              stats.faulty > 0
                ? "Attention"
                : stats.maint > 0
                  ? "In service"
                  : "Normal";
            return (
              <div
                key={b.id}
                className="border-border flex items-center border-b px-4 py-3 last:border-b-0"
              >
                <span className="flex flex-1 items-center gap-2">
                  <PulseDot tone={tone} />
                  <span className="text-[12.5px] font-medium">{b.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {stats.roomCount} rooms
                  </span>
                </span>
                <span
                  className={cn(
                    "w-21 text-[11.5px]",
                    tone === "danger" && "text-danger-foreground",
                    tone === "warning" && "text-warning-foreground",
                    tone === "success" && "text-success-foreground",
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "w-16 text-right font-mono text-[12px] font-medium",
                    stats.faulty > 0
                      ? "text-danger-foreground"
                      : "text-foreground/70",
                  )}
                >
                  {stats.faulty}
                </span>
                <span className="text-foreground/70 w-17 text-right font-mono text-[12px] font-medium">
                  {stats.maint}
                </span>
                <span className="text-foreground/70 w-19 text-right font-mono text-[12px] font-medium">
                  {countOpenRequests(scopedRequests, b.id)}
                </span>
                <span className="text-foreground/70 w-18 text-right font-mono text-[12px] font-medium">
                  {stats.kw} kW
                </span>
              </div>
            );
          })}
        </Card>

        {/* Requests needing a decision */}
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-border flex items-center border-b px-4 py-3">
            <span className="text-[13px] font-semibold">
              Requests needing a decision
            </span>
            <div className="flex-1" />
            {escalatedCount > 0 && (
              <ToneBadge tone="danger">{escalatedCount} escalated</ToneBadge>
            )}
          </div>
          {decisionQueue.length === 0 && (
            <EmptyState className="m-4">
              Nothing needs a decision right now.
            </EmptyState>
          )}
          {decisionQueue.map((r) => {
            const status = r.status;
            const aging = isEscalated(r);
            return (
              <div
                key={r.id}
                className={cn(
                  "border-border flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0",
                  aging && "bg-danger-muted/40",
                )}
              >
                <span className="text-primary w-16.5 shrink-0 font-mono text-[11px] font-medium">
                  {r.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-[450]">
                    {r.issue}
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate text-[11px]">
                    {r.roomId.includes("216")
                      ? "216"
                      : r.roomId.includes("209")
                        ? "209"
                        : "JSQ"}{" "}
                    · {r.submittedByName}
                  </div>
                </div>
                <ToneBadge
                  tone={PRIORITY_TONE[r.priority]}
                  className="w-14 justify-center"
                >
                  {r.priority}
                </ToneBadge>
                <ToneBadge
                  tone={STATUS_TONE[status]}
                  className="w-22 justify-center"
                >
                  {STATUS_LABEL[status]}
                </ToneBadge>
                <span
                  className={cn(
                    "w-12 text-right font-mono text-[11px] font-medium",
                    aging ? "text-danger-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatAge(r.submittedAt)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={staff}
                  onClick={() => moveRequest(r.id, "next")}
                  className="w-28 shrink-0 text-[11px]"
                >
                  {staff && <Lock className="size-2.5" />}
                  Advance
                </Button>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Right rail */}
      <aside className="flex flex-col gap-4">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-border flex items-center gap-2 border-b px-4 py-3">
            <Bell className="size-3.5" />
            <span className="text-[12.5px] font-semibold">Live alerts</span>
            <ToneBadge
              tone={buildingAlarm ? "danger" : "neutral"}
              className="ml-auto"
            >
              {(buildingAlarm ? 1 : 0) + attentionItems.length}
            </ToneBadge>
          </div>
          <div className="border-border flex flex-col gap-2.5 border-b p-3">
            {alarm && (
              <div className="border-danger bg-danger-muted rounded-md border border-l-3 p-3">
                <div className="flex items-center gap-1.5">
                  <PulseDot tone="danger" pulse />
                  <span className="text-danger-foreground font-mono text-[9.5px] font-medium tracking-wider">
                    FIRE
                  </span>
                  <span className="flex-1" />
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {alarmAge}
                  </span>
                </div>
                <div className="mt-1.5 text-[12.5px] font-medium">
                  {sensorType(alarm.typeId)?.label ?? "Sensor"} triggered
                </div>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
                  {buildingName(alarm.buildingId)} / {roomLabel(alarm.roomId)} ·{" "}
                  {alarm.id}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={staff}
                  nativeButton={staff}
                  render={staff ? undefined : <Link href="/sensors" />}
                  className="border-danger text-danger-foreground mt-2 w-full text-[11px]"
                >
                  {staff && <Lock className="size-2.5" />}
                  Acknowledge
                </Button>
              </div>
            )}
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="border-border rounded-md border p-3"
              >
                <div className="flex items-center gap-1.5">
                  <PulseDot
                    tone={
                      item.sev === "faulty"
                        ? "danger"
                        : item.sev === "offline"
                          ? "neutral"
                          : "warning"
                    }
                  />
                  <span className="text-muted-foreground font-mono text-[9.5px] tracking-wider uppercase">
                    {item.sev}
                  </span>
                  <span className="flex-1" />
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {item.since}
                  </span>
                </div>
                <div className="mt-1.5 text-[12.5px] font-medium">
                  {item.detail}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
                  {item.location}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={staff}
                  className="mt-2 w-full text-[11px]"
                >
                  {staff && <Lock className="size-2.5" />}
                  {item.action}
                </Button>
              </div>
            ))}
          </div>
          <div className="px-4 pt-3 pb-1">
            <span className="text-muted-foreground font-mono text-[11px] tracking-wider">
              LOG BOOK — LIVE
            </span>
          </div>
          <div className="flex flex-col px-4 pb-3.5">
            {feed.map((f) => (
              <div
                key={f.id}
                className="border-border flex gap-2.5 border-b py-2 last:border-b-0"
              >
                <span className="text-muted-foreground w-11 shrink-0 font-mono text-[10.5px]">
                  {formatTime(f.timestamp)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] leading-snug">{f.title}</div>
                  <div className="text-muted-foreground mt-0.5 text-[10.5px]">
                    {f.actorName}
                  </div>
                </div>
              </div>
            ))}
            <Link
              href="/logbook"
              className="text-primary mt-2.5 text-[11px] hover:underline"
            >
              Open Log Book →
            </Link>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Stat({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="font-mono text-[27px] leading-none font-semibold">
        {value}
      </div>
      <div className="text-muted-foreground mt-1 text-[11px]">{label}</div>
    </div>
  );
}
