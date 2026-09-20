"use client";

// The sensor type registry.
//
// Statuses and actions stay nested arrays on the type's own document, not
// subcollections: they are small, always read and written together, and the
// validation in app-state.tsx judges a whole type at once. That validation
// stays there — it is pure and it has to answer before the write.

import { collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  useLiveCollection,
  type WriteResult,
  writeError,
} from "@/lib/firestore-store";
import { toSensorType } from "@/lib/store-mappers";
import type { SensorTypeDef } from "@/lib/types";

export function useSensorTypes() {
  return useLiveCollection(
    collection(db, COLLECTIONS.sensorTypes),
    toSensorType,
    (a, b) => a.label.localeCompare(b.label),
  );
}

/** Creates or replaces a type whole — the unit the validation works in. */
export async function writeSensorType(
  type: SensorTypeDef,
): Promise<WriteResult> {
  try {
    const { id, ...data } = type;
    await setDoc(doc(db, COLLECTIONS.sensorTypes, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/**
 * Only reachable for a type nothing uses — the product archives rather than
 * deletes, so that a sensor naming a retired type still resolves its label.
 */
export async function deleteSensorType(typeId: string): Promise<WriteResult> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.sensorTypes, typeId));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}
