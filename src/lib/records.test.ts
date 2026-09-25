// The Historical Record is what someone reads back months later, so what it
// lets through has to be decided once and stay decided.

import { describe, expect, it } from "vitest";
import { isEstateRecord, isRoutineReading, isSignificant } from "./records";
import type { LogActionType, LogBookEntry, LogBookSource } from "./types";

function entry(over: Partial<LogBookEntry> = {}): LogBookEntry {
  return {
    id: "L1",
    timestamp: "2026-09-20T09:00:00.000Z",
    actorName: "Daw Htun",
    source: "equipment" as LogBookSource,
    actionType: "equipment-status-changed" as LogActionType,
    title: "Equipment marked faulty",
    detail: "EQ-209-01",
    targetType: "equipment",
    targetId: "EQ-209-01",
    ...over,
  };
}

describe("isEstateRecord", () => {
  it("keeps estate activity", () => {
    expect(isEstateRecord(entry())).toBe(true);
    expect(isEstateRecord(entry({ actionType: "building-deleted" }))).toBe(
      true,
    );
  });

  it("holds personnel back, because Office Staff read this page", () => {
    for (const actionType of [
      "user-added",
      "user-edited",
      "user-role-changed",
      "user-status-changed",
      "password-changed",
    ] as LogActionType[]) {
      expect(isEstateRecord(entry({ actionType }))).toBe(false);
    }
  });
});

describe("isSignificant", () => {
  it("takes a written reason as the signal", () => {
    // The strongest one there is: the app refused to act until it was given.
    expect(isSignificant(entry({ reason: "Water damage beyond repair" }))).toBe(
      true,
    );
  });

  it("ignores a reason that is only whitespace", () => {
    expect(isSignificant(entry({ reason: "   " }))).toBe(false);
  });

  it("takes every alarm", () => {
    expect(isSignificant(entry({ source: "alert" }))).toBe(true);
  });

  it("takes a refusal, a withdrawal, a deletion and an archive", () => {
    for (const actionType of [
      "request-declined",
      "request-withdrawn",
      "building-deleted",
      "room-removed",
      "sensor-type-archived",
      "equipment-type-archived",
    ] as LogActionType[]) {
      expect(isSignificant(entry({ actionType }))).toBe(true);
    }
  });

  it("leaves routine activity to the Log Book", () => {
    // The whole point of the split: a sensor crossing a band all afternoon is
    // a log, not a record.
    expect(isSignificant(entry({ source: "sensor" }))).toBe(false);
    expect(isSignificant(entry({ actionType: "report-generated" }))).toBe(
      false,
    );
    expect(isSignificant(entry({ actionType: "building-edited" }))).toBe(false);
    expect(isSignificant(entry({ actionType: "request-created" }))).toBe(false);
  });

  it("separates a unit deleted from a unit merely marked faulty", () => {
    // Both log `equipment-status-changed`, so only the reason can tell them
    // apart — which is exactly why the reason had to become a field.
    expect(
      isSignificant(entry({ reason: "Decommissioned — beyond repair" })),
    ).toBe(true);
    expect(isSignificant(entry())).toBe(false);
  });
});

describe("isRoutineReading", () => {
  it("takes an automated crossing as routine", () => {
    expect(
      isRoutineReading(
        entry({ source: "sensor", automated: true, reading: 24.1 }),
      ),
    ).toBe(true);
  });

  it("never treats an alarm as routine, whatever wrote it", () => {
    // A fire detector triggering is an event whoever is reading this needs.
    expect(isRoutineReading(entry({ source: "alert", automated: true }))).toBe(
      false,
    );
  });

  it("leaves anything a person did alone", () => {
    // Same collection, same source, same action type — a device removed by
    // hand is not an observation.
    expect(
      isRoutineReading(
        entry({ source: "sensor", title: "Sensor removed", reason: "Faulty" }),
      ),
    ).toBe(false);
  });

  it("treats a legacy entry with no marker as a real one", () => {
    // Safer to show a routine crossing than to hide a real action.
    expect(isRoutineReading(entry({ source: "sensor" }))).toBe(false);
  });
});
