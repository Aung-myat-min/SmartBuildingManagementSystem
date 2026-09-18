import { describe, expect, it } from "vitest";
import { toLogEntry, toSensor, toSensorType } from "./store-mappers";

/** A Firestore Timestamp, duck-typed — the mapper only ever calls toDate(). */
const stamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe("toLogEntry", () => {
  it("turns the Timestamp into an ISO string at this boundary", () => {
    const entry = toLogEntry("abc", {
      timestamp: stamp("2026-09-09T20:14:00Z"),
      actorName: "Sensor network",
      source: "alert",
      actionType: "sensor-status-changed",
      title: "Door forced open",
      detail: "Junction Square / Room L2-14.",
      targetType: "sensor",
      targetId: "DL-JSQ-214",
    });
    expect(entry.timestamp).toBe("2026-09-09T20:14:00.000Z");
    expect(entry.id).toBe("abc");
  });

  // serverTimestamp() comes back null in the local snapshot, before the server
  // has stamped it. Without a fallback a fresh entry renders blank and then
  // jumps in the sort when the real value lands.
  it("survives the pending serverTimestamp, which reads back null", () => {
    const entry = toLogEntry("abc", { timestamp: null, title: "Just written" });
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  });

  it("names an unattributed entry rather than leaving it blank", () => {
    expect(toLogEntry("abc", {}).actorName).toBe("System");
  });

  it("keeps a system entry free of a uid and a role", () => {
    const entry = toLogEntry("abc", { actorName: "System · schedule" });
    expect(entry.actorUid).toBeUndefined();
    expect(entry.actorRole).toBeUndefined();
  });

  it("carries the optional link fields through when present", () => {
    const entry = toLogEntry("abc", {
      buildingId: "b216",
      refId: "REQ-4192",
      actorUid: "u-1",
      actorRole: "admin-manager",
    });
    expect(entry.buildingId).toBe("b216");
    expect(entry.refId).toBe("REQ-4192");
    expect(entry.actorRole).toBe("admin-manager");
  });
});

describe("toSensorType", () => {
  it("round-trips a type written whole", () => {
    const type = toSensorType("fire-alarm", {
      label: "Fire alarm",
      icon: "flame",
      statuses: [{ id: "normal", label: "Normal", tone: "success" }],
      actions: [
        { id: "reset", label: "Reset", caption: "", resultStatus: "normal" },
      ],
      archived: false,
    });
    expect(type.id).toBe("fire-alarm");
    expect(type.statuses[0].id).toBe("normal");
    expect(type.actions).toHaveLength(1);
  });

  it("gives a type with no statuses one the UI can draw", () => {
    // A type with an empty vocabulary cannot render a sensor at all, and the
    // Sensors page groups by type — so a malformed document would blank a
    // whole column rather than one cell.
    const type = toSensorType("broken", { label: "Broken", statuses: [] });
    expect(type.statuses).toHaveLength(1);
    expect(type.statuses[0].tone).toBe("neutral");
  });

  it("defaults the icon and the archive flag", () => {
    const type = toSensorType("bare", {});
    expect(type.icon).toBe("activity");
    expect(type.archived).toBe(false);
    expect(type.label).toBe("bare");
  });
});

describe("toSensor", () => {
  it("keeps statusChangedAt distinct from the last report", () => {
    // They are different questions. A routine report must not restart the
    // clock a tone-with-age status is measured against.
    const sensor = toSensor("DL-209-02", {
      buildingId: "b209",
      roomId: "r-209-01",
      typeId: "door-lock",
      status: "unlocked",
      statusChangedAt: "2026-09-09T20:00:00Z",
      updatedAt: "2026-09-09T20:38:00Z",
    });
    expect(sensor.statusChangedAt).toBe("2026-09-09T20:00:00Z");
    expect(sensor.updatedAt).toBe("2026-09-09T20:38:00Z");
  });

  it("leaves statusChangedAt absent on a device that never changed", () => {
    const sensor = toSensor("FD-216-08", {
      updatedAt: "2026-09-09T20:38:00Z",
    });
    expect(sensor.statusChangedAt).toBeUndefined();
    expect(sensor.id).toBe("FD-216-08");
  });
});
