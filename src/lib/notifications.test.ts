// The bell's rules are eligibility and ordering, not looks — so these assert
// exactly which requests produce a row and in what order.

import { describe, expect, it } from "vitest";
import { ESCALATION_WINDOW_HOURS } from "./derive";
import {
  type NotificationLabels,
  notificationId,
  pendingDecisions,
  pruneReadIds,
} from "./notifications";
import type { MaintenanceRequest } from "./types";

const NOW = new Date("2026-09-20T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const labels: NotificationLabels = {
  buildingName: (id) => `B:${id}`,
  roomLabel: (id) => `R:${id}`,
};

function req(
  id: string,
  over: Partial<MaintenanceRequest> = {},
): MaintenanceRequest {
  return {
    id,
    buildingId: "b216",
    roomId: "r-302",
    equipmentId: "EQ-1",
    issue: "Projector will not power on",
    priority: "normal",
    status: "requested",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
    ...over,
  };
}

const ids = (rs: MaintenanceRequest[], read: string[] = []) =>
  pendingDecisions(rs, read, labels, NOW).map((n) => n.id);

describe("which requests produce a notification", () => {
  it("asks for a decision on requested and resolved", () => {
    expect(ids([req("A"), req("B", { status: "resolved" })])).toEqual([
      "approve:A",
      "close-out:B",
    ]);
  });

  it("says nothing about work already in hand or finished", () => {
    // Nobody owes a decision on these, so they are not the bell's business.
    expect(
      ids([
        req("C", { status: "approved" }),
        req("D", { status: "in-progress" }),
        req("E", { status: "completed" }),
      ]),
    ).toEqual([]);
  });

  it("ignores a withdrawn request even while it says requested", () => {
    expect(ids([req("F", { withdrawn: true })])).toEqual([]);
    expect(notificationId(req("F", { withdrawn: true }))).toBeNull();
  });
});

describe("ordering", () => {
  it("puts the longest wait first", () => {
    expect(
      ids([
        req("NEW", { submittedAt: hoursAgo(1) }),
        req("OLD", { submittedAt: hoursAgo(9) }),
      ]),
    ).toEqual(["approve:OLD", "approve:NEW"]);
  });

  it("puts anything escalated above everything else", () => {
    // An escalated request is high priority, open, and past the window — it
    // jumps a request that has technically waited longer.
    const escalated = req("HOT", {
      priority: "high",
      submittedAt: hoursAgo(ESCALATION_WINDOW_HOURS + 1),
    });
    const older = req("OLD", { submittedAt: hoursAgo(500) });
    const result = pendingDecisions([older, escalated], [], labels, NOW);
    expect(result.map((n) => n.id)).toEqual(["approve:HOT", "approve:OLD"]);
    expect(result[0].escalated).toBe(true);
    expect(result[0].tone).toBe("danger");
  });
});

describe("what a row says", () => {
  it("names the action and where it is", () => {
    const [n] = pendingDecisions([req("A")], [], labels, NOW);
    expect(n.title).toBe("Approve A");
    expect(n.detail).toBe("B:b216 / R:r-302 — Projector will not power on");
    expect(n.tone).toBe("warning");
  });

  it("says when the submitter is waiting on a close-out", () => {
    const [n] = pendingDecisions(
      [req("B", { status: "resolved", verificationRequested: true })],
      [],
      labels,
      NOW,
    );
    expect(n.title).toBe("Close out B");
    expect(n.detail).toContain("Hnin Nwe says this looks done");
    expect(n.tone).toBe("info");
  });

  it("dates a close-out from when it was resolved, not raised", () => {
    const [n] = pendingDecisions(
      [
        req("B", {
          status: "resolved",
          submittedAt: hoursAgo(100),
          updatedAt: hoursAgo(3),
        }),
      ],
      [],
      labels,
      NOW,
    );
    expect(n.at).toBe(hoursAgo(3));
  });
});

describe("read state", () => {
  it("marks the ids it is given and leaves the rest alone", () => {
    const result = pendingDecisions(
      [req("A"), req("B", { status: "resolved" })],
      ["approve:A"],
      labels,
      NOW,
    );
    expect(result.find((n) => n.id === "approve:A")?.read).toBe(true);
    expect(result.find((n) => n.id === "close-out:B")?.read).toBe(false);
  });

  it("drops a read id once its decision is no longer pending", () => {
    // Approving a request ends that decision. Keeping its id would grow the
    // stored list forever and would wrongly silence a later one.
    const pending = pendingDecisions([req("B")], [], labels, NOW);
    expect(pruneReadIds(["approve:A", "approve:B"], pending)).toEqual([
      "approve:B",
    ]);
  });

  it("makes a request unread again when it is sent back", () => {
    // Declining holds the status at requested, so the id is the same — but
    // pruning happened while it was approved, so nothing silences it.
    const sentBack = pendingDecisions([req("A")], [], labels, NOW);
    expect(sentBack[0].read).toBe(false);
  });
});
