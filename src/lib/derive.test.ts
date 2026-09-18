import { describe, expect, it } from "vitest";
import {
  ESCALATION_WINDOW_HOURS,
  equipmentBreakdown,
  isEscalated,
  isRequestOpen,
  isSensorOffline,
  kpiPasses,
  nextSequentialId,
  openRequestsForUnit,
  statusTone,
} from "./derive";
import type {
  EquipmentCondition,
  MaintenanceRequest,
  ReportKpi,
} from "./types";

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

describe("nextSequentialId", () => {
  // This replaces `prefix + Math.floor(base + Math.random() * 99)`. In memory a
  // collision was invisible; as a document id it silently overwrites a record.
  it("starts at the floor when nothing exists", () => {
    expect(nextSequentialId("REQ", [], 4200)).toBe("REQ-4200");
  });

  it("holds the floor when every id in use is below it", () => {
    // The seeded requests run 4149–4192 and the floor is 4200, so the first
    // id the app mints sits clear of the corpus rather than inside it.
    expect(nextSequentialId("REQ", ["REQ-4192", "REQ-4149"], 4200)).toBe(
      "REQ-4200",
    );
  });

  it("continues from the highest in use once past the floor", () => {
    expect(nextSequentialId("REQ", ["REQ-4200", "REQ-4192"], 4200)).toBe(
      "REQ-4201",
    );
  });

  it("never collides with an id already in use", () => {
    const ids = ["REQ-4200", "REQ-4201", "REQ-4202"];
    expect(ids).not.toContain(nextSequentialId("REQ", ids, 4200));
  });

  it("fills past a gap rather than into it", () => {
    // Reusing a freed number would resurrect a deleted record's history.
    expect(nextSequentialId("REQ", ["REQ-4200", "REQ-4205"], 4200)).toBe(
      "REQ-4206",
    );
  });

  it("ignores ids belonging to another sequence", () => {
    expect(nextSequentialId("RPT", ["REQ-9999", "RPT-1000"], 1000)).toBe(
      "RPT-1001",
    );
  });

  it("ignores a malformed id rather than producing NaN", () => {
    expect(nextSequentialId("REQ", ["REQ-draft", "REQ-4200"], 4200)).toBe(
      "REQ-4201",
    );
  });
});

describe("equipmentBreakdown", () => {
  const units = (...c: EquipmentCondition[]) =>
    c.map((condition) => ({ condition }));

  it("satisfies running + faulty + underMaintenance === total by construction", () => {
    const eq = equipmentBreakdown(
      units("healthy", "healthy", "faulty", "under-maintenance"),
    );
    expect(eq.running + eq.faulty + eq.underMaintenance).toBe(eq.total);
  });

  it("leaves decommissioned units off the estate entirely", () => {
    const eq = equipmentBreakdown(units("healthy", "decommissioned"));
    expect(eq.total).toBe(1);
    expect(eq.running).toBe(1);
  });

  it("counts nothing as nothing", () => {
    expect(equipmentBreakdown([])).toEqual({
      running: 0,
      faulty: 0,
      underMaintenance: 0,
      total: 0,
    });
  });
});

describe("openRequestsForUnit", () => {
  const rows = [
    { equipmentId: "EQ-1", status: "requested" as const },
    { equipmentId: "EQ-1", status: "completed" as const },
    { equipmentId: "EQ-2", status: "in-progress" as const },
  ];

  it("counts only open requests against that unit", () => {
    expect(openRequestsForUnit(rows, "EQ-1")).toBe(1);
  });

  it("does not count another unit's work", () => {
    expect(openRequestsForUnit(rows, "EQ-2")).toBe(1);
    expect(openRequestsForUnit(rows, "EQ-3")).toBe(0);
  });
});
