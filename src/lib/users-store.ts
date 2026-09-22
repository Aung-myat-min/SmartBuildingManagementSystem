"use client";

// The `users` collection — the one thing in this app that is not mock data.
//
// Administration reads it live rather than holding a copy, which also closes
// the documented gap that account edits used to be page-local: a role change
// here reaches the signed-in person's own session through the subscription in
// lib/auth.tsx, without a reload.

import { deleteApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
  updateDoc,
} from "firebase/firestore";
import * as React from "react";
import { authErrorMessage } from "@/lib/auth-errors";
import { auth, db, provisionerApp } from "@/lib/firebase";
import { writeError } from "@/lib/firestore-store";
import type { ManagedUser, UserRole } from "@/lib/types";

export type UserResult = { ok: true } | { ok: false; message: string };

interface UserDocData {
  email?: string;
  name?: string;
  role?: UserRole;
  buildingId?: string | null;
  phone?: string | null;
  legacyUid?: string | null;
  status?: "active" | "suspended";
  lastActiveAt?: Timestamp;
}

/** ISO at the boundary, so no screen ever handles a Firestore Timestamp. */
function toManagedUser(id: string, data: UserDocData): ManagedUser {
  return {
    uid: id,
    email: data.email ?? "",
    name: data.name ?? "",
    role: data.role ?? "office-staff",
    buildingId: data.buildingId ?? undefined,
    phone: data.phone ?? undefined,
    legacyUid: data.legacyUid ?? undefined,
    status: data.status ?? "active",
    lastActiveAt: data.lastActiveAt?.toDate().toISOString() ?? "",
  };
}

export function useUsers(): {
  users: ManagedUser[];
  loading: boolean;
  error: string | null;
} {
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(
          snap.docs
            .map((d) => toManagedUser(d.id, d.data() as UserDocData))
            // Newest-looking first is meaningless here; name order is what an
            // administrator scans by.
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setLoading(false);
        setError(null);
      },
      (cause) => {
        setLoading(false);
        setError(
          cause.code === "permission-denied"
            ? "You do not have access to the account list."
            : "Could not load accounts. Check your connection.",
        );
      },
    );
    return unsubscribe;
  }, []);

  return { users, loading, error };
}

export async function updateUser(
  uid: string,
  patch: Partial<
    Pick<ManagedUser, "name" | "phone" | "role" | "buildingId" | "status">
  >,
): Promise<UserResult> {
  try {
    await updateDoc(doc(db, "users", uid), {
      ...patch,
      // Office Staff are the only role scoped to a building; anything else
      // must clear it, or a promotion would leave a stale scope behind.
      ...(patch.role !== undefined
        ? {
            buildingId:
              patch.role === "office-staff" ? (patch.buildingId ?? null) : null,
          }
        : {}),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: accountError(error) };
  }
}

export function setUserStatus(
  uid: string,
  status: ManagedUser["status"],
): Promise<UserResult> {
  return updateUser(uid, { status });
}

/**
 * Creates the Auth record and its profile without disturbing the signed-in
 * administrator.
 *
 * createUserWithEmailAndPassword signs you in as whoever it just created, so
 * it runs on a second, isolated instance. The profile is written through the
 * PRIMARY one, carrying the admin's token — through the secondary, the rules
 * would see a new account writing its own role. The account starts on
 * INITIAL_PASSWORD and is also sent a reset link, so it is usable whether or
 * not the email arrives.
 */
export async function createUser(input: {
  email: string;
  name: string;
  role: UserRole;
  buildingId?: string;
}): Promise<UserResult & { uid?: string }> {
  let secondary: FirebaseApp | undefined;
  try {
    secondary = provisionerApp();
    const secondaryAuth = getAuth(secondary);
    // A named app already uses its own storage key; in-memory makes it
    // impossible for the provisioning credential to reach IndexedDB at all.
    await setPersistence(secondaryAuth, inMemoryPersistence);

    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim(),
      INITIAL_PASSWORD,
    );

    await setDoc(doc(db, "users", cred.user.uid), {
      email: input.email.trim(),
      name: input.name.trim(),
      role: input.role,
      buildingId:
        input.role === "office-staff" ? (input.buildingId ?? null) : null,
      legacyUid: null,
      status: "active",
      lastActiveAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    await sendPasswordResetEmail(auth, input.email.trim());
    return { ok: true, uid: cred.user.uid };
  } catch (error) {
    return { ok: false, message: accountError(error) };
  } finally {
    if (secondary) {
      await signOut(getAuth(secondary)).catch(() => {});
      await deleteApp(secondary).catch(() => {});
    }
  }
}

/**
 * What a new account can sign in with straight away.
 *
 * This used to be long, random and thrown away, so the reset link was the only
 * way in — which meant an account whose email never arrived could never be
 * used at all. A known starting password means an administrator can hand it
 * over and the person is in.
 *
 * The cost is real and worth stating: anyone who knows this string can sign in
 * as any account that has not yet changed it. The reset email still goes out,
 * and the sooner it is used the better.
 */
export const INITIAL_PASSWORD = "SmartPassword!";

/**
 * Account writes can fail as Firestore writes *or* as Auth operations — the
 * provisioning path does both — so an `auth/` code keeps its own wording
 * ("an account already uses that email") rather than the generic one.
 */
function accountError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return code.startsWith("auth/") ? authErrorMessage(error) : writeError(error);
}
