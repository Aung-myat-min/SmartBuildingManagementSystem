"use client";

// ============================================================================
// Maintenance requests — the highest-traffic collection, and the last to move.
//
// Three session structures collapse into fields here: `createdRequests` (a
// list in front of the seed), `requestPatches` (an override per request) and
// the withdrawn filter. `withdrawn` stays a field rather than becoming a
// delete: a request pulled back before approval is a thing that happened, and
// the Log Book entry recording it has to still resolve.
// ============================================================================

import {
  collection,
  deleteField,
  doc,
  type FieldValue,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  useLiveCollection,
  type WriteResult,
  writeError,
} from "@/lib/firestore-store";
import { toRequest } from "@/lib/store-mappers";
import type { MaintenanceRequest } from "@/lib/types";

export function useRequests() {
  return useLiveCollection(
    collection(db, COLLECTIONS.requests),
    toRequest,
    // Newest first, which is how every surface in the app reads them. Sorted
    // here rather than at the query so the id ordering cannot fight a
    // `where` the UI might grow later.
    (a, b) => b.submittedAt.localeCompare(a.submittedAt),
  );
}

export async function createRequest(
  request: MaintenanceRequest,
): Promise<WriteResult> {
  try {
    const { id, ...data } = request;
    await setDoc(doc(db, COLLECTIONS.requests, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/**
 * The sentinel for a field being removed rather than left alone.
 *
 * Firestore is configured with `ignoreUndefinedProperties`, so sending
 * `undefined` *skips* the field — it does not clear it. Approving a request
 * has to clear the note that sent it back, and passing `undefined` would have
 * quietly left it there for its submitter to keep reading.
 */
export const CLEAR: FieldValue = deleteField();

export async function patchRequestWrite(
  id: string,
  patch: Partial<Record<keyof Omit<MaintenanceRequest, "id">, unknown>>,
): Promise<WriteResult> {
  try {
    await updateDoc(doc(db, COLLECTIONS.requests, id), patch);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}
