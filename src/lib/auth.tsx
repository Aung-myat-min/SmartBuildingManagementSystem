"use client";

// ============================================================================
// The signed-in identity. The only module that imports `firebase/auth`.
//
// It is deliberately separate from app-state.tsx and mounted above it: the
// /login screens need an identity and have no AppState at all, and AppState
// needs a resolved role before it can do anything. Being authenticated is not
// the same as being signed in here — the app has no usable identity until the
// user's role is known, because every page reads it.
// ============================================================================

import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
  updatePassword,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import * as React from "react";
import { authErrorMessage } from "@/lib/auth-errors";
import { auth, db } from "@/lib/firebase";
import type { AppUser, UserRole } from "@/lib/types";

/**
 * One discriminated field rather than a set of booleans: the route guard and
 * the login redirect both switch on it, and any two-boolean encoding produces
 * a frame of the wrong screen between them.
 */
export type AuthStatus =
  | "loading"
  | "signed-out"
  | "signed-in"
  /** Authenticated, but no users/{uid} document — a half-finished creation. */
  | "no-profile"
  | "suspended";

export type AuthResult = { ok: true } | { ok: false; message: string };

export interface AuthState {
  status: AuthStatus;
  user: AppUser | null;
  /** Only for reauthenticate/updatePassword; screens should read `user`. */
  firebaseUser: User | null;
  /** Survives the sign-out, so the session-expired screen can name them. */
  lastEmail: string | null;
  signIn: (
    email: string,
    password: string,
    keepSignedIn: boolean,
  ) => Promise<AuthResult>;
  signOutNow: () => Promise<void>;
  sendReset: (email: string) => Promise<AuthResult>;
  changePassword: (current: string, next: string) => Promise<AuthResult>;
}

const AuthContext = React.createContext<AuthState | null>(null);

interface ProfileDoc {
  email?: string;
  name?: string;
  role?: UserRole;
  buildingId?: string | null;
  legacyUid?: string | null;
  status?: "active" | "suspended";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = React.useState<User | null>(null);
  const [lastEmail, setLastEmail] = React.useState<string | null>(null);
  // The sign-in stamp writes once per session, not on every snapshot — the
  // write produces a snapshot, which would otherwise write again forever.
  const stampedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setFirebaseUser(fbUser);

      if (!fbUser) {
        setUser(null);
        stampedFor.current = null;
        setStatus((prev) => (prev === "loading" ? "signed-out" : prev));
        return;
      }

      setLastEmail(fbUser.email);
      setStatus("loading");

      // A live subscription rather than a one-shot read: a role change or a
      // suspension has to take effect without waiting for a re-login, and
      // Administration writes to this same collection.
      unsubscribeProfile = onSnapshot(
        doc(db, "users", fbUser.uid),
        (snap) => {
          if (!snap.exists()) {
            setUser(null);
            setStatus("no-profile");
            void signOut(auth);
            return;
          }

          const data = snap.data() as ProfileDoc;

          if (data.status === "suspended") {
            setUser(null);
            setStatus("suspended");
            void signOut(auth);
            return;
          }

          setUser({
            uid: snap.id,
            email: data.email ?? fbUser.email ?? "",
            name: data.name ?? fbUser.displayName ?? "",
            role: data.role ?? "office-staff",
            // Normalised here so a stale field can never scope a CEO.
            buildingId:
              data.role === "office-staff"
                ? (data.buildingId ?? undefined)
                : undefined,
            legacyUid: data.legacyUid ?? undefined,
          });
          setStatus("signed-in");

          if (stampedFor.current !== fbUser.uid) {
            stampedFor.current = fbUser.uid;
            // Best-effort. The rules allow only this field on your own row,
            // and a refusal must not block signing in.
            void updateDoc(doc(db, "users", fbUser.uid), {
              lastActiveAt: serverTimestamp(),
            }).catch(() => {});
          }
        },
        () => {
          // permission-denied is what a rules-level suspension looks like from
          // here, so it lands in the same place rather than needing a second
          // mechanism.
          setUser(null);
          setStatus("suspended");
          void signOut(auth);
        },
      );
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const signIn = React.useCallback(
    async (email: string, password: string, keepSignedIn: boolean) => {
      try {
        // Must precede the sign-in call, or the credential lands in whichever
        // store was configured last.
        await setPersistence(
          auth,
          keepSignedIn ? browserLocalPersistence : browserSessionPersistence,
        );
        await signInWithEmailAndPassword(auth, email.trim(), password);
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, message: authErrorMessage(error) };
      }
    },
    [],
  );

  const signOutNow = React.useCallback(async () => {
    stampedFor.current = null;
    await signOut(auth);
    setStatus("signed-out");
  }, []);

  const sendReset = React.useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true as const };
    } catch (error) {
      // An unknown address must look identical to a known one, or this becomes
      // a way to test whether somebody has an account.
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (code === "auth/user-not-found") return { ok: true as const };
      return { ok: false as const, message: authErrorMessage(error) };
    }
  }, []);

  const changePassword = React.useCallback(
    async (current: string, next: string) => {
      const fbUser = auth.currentUser;
      if (!fbUser?.email) {
        return { ok: false as const, message: "You are not signed in." };
      }
      try {
        await reauthenticateWithCredential(
          fbUser,
          EmailAuthProvider.credential(fbUser.email, current),
        );
        await updatePassword(fbUser, next);
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, message: authErrorMessage(error) };
      }
    },
    [],
  );

  const value = React.useMemo<AuthState>(
    () => ({
      status,
      user,
      firebaseUser,
      lastEmail,
      signIn,
      signOutNow,
      sendReset,
      changePassword,
    }),
    [
      status,
      user,
      firebaseUser,
      lastEmail,
      signIn,
      signOutNow,
      sendReset,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
