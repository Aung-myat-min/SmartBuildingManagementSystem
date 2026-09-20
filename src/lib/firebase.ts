// The one place the Firebase SDK is initialised. Only lib/auth.tsx and the
// store modules import it.
//
// **The config is not a secret.** It ships in every client bundle by design:
// it identifies the project, it grants nothing. Authorisation is
// firestore.rules plus the authorised-domains list. Hiding the key behind a
// server route would buy nothing and cost the static build.

import {
  deleteApp,
  type FirebaseApp,
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";

// Read as literal member expressions: Next inlines NEXT_PUBLIC_* only where it
// can see the whole name, so a computed lookup would come back undefined.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

/**
 * A missing key otherwise surfaces much later as `auth/invalid-api-key` inside
 * a sign-in toast, which reads as a wrong password. Fail loudly at load.
 */
if (!useEmulators && !firebaseConfig.apiKey) {
  throw new Error(
    "Firebase is not configured. Copy .env.example to .env.local and fill in the " +
      "NEXT_PUBLIC_FIREBASE_* values, or set NEXT_PUBLIC_FIREBASE_EMULATORS=1 to " +
      "run against the local emulator suite.",
  );
}

// Turbopack re-evaluates modules on hot reload; without the guard the second
// pass throws `app/duplicate-app`.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// `ignoreUndefinedProperties` because the domain is full of optionals and
// Firestore rejects `undefined` outright rather than treating it as absent.
// (Which also means undefined *skips* a field on update — clearing one needs
// deleteField(). See requests-store.)
//
// initializeFirestore throws if the instance exists, routine under hot reload,
// so the second pass falls through. A getApps() check would not work: the app
// is created above, so it is never empty by this line.
export const db = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
})();

// connectXEmulator throws if called twice against the same instance, and hot
// reload will call it again, so the wiring is latched.
let emulatorsWired = false;
if (useEmulators && !emulatorsWired) {
  emulatorsWired = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/**
 * A second, isolated instance for creating accounts.
 * `createUserWithEmailAndPassword` signs in whoever it just created, which on
 * the primary instance costs the administrator their session mid-task. The
 * caller tears it down; see `releaseProvisionerApp`.
 */
export function provisionerApp(): FirebaseApp {
  return initializeApp(firebaseConfig, "provisioner");
}

export async function releaseProvisionerApp(
  instance: FirebaseApp,
): Promise<void> {
  await deleteApp(instance);
}
