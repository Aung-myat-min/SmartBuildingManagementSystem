// ============================================================================
// Seeds the app's collections into Firestore from the corpus in
// src/lib/mock-data.ts.
//
// It runs under vite-node (already present as a Vitest dependency) rather than
// plain node, because it imports that corpus directly — TypeScript, behind the
// `@/` alias. Copying the data into a .mjs sibling would guarantee drift, and
// the whole point of this script is that there is one corpus.
//
//   pnpm seed:data              # write the seed, leaving app-made rows alone
//   pnpm seed:data --dry-run    # say what it would write
//   pnpm seed:data --reset      # delete each collection first, then write
//
// Idempotent: seeded documents keep their corpus ids and are written with
// merge, so a re-run refreshes them. Rows created in the app have generated
// ids and are never touched — which does mean an edit made in the app **to a
// seeded row** is overwritten on the next run. That asymmetry is confusing
// enough that the script prints it every time.
// ============================================================================

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { DEFAULT_SERVICE_INTERVAL_DAYS } from "../src/lib/derive";
import {
  BUILDINGS,
  EQUIPMENT_HISTORY,
  EQUIPMENT_UNITS,
  LOG_BOOK,
  MAINTENANCE_REQUESTS,
  ROOMS,
  SENSOR_TYPES,
  SENSORS,
} from "../src/lib/mock-data";
import { ACCOUNTS, DEV_PASSWORD } from "./accounts.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
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
    console.log(`  ${name.padEnd(18)} would write ${rows.length}`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, name, row.id), row.data, { merge: true });
    }
    await batch.commit();
  }
  console.log(`  ${name.padEnd(18)} wrote ${rows.length}`);
}

async function clear(name: string): Promise<void> {
  const snap = await getDocs(collection(db, name));
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
  console.log(`  ${name.padEnd(18)} cleared ${snap.docs.length}`);
}

async function main(): Promise<void> {
  console.log(
    `Seeding ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}${DRY_RUN ? " (dry run)" : ""}\n`,
  );
  if (!DRY_RUN) {
    console.log(
      "Seeded rows are rewritten from the corpus — an edit made in the app to\n" +
        "a seeded row will be overwritten. Rows created in the app are untouched.\n",
    );
  }

  // Signed in as the CEO so the writes carry an identity. The rules are not
  // deployed, so nothing depends on it today; it is what makes this script
  // still work on the day they are.
  const ceo = ACCOUNTS.find((a) => a.role === "ceo-super-admin");
  if (!ceo) throw new Error("No CEO account defined in scripts/accounts.mjs.");
  await signInWithEmailAndPassword(auth, ceo.email, DEV_PASSWORD);

  if (RESET) {
    console.log("Clearing:");
    await clear("logBook");
    await clear("buildings");
    await clear("rooms");
    await clear("sensorTypes");
    await clear("sensors");
    await clear("equipmentUnits");
    await clear("equipmentHistory");
    await clear("requests");
    console.log("");
  }

  console.log(DRY_RUN ? "Would write:" : "Writing:");

  await writeAll(
    "logBook",
    LOG_BOOK.map((entry) => {
      const { id, timestamp, ...rest } = entry;
      return {
        id,
        data: { ...rest, timestamp: Timestamp.fromDate(new Date(timestamp)) },
      };
    }),
  );

  await writeAll(
    "buildings",
    BUILDINGS.map(({ id, ...data }) => ({ id, data })),
  );

  await writeAll(
    "rooms",
    ROOMS.map(({ id, ...data }) => ({ id, data })),
  );

  // Statuses and actions ride along as nested arrays — one document per type,
  // which is the unit the registry's validation works in.
  await writeAll(
    "sensorTypes",
    SENSOR_TYPES.map(({ id, ...data }) => ({ id, data })),
  );

  // `statusChangedAt` is seeded from the last report: the corpus has no
  // record of when a device entered its status, and dating it from the report
  // is the only answer that is not invented.
  await writeAll(
    "sensors",
    SENSORS.map(({ id, ...data }) => ({
      id,
      data: { ...data, statusChangedAt: data.updatedAt },
    })),
  );

  // The document id is the tag. Every join — the sensor link, a request's
  // equipmentId, a history row, a log entry's refId — holds this string.
  await writeAll(
    "equipmentUnits",
    EQUIPMENT_UNITS.map(({ id, ...data }) => ({
      id,
      data: { ...data, serviceIntervalDays: DEFAULT_SERVICE_INTERVAL_DAYS },
    })),
  );

  // `at` stays an ISO string rather than a Timestamp: Firestore orders by
  // type before value, so a collection holding both would sort into two
  // blocks and the drawer's timeline would come back interleaved wrongly.
  await writeAll(
    "equipmentHistory",
    EQUIPMENT_HISTORY.map(({ id, ...data }) => ({ id, data })),
  );

  await writeAll(
    "requests",
    MAINTENANCE_REQUESTS.map(({ id, ...data }) => ({ id, data })),
  );

  await signOut(auth);
  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`\n${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
