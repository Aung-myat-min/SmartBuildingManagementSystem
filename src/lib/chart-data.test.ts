// The shaping decides what a chart claims happened, so the claims are asserted
// here rather than eyeballed on screen.

import { describe, expect, it } from "vitest";
import {
  bandZones,
  liveSeries,
  readingDomain,
  recordedSeries,
} from "./chart-data";
import type { LogBookEntry, SensorTypeDef } from "./types";

const MEASUREMENT = {
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
} satisfies SensorTypeDef["measurement"];

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
  measurement: MEASUREMENT,
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

function entry(over: Partial<LogBookEntry> = {}): LogBookEntry {
  return {
    id: "L1",
    timestamp: "2026-09-25T10:00:00.000Z",
    actorName: "Sensor network",
    source: "sensor",
    actionType: "sensor-status-changed",
    title: "Temperature → Warm",
    detail: "",
    targetType: "sensor",
    targetId: "TMP-1",
    refId: "TMP-1",
    reading: 27,
    ...over,
  };
}

const SINCE = new Date("2026-09-25T00:00:00.000Z").getTime();

describe("recordedSeries", () => {
  it("keeps only this sensor's entries, oldest first", () => {
    const out = recordedSeries(
      [
        entry({ id: "a", timestamp: "2026-09-25T12:00:00.000Z", reading: 30 }),
        entry({ id: "b", refId: "OTHER-9", reading: 99 }),
        entry({ id: "c", timestamp: "2026-09-25T09:00:00.000Z", reading: 21 }),
      ],
      "TMP-1",
      SINCE,
    );
    expect(out.map((p) => p.value)).toEqual([21, 30]);
  });

  it("drops entries written before the reading was stored", () => {
    // Plotting a missing number as zero would be a lie in the shape of data.
    const out = recordedSeries(
      [entry({ reading: undefined }), entry({ id: "b", reading: 24 })],
      "TMP-1",
      SINCE,
    );
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(24);
  });

  it("drops anything outside the window, and survives a bad timestamp", () => {
    expect(
      recordedSeries(
        [entry({ timestamp: "2026-09-01T10:00:00.000Z" })],
        "TMP-1",
        SINCE,
      ),
    ).toEqual([]);
    expect(
      recordedSeries([entry({ timestamp: "not a date" })], "TMP-1", SINCE),
    ).toEqual([]);
  });

  it("returns nothing rather than throwing for a sensor with no history", () => {
    expect(recordedSeries([], "TMP-1", SINCE)).toEqual([]);
  });
});

describe("liveSeries", () => {
  it("walks the timestamps back from now, ending at the present", () => {
    const out = liveSeries([1, 2, 3], 3, 30_000);
    expect(out).toEqual([
      { at: 24_000, value: 1 },
      { at: 27_000, value: 2 },
      { at: 30_000, value: 3 },
    ]);
  });

  it("handles an empty and a single-point window", () => {
    expect(liveSeries([], 3, 1000)).toEqual([]);
    expect(liveSeries([7], 3, 1000)).toEqual([{ at: 1000, value: 7 }]);
  });
});

describe("bandZones", () => {
  it("tiles the dial exactly, turning the catch-all into a number", () => {
    expect(bandZones(temperature)).toEqual([
      { statusId: "cold", from: 5, to: 18 },
      { statusId: "comfortable", from: 18, to: 26 },
      { statusId: "warm", from: 26, to: 31 },
      { statusId: "overheating", from: 31, to: 45 },
    ]);
  });

  it("gives a type with no measurement no zones", () => {
    expect(bandZones(doorLock)).toEqual([]);
    expect(bandZones(undefined)).toEqual([]);
  });

  it("skips a band that has no width on the dial", () => {
    const squashed: SensorTypeDef = {
      ...temperature,
      measurement: { ...MEASUREMENT, max: 18 },
    };
    // Everything above 18 is off the dial, so only the first band is drawable.
    expect(bandZones(squashed)).toEqual([
      { statusId: "cold", from: 5, to: 18 },
    ]);
  });
});

describe("readingDomain", () => {
  it("falls back to the whole dial when there is nothing to plot", () => {
    expect(readingDomain(temperature, [])).toEqual([5, 45]);
  });

  it("frames the data rather than the dial", () => {
    // 18–22 on a 5–45 dial would otherwise be a flat line across an empty chart.
    const [low, high] = readingDomain(temperature, [
      { at: 1, value: 18 },
      { at: 2, value: 22 },
    ]);
    expect(low).toBeGreaterThan(5);
    expect(high).toBeLessThan(45);
    expect(low).toBeLessThanOrEqual(18);
    expect(high).toBeGreaterThanOrEqual(22);
  });

  it("still gives a flat series room to breathe", () => {
    const [low, high] = readingDomain(temperature, [
      { at: 1, value: 20 },
      { at: 2, value: 20 },
    ]);
    expect(high).toBeGreaterThan(low);
  });

  it("never runs past the dial", () => {
    const [low, high] = readingDomain(temperature, [
      { at: 1, value: 5 },
      { at: 2, value: 45 },
    ]);
    expect(low).toBe(5);
    expect(high).toBe(45);
  });
});
