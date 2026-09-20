"use client";

// Maintenance requests.
//
// `createdRequests`, `requestPatches` and the withdrawn filter all collapse
// into fields here. `withdrawn` stays a field rather than a delete: pulling a
// request back is a thing that happened, and its Log Book entry has to still
// resolve.

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
 * Removes a field rather than leaving it alone.
 *
 * With `ignoreUndefinedProperties`, sending `undefined` *skips* a field — it
 * does not clear it. Approving must clear the decline note, and `undefined`
 * would quietly leave it there to be read.
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
