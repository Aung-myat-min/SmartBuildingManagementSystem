// What belongs in the Historical Record, and what is only ever a log line.
//
// The Log Book is the raw feed: every status tick, every edit, every sensor
// crossing a band, newest first. The Historical Record is the part of that
// feed somebody would look up months later — a decision, a refusal, an alarm,
// something destroyed. Both read the same `logBook` collection, because an
// audit trail with two sources is an audit trail that can disagree with
// itself; they differ only in what they let through.
//
// Pure, and tested, for the same reason `derive.ts` is: "was this recorded?"
// is a question the answer to which has to be the same every time it is asked.

import type { LogActionType, LogBookEntry } from "@/lib/types";

/**
 * Entries about people rather than the estate. Office Staff can reach the
 * Historical Record and cannot reach the Log Book, so who was hired, promoted
 * or suspended — and who changed their password — never surfaces there.
 */
const PERSONNEL: LogActionType[] = [
  "user-added",
  "user-edited",
  "user-role-changed",
  "user-status-changed",
  "password-changed",
];

/**
 * Actions that are significant whatever else they carry: something was
 * refused, retired or destroyed, and the estate is different afterwards.
 *
 * Deliberately not a list of equipment actions. `removeUnit` and a routine
 * condition change both log `equipment-status-changed`, so the action type
 * cannot tell them apart — what tells them apart is that one of them had to be
 * justified, which `reason` answers below.
 */
const ALWAYS_SIGNIFICANT: LogActionType[] = [
  "request-declined",
  "request-withdrawn",
  "building-deleted",
  "room-removed",
  "sensor-type-archived",
  "equipment-type-archived",
];

/** Whether this entry may appear in the Historical Record at all. */
export function isEstateRecord(entry: LogBookEntry): boolean {
  return !PERSONNEL.includes(entry.actionType);
}

/**
 * Whether this is one of the entries the Historical Record exists for.
 *
 * Three things qualify, in the order they are worth reading:
 *
 * 1. **It carries a reason.** Somebody was made to justify the action before
 *    the app would do it. That is the strongest possible signal that it
 *    matters, and it is the signal the app already collects.
 * 2. **It is an alarm.** A fire detector triggering is the estate's record
 *    whether or not anyone acted on it.
 * 3. **It is in the list above** — refused, withdrawn, deleted, archived.
 */
export function isSignificant(entry: LogBookEntry): boolean {
  if (entry.reason && entry.reason.trim().length > 0) return true;
  if (entry.source === "alert") return true;
  return ALWAYS_SIGNIFICANT.includes(entry.actionType);
}
