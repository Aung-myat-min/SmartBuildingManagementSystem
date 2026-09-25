// The walk has to stay inside its range, a held value has to stay put, and a
// cooled room has to reach its setpoint without overshooting. None of those
// are visible from clicking around for a minute.

import { describe, expect, it } from "vitest";
import { statusForReading } from "./sensor-readings";
import { crossings, roundTo, stepReadings } from "./simulation";
import type {
  EnvironmentalSensor,
  EquipmentUnit,
  SensorTypeDef,
} from "./types";

const temperature: SensorTypeDef = {
  id: "temperature",
  label: "Temperature",
  icon: "thermometer",
  statuses: [
    { id: "cold", label: "Cold", tone: "info", isAlarm: false },
    {
      id: "comfortable",
      label: "Comfortable",
      tone: "success",
      isAlarm: false,
    },
    { id: "warm", label: "Warm", tone: "warning", isAlarm: false },
    { id: "overheating", label: "Overheating", tone: "danger", isAlarm: true },
  ],
  actions: [],
  measurement: {
    unit: "°C",
    min: 5,
    max: 45,
    decimals: 1,
    bands: [
      { upTo: 18, statusId: "cold" },
      { upTo: 26, statusId: "comfortable" },
      { upTo: 31, statusId: "warm" },
      { upTo: null, statusId: "overheating" },
    ],
  },
};

const doorLock: SensorTypeDef = {
  id: "door-lock",
  label: "Door lock",
  icon: "lock",
  statuses: [
    { id: "locked", label: "Locked", tone: "success", isAlarm: false },
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
    typeId: "temperature",
    status: "comfortable",
    reading: 22,
    updatedAt: "2026-09-20T12:00:00.000Z",
    ...over,
  };
}

function ac(over: Partial<EquipmentUnit> = {}): EquipmentUnit {
  return {
    id: "EQ-1",
    tag: "EQ-1",
    buildingId: "b216",
    roomId: "r-302",
    typeId: "air-conditioner",
    condition: "healthy",
    installedAt: "2025-01-01T00:00:00.000Z",
    nextServiceDue: "2027-01-01T00:00:00.000Z",
    hvac: { mode: "cool", setpointC: 21, fan: 2 },
    ...over,
  };
}

/** No randomness, so a walk is only its settle and HVAC terms. */
const still = () => 0.5;

const run = (over: Partial<Parameters<typeof stepReadings>[0]> = {}) =>
  stepReadings({
    sensors: [sensor("S1")],
    types: [temperature, doorLock],
    units: [],
    current: {},
    manual: {},
    seconds: 1,
    random: still,
    ...over,
  });

describe("what gets simulated", () => {
  it("covers any sensor whose type measures, by type not by id", () => {
    // The constraint that matters: a sensor created in the app is simulated
    // because its type says so, not because it was added to a list.
    const out = run({
      sensors: [sensor("NEW-1"), sensor("NEW-2", { id: "NEW-2" })],
    });
    expect(Object.keys(out).sort()).toEqual(["NEW-1", "NEW-2"]);
  });

  it("leaves a categorical sensor alone", () => {
    const out = run({
      sensors: [sensor("D1", { typeId: "door-lock", status: "locked" })],
    });
    expect(out).toEqual({});
  });

  it("starts from the sensor's stored reading when it has no series yet", () => {
    const out = run({ sensors: [sensor("S1", { reading: 30 })] });
    // Settling pulls it down toward rest, so it moved but not far.
    expect(out.S1).toBeLessThan(30);
    expect(out.S1).toBeGreaterThan(29);
  });
});

describe("a held sensor", () => {
  it("keeps exactly the value it was given", () => {
    const out = run({ manual: { S1: 33.3 }, seconds: 5 });
    expect(out.S1).toBe(33.3);
  });

  it("is still clamped to the dial", () => {
    expect(run({ manual: { S1: 999 } }).S1).toBe(45);
    expect(run({ manual: { S1: -999 } }).S1).toBe(5);
  });
});

