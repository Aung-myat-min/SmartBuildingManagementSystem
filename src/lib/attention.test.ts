import { describe, expect, it } from "vitest";
import { type AttentionScope, attentionItems } from "./attention";
import type {
  EnvironmentalSensor,
  EquipmentUnit,
  SensorTypeDef,
} from "./types";

const NOW = new Date("2026-09-20T12:00:00Z").getTime();
const daysAway = (d: number) =>
  new Date(NOW + d * 86400000).toISOString().slice(0, 10);

const fireAlarm: SensorTypeDef = {
  id: "fire-alarm",
  label: "Fire detector",
  icon: "flame",
  statuses: [
    { id: "normal", label: "Normal", tone: "success", isAlarm: false },
    { id: "triggered", label: "Triggered", tone: "danger", isAlarm: true },
    { id: "offline", label: "Offline", tone: "neutral", isAlarm: false },
  ],
  actions: [],
};

function sensor(
  id: string,
  over: Partial<EnvironmentalSensor> = {},
): EnvironmentalSensor {
  return {
    id,
    buildingId: "b216",
    roomId: "r-302",
    typeId: "fire-alarm",
    status: "normal",
    updatedAt: "2026-09-19T12:00:00.000Z",
    ...over,
  };
}

function unit(id: string, over: Partial<EquipmentUnit> = {}): EquipmentUnit {
  return {
    id,
    tag: id,
    buildingId: "b216",
    roomId: "r-302",
    typeId: "projector",
    condition: "healthy",
    installedAt: "2025-01-01T00:00:00.000Z",
    nextServiceDue: `${daysAway(90)}T00:00:00.000Z`,
    ...over,
  };
}

function scope(over: Partial<AttentionScope> = {}): AttentionScope {
  return {
    sensors: [],
    units: [],
    typeLabel: (id) => `T:${id}`,
    sensorType: () => fireAlarm,
    roomLabel: (id) => `R:${id}`,
    buildingName: (id) => `B:${id}`,
    ...over,
  };
}

const ids = (s: AttentionScope) => attentionItems(s, NOW).map((i) => i.id);

describe("what reaches the rail", () => {
  it("says nothing when the estate is fine", () => {
    expect(
      ids(scope({ sensors: [sensor("S1")], units: [unit("U1")] })),
    ).toEqual([]);
  });

  it("raises an alarming sensor, a faulty unit and one held for maintenance", () => {
    expect(
      ids(
        scope({
          sensors: [sensor("S1", { status: "triggered" })],
          units: [
            unit("U1", { condition: "faulty" }),
            unit("U2", { condition: "under-maintenance" }),
          ],
        }),
      ),
    ).toEqual(["alarm:S1", "faulty:U1", "maint:U2"]);
  });

  it("says the worse thing once rather than twice about one device", () => {
    // A device cannot be both the top row and a quiet one; alarm wins.
    const alarming = sensor("S1", { status: "triggered" });
    expect(ids(scope({ sensors: [alarming] }))).toEqual(["alarm:S1"]);
  });

  it("raises an offline sensor on its own", () => {
    expect(
      ids(scope({ sensors: [sensor("S1", { status: "offline" })] })),
    ).toEqual(["offline:S1"]);
  });
});

describe("overdue service", () => {
  it("raises a service date in the past", () => {
    const late = unit("U1", {
      nextServiceDue: `${daysAway(-3)}T00:00:00.000Z`,
    });
    const items = attentionItems(scope({ units: [late] }), NOW);
    expect(items.map((i) => i.id)).toEqual(["overdue:U1"]);
    expect(items[0].detail).toContain("3 days overdue");
  });

  it("leaves a service merely coming up alone", () => {
    // Due-service is a board column. Only a date already passed is a failure.
    const soon = unit("U1", { nextServiceDue: `${daysAway(5)}T00:00:00.000Z` });
    expect(ids(scope({ units: [soon] }))).toEqual([]);
  });

  it("does not call a faulty unit overdue as well", () => {
    const both = unit("U1", {
      condition: "faulty",
      nextServiceDue: `${daysAway(-9)}T00:00:00.000Z`,
    });
    expect(ids(scope({ units: [both] }))).toEqual(["faulty:U1"]);
  });
});

describe("ordering and scope", () => {
  it("puts the worst first and the longest-standing first within it", () => {
    const items = ids(
      scope({
        sensors: [
          sensor("NEW", {
            status: "triggered",
            statusChangedAt: "2026-09-20T09:00:00.000Z",
          }),
          sensor("OLD", {
            status: "triggered",
            statusChangedAt: "2026-09-02T09:00:00.000Z",
          }),
        ],
        units: [unit("U1", { condition: "faulty" })],
      }),
    );
    expect(items).toEqual(["alarm:OLD", "alarm:NEW", "faulty:U1"]);
  });

  it("covers the whole estate when no building is named", () => {
    const rows = scope({
      sensors: [
        sensor("S1", { status: "triggered" }),
        sensor("S2", { buildingId: "b209", status: "triggered" }),
      ],
    });
    expect(ids(rows)).toHaveLength(2);
    expect(ids({ ...rows, buildingId: "b209" })).toEqual(["alarm:S2"]);
  });
});
