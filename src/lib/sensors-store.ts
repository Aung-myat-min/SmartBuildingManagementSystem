"use client";

// The device list.
//
// A sensor's id is its document id — FD-216-14, printed on the device and
// written into the unit's `linkedEquipmentId`. So the id is frozen once
// registered: renaming means delete-and-create, and the equipment link would
// point at nothing in between.
//
// `status` and `statusChangedAt` always move together: a tone that changes
// with age is measured from the stamp, so a status written without one could
// arrive already stale.

import {
  collection,
  deleteDoc,
  doc,
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
import { toSensor } from "@/lib/store-mappers";
import type { EnvironmentalSensor } from "@/lib/types";

export function useSensors() {
  return useLiveCollection(
    collection(db, COLLECTIONS.sensors),
    toSensor,
    (a, b) => a.id.localeCompare(b.id),
  );
}

export async function createSensor(
  sensor: EnvironmentalSensor,
): Promise<WriteResult> {
  try {
    const { id, ...data } = sensor;
    await setDoc(doc(db, COLLECTIONS.sensors, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/** Registration only — the id is not among the fields a caller can send. */
export async function updateSensor(
  sensorId: string,
  patch: Partial<Omit<EnvironmentalSensor, "id">>,
): Promise<WriteResult> {
  try {
    await updateDoc(doc(db, COLLECTIONS.sensors, sensorId), patch);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/** The two fields that only ever change together. */
export async function writeSensorStatus(
  sensorId: string,
  status: string,
  at: string,
): Promise<WriteResult> {
  return updateSensor(sensorId, {
    status,
    statusChangedAt: at,
    updatedAt: at,
  });
}

/** Off the network for good — which is what the confirm copy already says. */
export async function deleteSensor(sensorId: string): Promise<WriteResult> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.sensors, sensorId));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}
