import { describe, expect, it } from "vitest";
import { toLogEntry } from "./store-mappers";

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
