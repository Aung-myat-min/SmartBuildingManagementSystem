"use client";

// The asset register and its history.
//
// One module for two collections because every write crosses them: a service
// moves the unit's dates *and* appends the row saying so, and deleting a unit
// takes its history with it.
//
// Photos live at `equipmentUnits/{id}/media/photo`, not on the unit — on the
// unit every subscriber would download every photo on first snapshot, and a
// condition flip would re-send the image.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  useLiveCollection,
  type WriteResult,
  writeError,
} from "@/lib/firestore-store";
import { toEquipmentHistory, toEquipmentUnit } from "@/lib/store-mappers";
import type { EquipmentHistoryEvent, EquipmentUnit } from "@/lib/types";

/** The history only grows, so the ceiling is applied at the query. */
export const HISTORY_PAGE_SIZE = 200;

export function useEquipmentUnits() {
  return useLiveCollection(
    collection(db, COLLECTIONS.equipmentUnits),
    toEquipmentUnit,
    (a, b) => a.tag.localeCompare(b.tag),
  );
}

export function useEquipmentHistory() {
  return useLiveCollection(
    query(
      collection(db, COLLECTIONS.equipmentHistory),
      orderBy("at", "desc"),
      limit(HISTORY_PAGE_SIZE),
    ),
    toEquipmentHistory,
  );
}

export async function createUnit(unit: EquipmentUnit): Promise<WriteResult> {
  try {
    const { id, ...data } = unit;
    await setDoc(doc(db, COLLECTIONS.equipmentUnits, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/** The id is not among the fields a caller can send: it is the join key. */
export async function updateUnit(
  unitId: string,
  patch: Partial<Omit<EquipmentUnit, "id">>,
): Promise<WriteResult> {
  try {
    await updateDoc(doc(db, COLLECTIONS.equipmentUnits, unitId), patch);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/**
 * Deletes the unit, its history and its photo together.
 *
 * The confirm says "its Log Book and Historical Records entries stay — only
 * the asset record goes", and the history *is* the asset record: rows about
 * a unit that no longer exists are unreachable, not preserved.
 */
export async function deleteUnitWithHistory(
  unitId: string,
): Promise<WriteResult> {
  try {
    const rows = await getDocs(
      query(
        collection(db, COLLECTIONS.equipmentHistory),
        where("equipmentUnitId", "==", unitId),
      ),
    );
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.equipmentUnits, unitId));
    for (const row of rows.docs) batch.delete(row.ref);
    batch.delete(photoRef(unitId));
    await batch.commit();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

export async function appendHistory(
  event: Omit<EquipmentHistoryEvent, "id">,
): Promise<WriteResult> {
  try {
    await addDoc(collection(db, COLLECTIONS.equipmentHistory), event);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/**
 * Moves the unit's service dates and appends the row that explains them, as
 * one batch. Half of this landing would leave a register nobody can audit.
 */
export async function recordServiceWrite(
  unitId: string,
  dates: { lastServiceAt: string; nextServiceDue: string },
  event: Omit<EquipmentHistoryEvent, "id">,
): Promise<WriteResult> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.equipmentUnits, unitId), dates);
    batch.set(doc(collection(db, COLLECTIONS.equipmentHistory)), event);
    await batch.commit();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/** Same reason as a service: the move and the row that records it are one. */
export async function moveUnitWrite(
  unitId: string,
  location: { buildingId: string; roomId: string },
  event: Omit<EquipmentHistoryEvent, "id">,
): Promise<WriteResult> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.equipmentUnits, unitId), location);
    batch.set(doc(collection(db, COLLECTIONS.equipmentHistory)), event);
    await batch.commit();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

// Photos

function photoRef(unitId: string) {
  return doc(db, COLLECTIONS.equipmentUnits, unitId, "media", "photo");
}

/** Null when the unit has no photo — the ordinary case, not an error. */
export async function readPhoto(unitId: string): Promise<string | null> {
  try {
    const snap = await getDoc(photoRef(unitId));
    return snap.exists() ? ((snap.data().dataUrl as string) ?? null) : null;
  } catch {
    return null;
  }
}

export async function writePhoto(
  unitId: string,
  dataUrl: string,
): Promise<WriteResult> {
  try {
    await setDoc(photoRef(unitId), { dataUrl, at: new Date().toISOString() });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

export async function deletePhoto(unitId: string): Promise<WriteResult> {
  try {
    await deleteDoc(photoRef(unitId));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}
