// Sets up an empty Firebase project so the app is usable: one CEO account and
// the estate it manages. No requests, no Log Book, no history, no reports —
// those are what you create by using the app.
//
//   pnpm init:project                 # create everything
//   pnpm init:project --dry-run       # say what it would do
//   pnpm init:project --reset         # wipe the estate first, then write it
//
// Runs under vite-node rather than node so it can import the estate from
// src/lib/mock-data.ts directly, instead of keeping a second copy that drifts.
//
// Safe to run twice: documents keep their ids and are merged, and an existing
// CEO account is signed into rather than recreated.
//
// The email and password default to the CEO in scripts/accounts.mjs. Override
// with CEO_EMAIL and CEO_PASSWORD.

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { DEFAULT_SERVICE_INTERVAL_DAYS } from "../src/lib/derive";
import {
  BUILDINGS,
  EQUIPMENT_TYPES,
  EQUIPMENT_UNITS,
  ROOMS,
  SENSOR_TYPES,
  SENSORS,
} from "../src/lib/mock-data";

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");

const CEO_EMAIL = process.env.CEO_EMAIL ?? "daw.htun@university.edu";
const CEO_PASSWORD = process.env.CEO_PASSWORD ?? "Password!2026";
const CEO_NAME = process.env.CEO_NAME ?? "Daw Htun";

/** What this script owns. Activity collections are deliberately not here. */
const ESTATE = [
  "buildings",
  "rooms",
  "equipmentTypes",
  "equipmentUnits",
  "sensorTypes",
  "sensors",
] as const;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    throw new Error("No .env.local found. Copy .env.example and fill it in.");
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  if (!env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error(".env.local has no NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
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

/** Firestore caps a batch at 500 operations. */
const BATCH_LIMIT = 500;

async function writeAll(
  name: string,
  rows: { id: string; data: Record<string, unknown> }[],
): Promise<void> {
  if (DRY_RUN) {
    console.log(`  ${name.padEnd(16)} would write ${rows.length}`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, name, row.id), row.data, { merge: true });
    }
    await batch.commit();
  }
  console.log(`  ${name.padEnd(16)} wrote ${rows.length}`);
}

async function clear(name: string): Promise<void> {
  const snap = await getDocs(collection(db, name));
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
  console.log(`  ${name.padEnd(16)} cleared ${snap.docs.length}`);
}

/** Creates the account, or signs in to an existing one to recover its uid. */
async function ensureCeo(): Promise<string> {
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      CEO_EMAIL,
      CEO_PASSWORD,
    );
    console.log(`  + ${CEO_EMAIL} created`);
    return cred.user.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/email-already-in-use") throw error;
    const cred = await signInWithEmailAndPassword(
      auth,
      CEO_EMAIL,
      CEO_PASSWORD,
    );
    console.log(`  · ${CEO_EMAIL} already exists`);
    return cred.user.uid;
  }
}

async function main(): Promise<void> {
  console.log(
    `Setting up ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}${DRY_RUN ? " (dry run)" : ""}\n`,
  );

  console.log("Account:");
  const uid = DRY_RUN ? "(dry run)" : await ensureCeo();

  if (!DRY_RUN) {
    await setDoc(
      doc(db, "users", uid),
      {
        email: CEO_EMAIL,
        name: CEO_NAME,
        role: "ceo-super-admin",
        buildingId: null,
        status: "active",
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`  · profile written as ceo-super-admin`);
  }

  if (RESET) {
    console.log("\nClearing the estate:");
    for (const name of ESTATE) await clear(name);
  }

  console.log(`\n${DRY_RUN ? "Would write:" : "Writing:"}`);

  await writeAll(
    "buildings",
    BUILDINGS.map(({ id, ...data }) => ({ id, data })),
  );
  await writeAll(
    "rooms",
    ROOMS.map(({ id, ...data }) => ({ id, data })),
  );
  await writeAll(
    "equipmentTypes",
    EQUIPMENT_TYPES.map(({ id, ...data }) => ({ id, data })),
  );
  await writeAll(
    "equipmentUnits",
    EQUIPMENT_UNITS.map(({ id, ...data }) => ({
      id,
      data: { ...data, serviceIntervalDays: DEFAULT_SERVICE_INTERVAL_DAYS },
    })),
  );
  await writeAll(
    "sensorTypes",
    SENSOR_TYPES.map(({ id, ...data }) => ({ id, data })),
  );
  // statusChangedAt is seeded from the last report: the estate has no record
  // of when a device entered its status, and dating it from the report is the
  // only answer that is not invented.
  await writeAll(
    "sensors",
    SENSORS.map(({ id, ...data }) => ({
      id,
      data: { ...data, statusChangedAt: data.updatedAt },
    })),
  );

  if (!DRY_RUN) await signOut(auth);

  console.log(`
Done. Sign in at http://localhost:3000/login

  ${CEO_EMAIL}
  ${CEO_PASSWORD}

No requests, Log Book entries, equipment history or reports were created —
those appear as you use the app.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`\n${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
