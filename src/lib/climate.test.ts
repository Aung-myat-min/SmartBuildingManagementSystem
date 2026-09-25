// Every headline on the Monitoring tab is one of these numbers, so the rules
// behind them — worst wins, offline is not comfortable, an average of nothing
// is not zero — are asserted rather than eyeballed.

import { describe, expect, it } from "vitest";
import { averageOf, needsAttention, roomClimates, summarise } from "./climate";
import type { EnvironmentalSensor, Room, SensorTypeDef } from "./types";

const temperature: SensorTypeDef = {
  id: "temperature",
  label: "Temperature",
  icon: "thermometer",
  statuses: [
    { id: "cold", label: "Cold", tone: "info", isAlarm: false },
    { id: "ok", label: "Comfortable", tone: "success", isAlarm: false },
    { id: "warm", label: "Warm", tone: "warning", isAlarm: false },
    { id: "hot", label: "Overheating", tone: "danger", isAlarm: true },
  ],
  actions: [],
  measurement: {
    unit: "°C",
    min: 5,
    max: 45,
    decimals: 1,
    bands: [
      { upTo: 18, statusId: "cold" },
      { upTo: 26, statusId: "ok" },
      { upTo: 31, statusId: "warm" },
      { upTo: null, statusId: "hot" },
    ],
    overrides: {
      plant: [
        { upTo: 16, statusId: "cold" },
        { upTo: 22, statusId: "ok" },
        { upTo: 25, statusId: "warm" },
        { upTo: null, statusId: "hot" },
      ],
    },
  },
};

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
      { upTo: 800, statusId: "fresh" },
      { upTo: null, statusId: "stuffy" },
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

const TYPES = [temperature, co2, doorLock];

function room(id: string, over: Partial<Room> = {}): Room {
  return {
    id,
    buildingId: "b216",
    roomNumber: id.toUpperCase(),
    type: "office",
    floor: "1",
    ...over,
  };
}

function sensor(
  id: string,
  roomId: string,
  typeId: string,
  over: Partial<EnvironmentalSensor> = {},
): EnvironmentalSensor {
  return {
    id,
    buildingId: "b216",
    roomId,
    typeId,
    status: "ok",
    updatedAt: "2026-09-25T10:00:00.000Z",
    ...over,
  };
}

describe("roomClimates", () => {
  it("takes the worst sensor as the room's status", () => {
    // Comfortable on temperature and choking on CO2 is not comfortable.
    const [c] = roomClimates(
      [room("r1")],
      [sensor("t1", "r1", "temperature"), sensor("c1", "r1", "co2")],
      TYPES,
      { t1: 21, c1: 1200 },
    );
    expect(c.tone).toBe("warning");
    expect(c.worst?.typeId).toBe("co2");
    expect(c.readings.map((r) => r.typeId)).toEqual(["co2", "temperature"]);
  });

  it("judges a room by its own limits", () => {
    const [office] = roomClimates(
      [room("r1")],
      [sensor("t1", "r1", "temperature")],
      TYPES,
      { t1: 24 },
    );
    const [plant] = roomClimates(
      [room("r2", { type: "plant" })],
      [sensor("t2", "r2", "temperature")],
      TYPES,
      { t2: 24 },
    );
    expect(office.worst?.statusLabel).toBe("Comfortable");
    expect(plant.worst?.statusLabel).toBe("Warm");
  });

  it("ignores a sensor with no number to summarise", () => {
    const [c] = roomClimates(
      [room("r1")],
      [sensor("d1", "r1", "door-lock", { status: "locked" })],
      TYPES,
      {},
    );
    expect(c.readings).toEqual([]);
    expect(c.offline).toBe(false); // nothing measuring here, so nothing is dark
  });

  it("calls a room with measuring sensors that are all dark offline", () => {
    // Not comfortable. Saying "comfortable" about a room nobody can hear is
    // worse than saying nothing.
    const [c] = roomClimates(
      [room("r1")],
      [sensor("t1", "r1", "temperature", { status: "offline" })],
      TYPES,
      { t1: 21 },
    );
    expect(c.offline).toBe(true);
    expect(c.tone).toBe("neutral");
  });

  it("falls back to the stored reading when the simulation has none", () => {
    const [c] = roomClimates(
      [room("r1")],
      [sensor("t1", "r1", "temperature", { reading: 29 })],
      TYPES,
      {},
    );
    expect(c.worst?.statusLabel).toBe("Warm");
  });

  it("flags an alarm separately from a merely bad tone", () => {
    const [c] = roomClimates(
      [room("r1")],
      [sensor("t1", "r1", "temperature")],
      TYPES,
      { t1: 35 },
    );
    expect(c.hasAlarm).toBe(true);
  });
});

