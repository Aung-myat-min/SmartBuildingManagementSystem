// What is waiting for a decision.
//
// The bell means one thing: a request needs an approver to act. Two statuses
// qualify, and they are the two forward steps only an approver can take —
// `requested` needs letting onto the board, `resolved` needs signing off.
// In-progress work, withdrawn requests and sensor states are not decisions
// anyone owes, so they are not here.
//
// Derived rather than stored, and pure like derive.ts. A stored notification
// could disagree with the request it describes — approve one and the row would
// still be sitting there. Deriving makes the item last exactly as long as the
// decision is outstanding.

import { isEscalated } from "@/lib/derive";
import type { MaintenanceRequest } from "@/lib/types";

export type NotificationTone = "danger" | "warning" | "info" | "neutral";

export interface Notification {
  /** Stable and derived, e.g. "approve:REQ-4185". Keys the read state. */
  id: string;
  kind: "approve" | "close-out";
  requestId: string;
  tone: NotificationTone;
  title: string;
  detail: string;
  /** When it started waiting. */
  at: string;
  escalated: boolean;
  read: boolean;
}

/** Labels are injected, so this module imports no data. */
export interface NotificationLabels {
  roomLabel: (roomId: string) => string;
  buildingName: (buildingId: string) => string;
}

export function notificationId(r: MaintenanceRequest): string | null {
  if (r.withdrawn) return null;
  if (r.status === "requested") return `approve:${r.id}`;
  if (r.status === "resolved") return `close-out:${r.id}`;
  return null;
}

export function pendingDecisions(
  requests: MaintenanceRequest[],
  readIds: string[],
  labels: NotificationLabels,
  now = Date.now(),
): Notification[] {
  const read = new Set(readIds);
  const out: Notification[] = [];

  for (const r of requests) {
    const id = notificationId(r);
    if (!id) continue;
    // isEscalated takes the status second and the clock third.
    const escalated = isEscalated(r, r.status, now);
    const where = `${labels.buildingName(r.buildingId)} / ${labels.roomLabel(r.roomId)}`;

    if (r.status === "requested") {
      out.push({
        id,
        kind: "approve",
        requestId: r.id,
        tone: escalated ? "danger" : "warning",
        title: `Approve ${r.id}`,
        detail: `${where} — ${r.issue}`,
        at: r.submittedAt,
        escalated,
        read: read.has(id),
      });
      continue;
    }

    // Resolved. Its submitter saying the work looks done is someone actively
    // waiting on you, so the row says which.
    out.push({
      id,
      kind: "close-out",
      requestId: r.id,
      tone: "info",
      title: `Close out ${r.id}`,
      detail: r.verificationRequested
        ? `${where} — ${r.submittedByName} says this looks done`
        : `${where} — ${r.issue}`,
      at: r.updatedAt,
      escalated,
      read: read.has(id),
    });
  }

  // A work queue, not a feed: what has waited longest, and anything escalated
  // ahead of everything else.
  return out.sort(
    (a, b) =>
      Number(b.escalated) - Number(a.escalated) || a.at.localeCompare(b.at),
  );
}

/**
 * The read ids worth keeping.
 *
 * Without this the stored list grows forever. Pruning also means a request
 * sent back to `requested` after being declined shows as unread again, which
 * is right — it is a new decision.
 */
export function pruneReadIds(
  readIds: string[],
  pending: Notification[],
): string[] {
  const live = new Set(pending.map((n) => n.id));
  return readIds.filter((id) => live.has(id));
}
