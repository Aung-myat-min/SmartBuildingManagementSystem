// The figures are the product — they get exported and filed — so these assert
// exact values, not shapes. A wrong number here is the one failure no amount
// of clicking around would catch.

import { describe, expect, it } from "vitest";
import {
  buildCostReport,
  buildMaintenanceReport,
  buildReliabilityReport,
  buildReport,
  type ReportScope,
} from "./reporting";
import type {
  EquipmentHistoryEvent,
  EquipmentUnit,
  MaintenanceRequest,
} from "./types";

const PERIOD_START = "2026-09-01";
const PERIOD_END = "2026-09-14";

function unit(id: string, over: Partial<EquipmentUnit> = {}): EquipmentUnit {
  return {
    id,
    tag: id,
    buildingId: "b216",
    roomId: "r-216-302",
    typeId: "projector",
    condition: "healthy",
    installedAt: "2025-01-01T00:00:00.000Z",
    nextServiceDue: "2027-01-01T00:00:00.000Z",
    ...over,
  };
}

function req(
  id: string,
  over: Partial<MaintenanceRequest> = {},
): MaintenanceRequest {
  return {
    id,
    buildingId: "b216",
    roomId: "r-216-302",
    equipmentId: "EQ-1",
    issue: "Something is broken",
    priority: "normal",
    status: "requested",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: "2026-09-02T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
    ...over,
  };
}

function ev(
  id: string,
  over: Partial<EquipmentHistoryEvent> = {},
): EquipmentHistoryEvent {
  return {
    id,
    equipmentUnitId: "EQ-1",
    type: "fault-reported",
    at: "2026-09-03T09:00:00.000Z",
    summary: "Marked faulty",
    actorName: "Hnin Nwe",
    ...over,
  };
}

function scope(over: Partial<ReportScope> = {}): ReportScope {
  return {
    requests: [],
    units: [unit("EQ-1")],
    history: [],
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    typeLabel: (id) => `Type:${id}`,
    unitLabel: (u) => `Unit:${u.id}`,
    ...over,
  };
}

const kpi = (
  figures: { kpis: { label: string; value: number }[] },
  label: string,
) => figures.kpis.find((k) => k.label === label)?.value;

describe("period boundaries", () => {
  it("counts a request inside the period and ignores one outside it", () => {
    const figures = buildMaintenanceReport(
      scope({
        requests: [
          req("IN", { submittedAt: "2026-09-02T09:00:00.000Z" }),
          req("OUT", { submittedAt: "2026-08-28T09:00:00.000Z" }),
        ],
      }),
    );
    expect(figures.notes).toContain("1 request");
  });

  it("includes the whole of the end day, not just its first instant", () => {
    // A range read as "1st to 14th" includes everything on the 14th.
    const figures = buildMaintenanceReport(
      scope({
        requests: [req("LATE", { submittedAt: "2026-09-14T23:30:00.000Z" })],
      }),
    );
    expect(figures.notes).toContain("1 request");
  });

  it("leaves a withdrawn request out of every count", () => {
    const figures = buildMaintenanceReport(
      scope({ requests: [req("GONE", { withdrawn: true })] }),
    );
    expect(figures.notes).toContain("0 requests");
  });
});

describe("buildMaintenanceReport", () => {
  const requests = [
    req("A", { status: "completed", updatedAt: "2026-09-04T09:00:00.000Z" }),
    req("B", { status: "resolved", updatedAt: "2026-09-08T09:00:00.000Z" }),
    req("C", { status: "in-progress" }),
    req("D", { status: "requested" }),
  ];

  it("counts resolved over raised", () => {
    const f = buildMaintenanceReport(scope({ requests }));
    expect(kpi(f, "Resolution rate")).toBe(50);
    expect(kpi(f, "Still open")).toBe(2);
  });

  it("averages turnaround over finished requests only", () => {
    // A took 2 days, B took 6. An unfinished request has no turnaround, so
    // including it would drag the mean toward zero.
    const f = buildMaintenanceReport(scope({ requests }));
    expect(kpi(f, "Mean days to resolve")).toBe(4);
  });

  it("reports zero rather than NaN when nothing was resolved", () => {
    const f = buildMaintenanceReport(
      scope({ requests: [req("D", { status: "requested" })] }),
    );
    expect(kpi(f, "Mean days to resolve")).toBe(0);
    expect(kpi(f, "Resolution rate")).toBe(0);
  });

  it("buckets a fortnight into two weeks", () => {
    const f = buildMaintenanceReport(scope({ requests }));
    expect(f.weeks.map((w) => w.label)).toEqual(["Wk 1", "Wk 2"]);
    // A and B are in week 1 (2nd and 8th... 8th falls in week 2).
    expect(f.weeks[0].resolved + f.weeks[1].resolved).toBe(2);
  });

  it("gives an empty period one empty week, not zero weeks", () => {
    const f = buildMaintenanceReport(scope());
    expect(f.weeks).toHaveLength(2);
    expect(f.weeks.every((w) => w.resolved === 0)).toBe(true);
  });
});

