import { describe, expect, it } from "vitest";
import {
  ESCALATION_WINDOW_HOURS,
  isEscalated,
  isRequestOpen,
  isSensorOffline,
  kpiPasses,
  statusTone,
} from "./derive";
import type { MaintenanceRequest, ReportKpi } from "./types";

const NOW = new Date("2026-09-18T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const request = (over: Partial<MaintenanceRequest> = {}): MaintenanceRequest =>
  ({
    id: "REQ-1",
    buildingId: "b216",
    roomId: "r-216-302",
    equipmentId: "EQ-216-01",
    issue: "x",
    priority: "high",
    status: "requested",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: hoursAgo(ESCALATION_WINDOW_HOURS + 1),
    updatedAt: hoursAgo(1),
    ...over,
  }) as MaintenanceRequest;

describe("isRequestOpen", () => {
  // "Requested" counts as open: nobody has looked at it yet, which is the
  // worst kind of outstanding.
  it("counts everything before resolution", () => {
    expect(isRequestOpen("requested")).toBe(true);
    expect(isRequestOpen("approved")).toBe(true);
    expect(isRequestOpen("in-progress")).toBe(true);
  });

  it("stops counting once the work is done", () => {
    expect(isRequestOpen("resolved")).toBe(false);
    expect(isRequestOpen("completed")).toBe(false);
  });
});

describe("isEscalated", () => {
  it("needs all three of high, open and past the window", () => {
    expect(isEscalated(request(), "requested", NOW)).toBe(true);
  });

  it("ignores a normal-priority request however old", () => {
    expect(isEscalated(request({ priority: "normal" }), "requested", NOW)).toBe(
      false,
    );
  });

  it("ignores one inside the window", () => {
    const fresh = request({
      submittedAt: hoursAgo(ESCALATION_WINDOW_HOURS - 1),
    });
    expect(isEscalated(fresh, "requested", NOW)).toBe(false);
  });

  it("ignores one that is already resolved", () => {
    expect(isEscalated(request(), "resolved", NOW)).toBe(false);
  });

  it("reads the live status, not the stored one", () => {
    // The request was raised as "requested"; the caller passes what it has
    // become in this session.
    expect(isEscalated(request(), "completed", NOW)).toBe(false);
  });
});

describe("statusTone", () => {
  const plain = { tone: "success" as const };
  const escalating = {
    tone: "info" as const,
    escalateAfterMinutes: 30,
    escalateTone: "warning" as const,
  };

  it("leaves a status without a threshold alone", () => {
    expect(statusTone(plain, hoursAgo(99), NOW)).toBe("success");
  });

  it("holds the resting tone inside the window", () => {
    const since = new Date(NOW - 10 * 60_000).toISOString();
    expect(statusTone(escalating, since, NOW)).toBe("info");
  });

  it("switches once the state has persisted", () => {
    const since = new Date(NOW - 31 * 60_000).toISOString();
    expect(statusTone(escalating, since, NOW)).toBe("warning");
  });

  it("switches exactly on the threshold", () => {
    const since = new Date(NOW - 30 * 60_000).toISOString();
    expect(statusTone(escalating, since, NOW)).toBe("warning");
  });
});

describe("isSensorOffline", () => {
  it("knows the one status id the pages still name", () => {
    expect(isSensorOffline("offline")).toBe(true);
    expect(isSensorOffline("triggered")).toBe(false);
  });
});

describe("kpiPasses", () => {
  const kpi = (over: Partial<ReportKpi>): ReportKpi =>
    ({
      label: "x",
      value: 0,
      unit: "%",
      target: 90,
      compare: "gte",
      targetLabel: "",
      ...over,
    }) as ReportKpi;

  it("passes a gte KPI on the boundary", () => {
    expect(kpiPasses(kpi({ value: 90 }))).toBe(true);
    expect(kpiPasses(kpi({ value: 89.9 }))).toBe(false);
  });

  it("passes an lte KPI on the boundary", () => {
    expect(kpiPasses(kpi({ value: 90, compare: "lte" }))).toBe(true);
    expect(kpiPasses(kpi({ value: 91, compare: "lte" }))).toBe(false);
  });

  it("is strict for lt", () => {
    expect(kpiPasses(kpi({ value: 90, compare: "lt" }))).toBe(false);
    expect(kpiPasses(kpi({ value: 89, compare: "lt" }))).toBe(true);
  });
});