describe("the walk", () => {
  it("stays inside the range over a long run", () => {
    // A walk that can escape its range would peg a sensor at an edge and
    // leave it stuck in one status forever.
    let current: Record<string, number> = {};
    for (let i = 0; i < 2000; i += 1) {
      current = run({ current, random: Math.random, seconds: 3 });
      expect(current.S1).toBeGreaterThanOrEqual(5);
      expect(current.S1).toBeLessThanOrEqual(45);
    }
  });

  it("settles toward rest rather than wandering off", () => {
    let current = { S1: 44 };
    for (let i = 0; i < 400; i += 1) {
      current = run({ current, seconds: 3 }) as { S1: number };
    }
    // Rest is the middle of the band the type calls good — comfortable runs
    // 18–26, so 22. Not a fraction of the dial, which for CO2 on a 350–2500
    // range put the resting point above the fresh threshold and left every
    // room permanently stuffy.
    expect(current.S1).toBeCloseTo(22, 0);
  });
});

describe("HVAC", () => {
  it("moves a room toward the setpoint and stops there", () => {
    let current = { S1: 30 };
    for (let i = 0; i < 300; i += 1) {
      current = run({ current, units: [ac()], seconds: 3 }) as { S1: number };
    }
    expect(current.S1).toBeCloseTo(21, 1);
  });

  it("does not step past the setpoint", () => {
    // A big step with a small gap would overshoot and oscillate.
    const out = run({
      current: { S1: 21.05 },
      units: [ac()],
      seconds: 60,
    });
    expect(out.S1).toBeCloseTo(21, 1);
  });

  it("ignores a unit that is off, faulty or in another room", () => {
    const from = { S1: 30 };
    const base = run({ current: from, seconds: 3 }).S1;
    for (const unit of [
      ac({ hvac: { mode: "off", setpointC: 21, fan: 2 } }),
      ac({ condition: "faulty" }),
      ac({ roomId: "r-999" }),
    ]) {
      expect(run({ current: from, units: [unit], seconds: 3 }).S1).toBeCloseTo(
        base,
        5,
      );
    }
  });

  it("does not warm a room it was told to cool", () => {
    // "Cool to 22" in a 19 °C room used to heat it to 22, because the step
    // asked which way the setpoint was and never what the machine can do.
    const out = run({
      current: { S1: 19 },
      units: [ac({ hvac: { mode: "cool", setpointC: 22, fan: 3 } })],
      seconds: 30,
    });
    expect(out.S1).toBeLessThanOrEqual(19.5);
  });

  it("does not cool a room it was told to heat", () => {
    const out = run({
      current: { S1: 26 },
      units: [ac({ hvac: { mode: "heat", setpointC: 22, fan: 3 } })],
      seconds: 30,
    });
    expect(out.S1).toBeGreaterThanOrEqual(25.5);
  });

  it("holds the setpoint instead of sliding back to ambient", () => {
    // Rest is 22 °C. A cooler sitting on 21 cannot pull the room back up, so
    // without damping the settle term the room would drift to 19 and the unit
    // would have nothing to say about it.
    let current = { S1: 21 };
    for (let i = 0; i < 200; i += 1) {
      current = run({ current, units: [ac()], seconds: 3 }) as { S1: number };
    }
    expect(current.S1).toBeCloseTo(21, 1);
  });

  it("warms a cold room when heating", () => {
    const out = run({
      current: { S1: 12 },
      units: [ac({ hvac: { mode: "heat", setpointC: 24, fan: 3 } })],
      seconds: 10,
    });
    expect(out.S1).toBeGreaterThan(12);
  });
});

