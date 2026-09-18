// ============================================================================
// One-time bootstrap for a LIVE Firebase project.
//
// The security rules cannot bootstrap themselves: `allow create` on /users
// reads the actor's own /users document to find their role, and before the
// first CEO document exists there is no role to find. So the very first
// documents have to be written while the rules are still permissive — i.e.
// before `firebase deploy --only firestore:rules`.
//
//   1. node scripts/bootstrap-live.mjs      ← you are here
//   2. npx firebase-tools deploy --only firestore:rules
//
// Run it the other way round and this script gets PERMISSION_DENIED.
//
// Unlike scripts/seed-users.mjs (which uses the Admin SDK against the emulator
// and needs no credentials), this uses the ordinary client SDK: creating an
// account is an open operation, so no service-account key is required.
// ============================================================================

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { ACCOUNTS, DEV_PASSWORD, PROFILES_ONLY, userDoc } from "./accounts.mjs";

// .env.local is not loaded for a bare `node` run, so read it here.
function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].trim();
    }
  } catch {
    throw new Error("No .env.local found. Copy .env.example and fill it in.");
  }
  return env;
}

const env = loadEnv();
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

/** Creates the account, or signs in to an existing one to recover its uid. */
async function ensureAccount(person) {
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      person.email,
      DEV_PASSWORD,
    );
    console.log(`  + ${person.email} created (${cred.user.uid})`);
    return cred.user.uid;
  } catch (error) {
    if (error.code !== "auth/email-already-in-use") throw error;
    const cred = await signInWithEmailAndPassword(
      auth,
      person.email,
      DEV_PASSWORD,
    );
    console.log(`  · ${person.email} already exists (${cred.user.uid})`);
    return cred.user.uid;
  }
}

async function main() {
  console.log(`Bootstrapping ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.\n`);

  for (const person of ACCOUNTS) {
    const uid = await ensureAccount(person);
    // Written while signed in as the account itself — the only identity that
    // exists at this point. Merge so a re-run refreshes rather than duplicates.
    await setDoc(
      doc(db, "users", uid),
      {
        ...userDoc(person, { status: "active" }),
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  for (const person of PROFILES_ONLY) {
    // No Auth record to key on, so the stable legacy id is the document id.
    await setDoc(
      doc(db, "users", person.legacyUid),
      {
        ...userDoc(person, { status: "suspended" }),
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`  · ${person.email} profile only (no sign-in)`);
  }

  await signOut(auth);
  console.log(
    `\nDone. ${ACCOUNTS.length} accounts can sign in with: ${DEV_PASSWORD}` +
      "\nNow lock the project down:  npx firebase-tools deploy --only firestore:rules",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n${error.code ?? ""} ${error.message}`);
    if (error.code === "permission-denied") {
      console.error(
        "The rules are already locked down. Create the three accounts and " +
          "their /users documents by hand in the Firebase console instead.",
      );
    }
    process.exit(1);
  });