describe("summarise", () => {
  const rooms = [
    room("ok1"),
    room("ok2"),
    room("warm1"),
    room("hot1"),
    room("dark1"),
  ];
  const sensors = [
    sensor("s1", "ok1", "temperature"),
    sensor("s2", "ok2", "temperature"),
    sensor("s3", "warm1", "temperature"),
    sensor("s4", "hot1", "temperature"),
    sensor("s5", "dark1", "temperature", { status: "offline" }),
  ];
  const readings = { s1: 21, s2: 22, s3: 29, s4: 35, s5: 21 };

  it("counts each room once, in its worst bucket", () => {
    const s = summarise(roomClimates(rooms, sensors, TYPES, readings));
    expect(s).toMatchObject({
      total: 5,
      comfortable: 2,
      warning: 1,
      alarm: 1,
      offline: 1,
    });
  });

  it("takes comfort as a share of what is reporting, not of everything", () => {
    // A building half of whose sensors are dark is not half comfortable; it is
    // unknown, and the offline count beside it says so.
    const s = summarise(roomClimates(rooms, sensors, TYPES, readings));
    expect(s.comfortPct).toBe(50); // 2 of the 4 reporting, not 2 of 5
  });

  it("does not divide by zero when nothing reports", () => {
    const s = summarise(roomClimates([room("r1")], [], TYPES, {}));
    expect(s.comfortPct).toBe(0);
  });
});

describe("averageOf", () => {
  it("averages one measure across the estate", () => {
    const climates = roomClimates(
      [room("r1"), room("r2")],
      [sensor("t1", "r1", "temperature"), sensor("t2", "r2", "temperature")],
      TYPES,
      { t1: 20, t2: 24 },
    );
    expect(averageOf(climates, "temperature")).toMatchObject({
      value: 22,
      unit: "°C",
    });
  });

  it("returns null rather than zero when nothing reports", () => {
    // "0 ppm" is a reading. A dashboard showing one while every sensor is dark
    // is lying rather than silent.
    expect(averageOf([], "co2")).toBeNull();
  });
});

describe("needsAttention", () => {
  it("puts alarms above warnings, and the longest-standing first", () => {
    const climates = roomClimates(
      [room("warmOld"), room("warmNew"), room("hot")],
      [
        sensor("a", "warmOld", "temperature", {
          statusChangedAt: "2026-09-25T08:00:00.000Z",
        }),
        sensor("b", "warmNew", "temperature", {
          statusChangedAt: "2026-09-25T11:00:00.000Z",
        }),
        sensor("c", "hot", "temperature", {
          statusChangedAt: "2026-09-25T11:30:00.000Z",
        }),
      ],
      TYPES,
      { a: 29, b: 29, c: 35 },
    );
    expect(needsAttention(climates).map((c) => c.roomId)).toEqual([
      "hot",
      "warmOld",
      "warmNew",
    ]);
  });

  it("leaves comfortable and offline rooms out of it", () => {
    const climates = roomClimates(
      [room("ok"), room("dark")],
      [
        sensor("a", "ok", "temperature"),
        sensor("b", "dark", "temperature", { status: "offline" }),
      ],
      TYPES,
      { a: 21, b: 21 },
    );
    expect(needsAttention(climates)).toEqual([]);
  });
});
