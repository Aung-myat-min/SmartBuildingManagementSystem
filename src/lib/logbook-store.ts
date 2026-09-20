"use client";

// The Log Book — the first collection to leave memory, and deliberately the
// smallest: append-only, one writer, no merge, no override, nothing points at
// it. What it buys immediately is that every later stage of the migration is
// observable in a trail that survives a reload.

import {
  addDoc,
  collection,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import * as React from "react";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  useLiveCollection,
  type WriteResult,
  writeError,
} from "@/lib/firestore-store";
import { toLogEntry } from "@/lib/store-mappers";
import type { LogBookEntry } from "@/lib/types";

/**
 * The book only grows. The Log Book page and the dashboard rail both read the
 * whole list, so the ceiling is applied at the query rather than left for a
 * page to remember — and the page's own date filter runs over what arrives.
 */
export const LOG_BOOK_PAGE_SIZE = 200;

/** What a caller supplies; the actor, time and id are the book's business. */
export type LogDraft = Omit<
  LogBookEntry,
  "id" | "timestamp" | "actorUid" | "actorName" | "actorRole"
> & {
  /** For entries the system writes for itself, e.g. the sensor network. */
  actorName?: string;
};

export function useLogBook(): {
  items: LogBookEntry[];
  loading: boolean;
  error: string | null;
} {
  const q = query(
    collection(db, COLLECTIONS.logBook),
    orderBy("timestamp", "desc"),
    limit(LOG_BOOK_PAGE_SIZE),
  );
  return useLiveCollection(q, toLogEntry);
}

/** The ceiling for the long-range view, which reaches further back. */
export const LOG_HISTORY_PAGE_SIZE = 500;

/** How far back the long-range view subscribes. Narrower ranges filter this. */
export const LOG_HISTORY_DAYS = 90;

/**
 * The same book over a long range rather than the last 200 entries.
 *
 * Historical Records is a long-range ledger and `limit(200)` will not cover
 * 90 days once the app is in use, so it gets its own subscription. The
 * `where` and the `orderBy` are on the same field, so this needs no composite
 * index and firestore.indexes.json stays empty.
 *
 * The cutoff is pinned at mount rather than recomputed: useLiveCollection
 * subscribes once by design, so a moving cutoff would be a query nobody ever
 * re-runs. The page's 7d / 30d buttons filter what arrives, the way every
 * other filter in this app does.
 */
export function useLogHistory(): {
  items: LogBookEntry[];
  loading: boolean;
  error: string | null;
} {
  const [since] = React.useState(
    () => new Date(Date.now() - LOG_HISTORY_DAYS * 86400000),
  );
  const q = query(
    collection(db, COLLECTIONS.logBook),
    where("timestamp", ">=", Timestamp.fromDate(since)),
    orderBy("timestamp", "desc"),
    limit(LOG_HISTORY_PAGE_SIZE),
  );
  return useLiveCollection(q, toLogEntry);
}

/**
 * Appends one entry. Fire-and-forget by design: an audit side effect must
 * never block the action that caused it or raise an error of its own, so the
 * caller gets a result it is free to ignore.
 */
export async function appendLogEntry(
  draft: LogDraft,
  actor: { uid: string; name: string; role: string },
): Promise<WriteResult> {
  const system = Boolean(draft.actorName);
  try {
    await addDoc(collection(db, COLLECTIONS.logBook), {
      ...draft,
      timestamp: serverTimestamp(),
      // A system entry is not attributable to a person, so it carries no uid
      // or role rather than borrowing whoever happened to be signed in.
      actorUid: system ? undefined : actor.uid,
      actorName: draft.actorName ?? actor.name,
      actorRole: system ? undefined : actor.role,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}
