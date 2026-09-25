// Band edges are the thing that goes quietly wrong, so every boundary is
// asserted explicitly rather than "somewhere in the middle".

import { describe, expect, it } from "vitest";
import {
  bandFor,
  bandsRefusal,
  clampToRange,
  formatReading,
  gaugeFraction,
  isMeasuring,
  nextThreshold,
  statusForReading,
  trendOf,
} from "./sensor-readings";
import type { SensorTypeDef } from "./types";

const temperature: SensorTypeDef = {
  id: "temperature",
  label: "Temperature",
  icon: "thermometer",
  statuses: [
    { id: "cold", label: "Cold", tone: "info", isAlarm: false },
    { id: "normal", label: "Normal", tone: "success", isAlarm: false },
    { id: "warm", label: "Warm", tone: "warning", isAlarm: false },
    { id: "overheat", label: "Overheating", tone: "danger", isAlarm: true },
  ],
  actions: [],
  measurement: {
    unit: "°C",
    min: 0,
    max: 50,
    decimals: 1,
    bands: [
      { upTo: 18, statusId: "cold" },
      { upTo: 27, statusId: "normal" },
      { upTo: 32, statusId: "warm" },
      { upTo: null, statusId: "overheat" },
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

describe("isMeasuring", () => {
  it("separates a type that reads a number from one that does not", () => {
    expect(isMeasuring(temperature)).toBe(true);
    expect(isMeasuring(doorLock)).toBe(false);
    expect(isMeasuring(undefined)).toBe(false);
  });
});

describe("statusForReading", () => {
  it("owns its upper limit, so the band above starts past it", () => {
    expect(statusForReading(temperature, 17.9)).toBe("cold");
    expect(statusForReading(temperature, 18)).toBe("cold");
    expect(statusForReading(temperature, 18.1)).toBe("normal");
  });

  it("picks the right band at every other edge", () => {
    expect(statusForReading(temperature, 27)).toBe("normal");
    expect(statusForReading(temperature, 27.1)).toBe("warm");
    expect(statusForReading(temperature, 32)).toBe("warm");
    expect(statusForReading(temperature, 32.1)).toBe("overheat");
  });

  it("gives everything above the last limit to the catch-all", () => {
    expect(statusForReading(temperature, 90)).toBe("overheat");
    expect(statusForReading(temperature, 1e6)).toBe("overheat");
  });

  it("gives everything below the first limit to the first band", () => {
    expect(statusForReading(temperature, -40)).toBe("cold");
  });

  it("says nothing rather than guessing for a type with no measurement", () => {
    expect(statusForReading(doorLock, 21)).toBeNull();
    expect(bandFor(doorLock, 21)).toBeNull();
  });

  it("says nothing for a reading that is not a number", () => {
    expect(statusForReading(temperature, Number.NaN)).toBeNull();
  });
});

describe("the gauge", () => {
  it("keeps a forced value on the dial", () => {
    expect(clampToRange(temperature, 999)).toBe(50);
    expect(clampToRange(temperature, -999)).toBe(0);
    expect(clampToRange(temperature, 21)).toBe(21);
  });

  it("places a reading along the range", () => {
    expect(gaugeFraction(temperature, 0)).toBe(0);
    expect(gaugeFraction(temperature, 25)).toBe(0.5);
    expect(gaugeFraction(temperature, 50)).toBe(1);
    // Off the dial still reads as the end of it, not past it.
    expect(gaugeFraction(temperature, 80)).toBe(1);
  });

  it("writes a reading with its unit and precision", () => {
    expect(formatReading(temperature, 24.83)).toBe("24.8 °C");
    expect(formatReading(temperature, undefined)).toBe("—");
    expect(formatReading(doorLock, 5)).toBe("—");
  });
});

describe("bandsRefusal", () => {
  const ids = ["cold", "normal", "warm", "overheat"];

  it("accepts ascending bands that end in a catch-all", () => {
    expect(bandsRefusal(temperature.measurement?.bands ?? [], ids)).toBeNull();
  });

  it("refuses a last band with an upper limit", () => {
    // Without the catch-all some readings would land in no band at all, and
    // the sensor would silently stop updating.
    expect(bandsRefusal([{ upTo: 30, statusId: "normal" }], ids)).toContain(
      "no upper limit",
    );
  });

  it("refuses limits that do not climb", () => {
    expect(
      bandsRefusal(
        [
          { upTo: 27, statusId: "cold" },
          { upTo: 18, statusId: "normal" },
          { upTo: null, statusId: "warm" },
        ],
        ids,
      ),
    ).toContain("climb");
  });

  it("refuses a band naming a status the type does not have", () => {
    expect(bandsRefusal([{ upTo: null, statusId: "melting" }], ids)).toContain(
      "melting",
    );
  });

  it("refuses no bands at all", () => {
    expect(bandsRefusal([], ids)).toContain("at least one band");
  });
});

describe("nextThreshold", () => {
  it("points at the band above, and where it starts", () => {
    // The question a reader actually has: how far am I from trouble?
    expect(nextThreshold(temperature, 21)).toEqual({
      statusId: "warm",
      at: 27,
      direction: "above",
    });
  });

  it("points at the first band's ceiling from below it", () => {
    expect(nextThreshold(temperature, 10)).toEqual({
      statusId: "normal",
      at: 18,
      direction: "above",
    });
  });

  it("turns around at the top, where there is nothing above", () => {
    // An overheating room wants to know when it is merely warm again.
    expect(nextThreshold(temperature, 40)).toEqual({
      statusId: "warm",
      at: 32,
      direction: "below",
    });
  });

  it("says nothing for a type with no measurement", () => {
    expect(nextThreshold(doorLock, 21)).toBeNull();
  });
});

describe("trendOf", () => {
  const series = (...xs: number[]) => xs;

  it("waits for enough history rather than guessing", () => {
    expect(trendOf(temperature, series(20, 21, 22))).toBe("steady");
  });

  it("reads a climb and a fall", () => {
    expect(trendOf(temperature, series(20, 20, 20, 30, 31, 32))).toBe("rising");
    expect(trendOf(temperature, series(32, 31, 30, 20, 20, 20))).toBe(
      "falling",
    );
  });

  it("calls a wobble steady", () => {
    // A bounded random walk jitters constantly; without a deadband this would
    // flip direction every tick and mean nothing.
    expect(trendOf(temperature, series(20, 20.1, 19.9, 20, 20.1, 19.95))).toBe(
      "steady",
    );
  });

  it("is steady for a type that does not measure", () => {
    expect(trendOf(doorLock, series(1, 2, 3, 4, 5, 6))).toBe("steady");
  });
});
