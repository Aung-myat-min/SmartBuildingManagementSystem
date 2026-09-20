"use client";

// Photos, for any collection that has one.
//
// Stored at `{collection}/{id}/media/photo` rather than on the document
// itself: on the document, every subscriber downloads every photo on the
// first snapshot and re-downloads one whenever any other field changes — a
// condition flip would re-send the image. In a subcollection they are fetched
// once, when something opens.
//
// The bytes are a base64 JPEG, so the size rules in lib/photo.ts are what
// keep a document under Firestore's 1 MiB cap.

import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type WriteResult, writeError } from "@/lib/firestore-store";

/** Exposed so a batch delete can take the photo with the document. */
export function photoRef(collection: string, id: string) {
  return doc(db, collection, id, "media", "photo");
}

/** Null when there is no photo — the ordinary case, not an error. */
export async function readPhoto(
  collection: string,
  id: string,
): Promise<string | null> {
  try {
    const snap = await getDoc(photoRef(collection, id));
    return snap.exists() ? ((snap.data().dataUrl as string) ?? null) : null;
  } catch {
    return null;
  }
}

export async function writePhoto(
  collection: string,
  id: string,
  dataUrl: string,
): Promise<WriteResult> {
  try {
    await setDoc(photoRef(collection, id), {
      dataUrl,
      at: new Date().toISOString(),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}

export async function deletePhoto(
  collection: string,
  id: string,
): Promise<WriteResult> {
  try {
    await deleteDoc(photoRef(collection, id));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: writeError(error) };
  }
}