describe("buildReliabilityReport", () => {
  it("closes a fault at its return to service", () => {
    const f = buildReliabilityReport(
      scope({
        history: [
          ev("h1", { at: "2026-09-03T00:00:00.000Z" }),
          ev("h2", {
            type: "returned-to-service",
            at: "2026-09-04T12:00:00.000Z",
          }),
        ],
      }),
    );
    expect(f.offenders[0].downtimeHours).toBe(36);
    expect(f.offenders[0].ongoing).toBe(false);
    expect(kpi(f, "Mean time to repair")).toBe(36);
  });

  it("runs an unclosed fault to the period end and flags it", () => {
    const f = buildReliabilityReport(
      scope({ history: [ev("h1", { at: "2026-09-13T00:00:00.000Z" })] }),
    );
    expect(f.offenders[0].ongoing).toBe(true);
    // 13 Sep 00:00 to the end of 14 Sep is very nearly 48 hours.
    expect(f.offenders[0].downtimeHours).toBe(48);
    expect(f.notes).toContain("still awaiting a return to service");
  });

  it("keeps an open fault out of mean time to repair", () => {
    // Averaging in work nobody has finished would report a repair time for it.
    const f = buildReliabilityReport(
      scope({
        units: [unit("EQ-1"), unit("EQ-2")],
        history: [
          ev("h1", { at: "2026-09-03T00:00:00.000Z" }),
          ev("h2", {
            type: "returned-to-service",
            at: "2026-09-04T00:00:00.000Z",
          }),
          ev("h3", { equipmentUnitId: "EQ-2", at: "2026-09-10T00:00:00.000Z" }),
        ],
      }),
    );
    expect(kpi(f, "Mean time to repair")).toBe(24);
    expect(kpi(f, "Faults recorded")).toBe(2);
    expect(kpi(f, "Units affected")).toBe(2);
  });

  it("groups faults by the unit's equipment type", () => {
    const f = buildReliabilityReport(
      scope({
        units: [unit("EQ-1"), unit("EQ-2", { typeId: "air-conditioner" })],
        history: [
          ev("h1"),
          ev("h2", { equipmentUnitId: "EQ-2" }),
          ev("h3", { equipmentUnitId: "EQ-2" }),
        ],
      }),
    );
    expect(f.faultTypes).toEqual([
      { typeLabel: "Type:air-conditioner", count: 2 },
      { typeLabel: "Type:projector", count: 1 },
    ]);
  });

  it("reports a healthy register with no faults at all", () => {
    const f = buildReliabilityReport(scope());
    expect(kpi(f, "Faults recorded")).toBe(0);
    expect(kpi(f, "Register healthy")).toBe(100);
    expect(kpi(f, "Mean time to repair")).toBe(0);
    expect(f.offenders).toEqual([]);
  });
});

describe("buildCostReport", () => {
  const requests = [
    req("A", { status: "resolved", costMmk: 145000 }),
    req("B", { status: "resolved", costMmk: 0 }),
    req("C", { status: "completed" }),
    req("D", { status: "in-progress", costMmk: 999999 }),
  ];

  it("totals only what was actually recorded", () => {
    const f = buildCostReport(scope({ requests }));
    // D is in progress but carries a figure, so it counts toward spend.
    expect(f.spentMmk).toBe(1144999);
  });

  it("measures coverage against resolved requests", () => {
    // A and B carry a cost, C does not. D is not resolved, so it is not owed one.
    const f = buildCostReport(scope({ requests }));
    expect(kpi(f, "Cost coverage")).toBe(67);
    expect(kpi(f, "Priced requests")).toBe(2);
    expect(f.notes).toContain("1 of 3 resolved");
  });

  it("counts a zero as priced, not as missing", () => {
    const f = buildCostReport(
      scope({ requests: [req("B", { status: "resolved", costMmk: 0 })] }),
    );
    expect(kpi(f, "Cost coverage")).toBe(100);
    expect(f.notes).toContain("Every resolved request");
  });

  it("adds service costs to request costs, grouped by type", () => {
    const f = buildCostReport(
      scope({
        units: [unit("EQ-1"), unit("EQ-2", { typeId: "air-conditioner" })],
        requests: [req("A", { status: "resolved", costMmk: 100000 })],
        history: [
          ev("s1", {
            equipmentUnitId: "EQ-2",
            type: "service",
            costMmk: 50000,
          }),
        ],
      }),
    );
    expect(f.costs).toEqual([
      { label: "Type:projector", valueMmk: 100000 },
      { label: "Type:air-conditioner", valueMmk: 50000 },
      { label: "Total", valueMmk: 150000, isTotal: true },
    ]);
  });

  it("draws no total line when nothing was spent", () => {
    const f = buildCostReport(scope());
    expect(f.costs).toEqual([]);
    expect(f.spentMmk).toBe(0);
  });

  it("never invents a budget", () => {
    expect(buildCostReport(scope({ requests })).budgetMmk).toBeUndefined();
  });
});

describe("building scope", () => {
  const mixed = {
    units: [unit("EQ-1"), unit("EQ-9", { buildingId: "b209" })],
    requests: [
      req("A", { status: "resolved", costMmk: 100 }),
      req("B", {
        buildingId: "b209",
        equipmentId: "EQ-9",
        status: "resolved",
        costMmk: 900,
      }),
    ],
  };

  it("covers the whole estate when no building is named", () => {
    expect(buildCostReport(scope(mixed)).spentMmk).toBe(1000);
  });

  it("counts only the named building", () => {
    expect(
      buildCostReport(scope({ ...mixed, buildingId: "b209" })).spentMmk,
    ).toBe(900);
  });

  it("scopes history by the unit's building, not just the row", () => {
    const f = buildReliabilityReport(
      scope({
        ...mixed,
        buildingId: "b216",
        history: [ev("h1", { equipmentUnitId: "EQ-9" })],
      }),
    );
    expect(kpi(f, "Faults recorded")).toBe(0);
  });
});

describe("buildReport", () => {
  it("dispatches on kind", () => {
    const s = scope();
    expect(buildReport("equipment-reliability", s).kpis[0].label).toBe(
      "Faults recorded",
    );
    expect(buildReport("cost-of-maintenance", s).kpis[0].label).toBe(
      "Total spent",
    );
    expect(buildReport("maintenance-performance", s).kpis[0].label).toBe(
      "Resolution rate",
    );
  });
});
