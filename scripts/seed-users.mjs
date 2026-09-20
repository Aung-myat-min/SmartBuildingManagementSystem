// Seeds the sign-in accounts and user profiles — the EMULATOR path (Admin SDK,
// no credentials). Use scripts/bootstrap-live.mjs against a real project.
//
//   npx firebase-tools emulators:start --only auth,firestore
//   node scripts/seed-users.mjs
//
// The rules cannot bootstrap themselves: `allow create` on /users reads the
// actor's own /users doc for their role, and before the first CEO document
// exists there is no role to find.

import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ACCOUNTS, DEV_PASSWORD, PROFILES_ONLY, userDoc } from "./accounts.mjs";

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "smart-building-monitoring";

// The Admin SDK talks to the emulators when these are set; it needs no
// credentials in that mode, which is why this script has no key file.
const usingEmulators =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) ||
  process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

if (usingEmulators) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
}

/**
 * Against the emulators the Admin SDK needs no credential — but the key has to
 * be *absent*, not present-and-undefined, or initializeApp rejects the options.
 */
function appOptions() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (usingEmulators || !keyPath) return { projectId: PROJECT_ID };
  return { projectId: PROJECT_ID, credential: cert(keyPath) };
}

async function main() {
  initializeApp(appOptions());
  const auth = getAuth();
  const db = getFirestore();

  console.log(
    usingEmulators
      ? `Seeding the emulator suite for ${PROJECT_ID}.`
      : `Seeding the LIVE project ${PROJECT_ID}.`,
  );

  for (const account of ACCOUNTS) {
    // Idempotent: re-running must not fail, so an existing account is reused
    // rather than recreated.
    let user;
    try {
      user = await auth.getUserByEmail(account.email);
      console.log(`  · ${account.email} already exists (${user.uid})`);
    } catch {
      user = await auth.createUser({
        email: account.email,
        password: DEV_PASSWORD,
        displayName: account.name,
        emailVerified: true,
      });
      console.log(`  + ${account.email} created (${user.uid})`);
    }

    await db
      .collection("users")
      .doc(user.uid)
      .set(
        {
          ...userDoc(account, { status: "active" }),
          lastActiveAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }

  for (const person of PROFILES_ONLY) {
    // Keyed by legacyUid: there is no Auth uid to key on, and the id has to be
    // stable across re-runs.
    await db
      .collection("users")
      .doc(person.legacyUid)
      .set(
        {
          ...userDoc(person, { status: "suspended" }),
          lastActiveAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    console.log(`  · ${person.email} profile only (no sign-in)`);
  }

  console.log(
    `\nDone. ${ACCOUNTS.length} accounts can sign in with: ${DEV_PASSWORD}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
