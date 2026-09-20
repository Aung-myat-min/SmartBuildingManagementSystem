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
} from "firebase/firestore";
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