describe("crossings", () => {
  const statusFor = (t: SensorTypeDef | undefined, r: number) =>
    statusForReading(t, r);

  it("reports only a sensor whose band actually changed", () => {
    const rows = crossings(
      [sensor("S1", { status: "comfortable" })],
      [temperature],
      { S1: 33 },
      statusFor,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("overheating");
    expect(rows[0].reading).toBe(33);
  });

  it("says nothing while a reading stays in its band", () => {
    // The whole persistence story: holding a value writes once, not forever.
    expect(
      crossings(
        [sensor("S1", { status: "comfortable" })],
        [temperature],
        { S1: 24 },
        statusFor,
      ),
    ).toEqual([]);
  });

  it("ignores a sensor with no reading this tick", () => {
    expect(crossings([sensor("S1")], [temperature], {}, statusFor)).toEqual([]);
  });

  it("holds its status while sitting on a band edge", () => {
    // Without this a sensor resting on a boundary flips every tick and writes
    // a status change and a Log Book entry each time. It did, on the first run.
    const onTheLine = crossings(
      [sensor("S1", { status: "comfortable" })],
      [temperature],
      { S1: 26.2 },
      statusFor,
    );
    expect(onTheLine).toEqual([]);
  });

  it("crosses once the reading is clear of the edge", () => {
    // The margin is 1.5% of a 5–45 range, i.e. 0.6 °C.
    const clear = crossings(
      [sensor("S1", { status: "comfortable" })],
      [temperature],
      { S1: 27 },
      statusFor,
    );
    expect(clear.map((c) => c.status)).toEqual(["warm"]);
  });

  it("stores the reading at the precision the type claims", () => {
    const rows = crossings(
      [sensor("S1", { status: "comfortable" })],
      [temperature],
      { S1: 33.3938564277842 },
      statusFor,
    );
    expect(rows[0].reading).toBe(33.4);
  });
});

describe("where a reading rests", () => {
  it("settles in the middle of the band the type calls good", () => {
    // CO2 on a 350–2500 dial is the case that made this matter: a third of the
    // way up is 1102, above the fresh threshold, so every room drifted to
    // "stuffy" and stayed there and the thresholds took the blame.
    const co2: SensorTypeDef = {
      id: "co2",
      label: "Air quality",
      icon: "wind",
      statuses: [
        { id: "fresh", label: "Fresh", tone: "success", isAlarm: false },
        { id: "stuffy", label: "Stuffy", tone: "warning", isAlarm: false },
      ],
      actions: [],
      measurement: {
        unit: "ppm",
        min: 350,
        max: 2500,
        decimals: 0,
        bands: [
          { upTo: 1000, statusId: "fresh" },
          { upTo: null, statusId: "stuffy" },
        ],
      },
    };
    let current: Record<string, number> = { C1: 2000 };
    for (let i = 0; i < 600; i += 1) {
      current = stepReadings({
        sensors: [sensor("C1", { typeId: "co2", status: "stuffy" })],
        types: [co2],
        units: [],
        current,
        manual: {},
        seconds: 3,
        random: still,
      });
    }
    // Middle of 350–1000, not 35% of 350–2500.
    expect(current.C1).toBeCloseTo(675, 0);
  });

  it("falls back to a fraction of the dial when no band is good", () => {
    const grim: SensorTypeDef = {
      ...temperature,
      statuses: temperature.statuses.map((st) => ({
        ...st,
        tone: "warning" as const,
      })),
    };
    let current: Record<string, number> = { S1: 44 };
    for (let i = 0; i < 600; i += 1) {
      current = stepReadings({
        sensors: [sensor("S1")],
        types: [grim],
        units: [],
        current,
        manual: {},
        seconds: 3,
        random: still,
      });
    }
    expect(current.S1).toBeCloseTo(19, 0); // 35% of 5–45
  });
});

describe("roundTo", () => {
  it("rounds to the given decimals", () => {
    expect(roundTo(836.3938564277842, 0)).toBe(836);
    expect(roundTo(24.8391, 1)).toBe(24.8);
    expect(roundTo(24.85, 1)).toBe(24.9);
  });
});
