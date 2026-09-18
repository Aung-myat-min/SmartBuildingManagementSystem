// ============================================================================
// Seeds the three sign-in accounts and the eight user profile documents.
//
// The demo account picker is gone, so three real accounts are the only way to
// reach all three roles. Run this against the emulator suite:
//
//   npx firebase-tools emulators:start --only auth,firestore
//   node scripts/seed-users.mjs
//
// Against a real project, create the three accounts and their documents by
// hand in the Firebase console instead. The rules cannot bootstrap themselves:
// `allow create` on /users reads the actor's own /users doc to find their role,
// and before the first CEO document exists there is no role to find.
//
// Identities are taken from the mock corpus so the seeded Log Book and request
// history still refer to people who exist. `legacyUid` is what joins a real
// Firebase uid back to the mock `submittedBy` / `actorUid` values — without it
// no seeded request is withdrawable or verifiable by the person who raised it.
// It goes when the data migrates.
// ============================================================================

import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

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

const DEV_PASSWORD = process.env.SEED_PASSWORD ?? "Password!2026";

/** The three that can sign in. */
const ACCOUNTS = [
  {
    email: "hnin.nwe@university.edu",
    name: "Hnin Nwe",
    role: "office-staff",
    buildingId: "b216",
    legacyUid: "u-hnin",
  },
  {
    email: "elysha@university.edu",
    name: "Elysha",
    role: "admin-manager",
    buildingId: null,
    legacyUid: "u-ko",
  },
  {
    email: "daw.htun@university.edu",
    name: "Daw Htun",
    role: "ceo-super-admin",
    buildingId: null,
    legacyUid: "u-daw",
  },
];

/**
 * The rest of Administration's account list. These get a profile document but
 * no Auth record — they are people to administer, not people who sign in
 * during the demo. Suspended so the table never implies they can.
 */
const PROFILES_ONLY = [
  {
    email: "su.myat@university.edu",
    name: "Su Myat",
    role: "admin-manager",
    buildingId: null,
    legacyUid: "u-su",
  },
  {
    email: "zaw.lin@university.edu",
    name: "Zaw Lin",
    role: "office-staff",
    buildingId: "b216",
    legacyUid: "u-zaw",
  },
  {
    email: "thida.win@university.edu",
    name: "Thida Win",
    role: "office-staff",
    buildingId: "b209",
    legacyUid: "u-thida",
  },
  {
    email: "nay.oo@university.edu",
    name: "Nay Oo",
    role: "office-staff",
    buildingId: "jsq",
    legacyUid: "u-nay",
  },
  {
    email: "myo.set@university.edu",
    name: "Myo Set",
    role: "office-staff",
    buildingId: "jsq",
    legacyUid: "u-myo",
  },
];

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

    await db.collection("users").doc(user.uid).set(
      {
        email: account.email,
        name: account.name,
        role: account.role,
        buildingId: account.buildingId,
        legacyUid: account.legacyUid,
        status: "active",
        lastActiveAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  for (const person of PROFILES_ONLY) {
    // Keyed by legacyUid: there is no Auth uid to key on, and the id has to be
    // stable across re-runs.
    await db.collection("users").doc(person.legacyUid).set(
      {
        email: person.email,
        name: person.name,
        role: person.role,
        buildingId: person.buildingId,
        legacyUid: person.legacyUid,
        status: "suspended",
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
