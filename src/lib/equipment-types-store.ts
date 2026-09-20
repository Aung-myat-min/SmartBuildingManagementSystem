"use client";

// The equipment type registry — the asset half of what sensor-types-store.ts
// does for devices, and deliberately the same shape so the two cannot drift.
//
// Archiving rather than deleting, for the same reason: a unit naming a retired
// type has to keep resolving its label, and the reliability and cost reports
// group by type across periods that may predate the retirement.

import { collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  useLiveCollection,
  type WriteResult,
  writeError,
} from "@/lib/firestore-store";
import { toEquipmentType } from "@/lib/store-mappers";
import type { EquipmentTypeDef } from "@/lib/types";

export function useEquipmentTypes() {
  return useLiveCollection(
    collection(db, COLLECTIONS.equipmentTypes),
    toEquipmentType,
    (a, b) => a.label.localeCompare(b.label),
  );
}

export async function writeEquipmentType(
  type: EquipmentTypeDef,
): Promise<WriteResult> {
  try {
    const { id, ...data } = type;
    await setDoc(doc(db, COLLECTIONS.equipmentTypes, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/** Only for a type nothing has ever used; the product archives otherwise. */
export async function deleteEquipmentType(
  typeId: string,
): Promise<WriteResult> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.equipmentTypes, typeId));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}
