"use client";

// ============================================================================
// The sensor type registry.
//
// A type's statuses and actions stay nested arrays on its own document rather
// than becoming subcollections: they are small, always read together and
// always written together, and the validation in app-state.tsx checks a whole
// type at once — splitting them would break that for nothing.
//
// The validation itself stays where it is. It is pure, it already returns the
// refusal the form shows, and it has to answer before a write rather than
// after one.
// ============================================================================

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
