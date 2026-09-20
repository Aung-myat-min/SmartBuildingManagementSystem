"use client";

// Buildings and rooms.
//
// One module for two collections because they are one domain and the writes
// cross: deleting a building takes its rooms with it, in a batch, so the two
// cannot half-happen.

import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  useLiveCollection,
  type WriteResult,
  writeError,
} from "@/lib/firestore-store";
import {
  deletePhoto as deleteMedia,
  readPhoto as readMedia,
  writePhoto as writeMedia,
} from "@/lib/media-store";
import { toBuilding, toRoom } from "@/lib/store-mappers";
import type { Building, Room } from "@/lib/types";

const byName = (a: Building, b: Building) => a.name.localeCompare(b.name);

export function useBuildings() {
  return useLiveCollection(
    collection(db, COLLECTIONS.buildings),
    toBuilding,
    byName,
  );
}

export function useRooms() {
  return useLiveCollection(collection(db, COLLECTIONS.rooms), toRoom);
}

export async function createBuilding(building: Building): Promise<WriteResult> {
  try {
    const { id, ...data } = building;
    await setDoc(doc(db, COLLECTIONS.buildings, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

export async function updateBuilding(building: Building): Promise<WriteResult> {
  try {
    const { id, ...data } = building;
    await updateDoc(doc(db, COLLECTIONS.buildings, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

/**
 * Deletes the building and the rooms in it, atomically.
 *
 * The caller decides *whether* it may be deleted — `buildingDeletionRefusal`
 * in estate-rules.ts — because that question needs equipment, sensors and
 * requests, and this module has no business knowing about them.
 */
export async function deleteBuildingWithRooms(
  buildingId: string,
  roomIds: string[],
): Promise<WriteResult> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.buildings, buildingId));
    for (const roomId of roomIds) {
      batch.delete(doc(db, COLLECTIONS.rooms, roomId));
    }
    await batch.commit();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

export async function createRoom(room: Room): Promise<WriteResult> {
  try {
    const { id, ...data } = room;
    await setDoc(doc(db, COLLECTIONS.rooms, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

export async function updateRoom(room: Room): Promise<WriteResult> {
  try {
    const { id, ...data } = room;
    await updateDoc(doc(db, COLLECTIONS.rooms, id), data);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

export async function deleteRoom(roomId: string): Promise<WriteResult> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.rooms, roomId));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

// Photos, the same shape as an equipment unit's.

export const readBuildingPhoto = (buildingId: string) =>
  readMedia(COLLECTIONS.buildings, buildingId);
export const writeBuildingPhoto = (buildingId: string, dataUrl: string) =>
  writeMedia(COLLECTIONS.buildings, buildingId, dataUrl);
export const deleteBuildingPhoto = (buildingId: string) =>
  deleteMedia(COLLECTIONS.buildings, buildingId);
