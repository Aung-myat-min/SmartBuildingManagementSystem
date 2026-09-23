// Sets up an empty Firebase project so the app is usable: one CEO account and
// the estate it manages. No requests, no Log Book, no history, no reports —
// those are what you create by using the app.
//
//   pnpm init:project                 # create everything
//   pnpm init:project --dry-run       # say what it would do
//   pnpm init:project --reset         # wipe the WHOLE database first
//   pnpm init:project --reset --yes   # ... without being asked to confirm
//
// Runs under vite-node rather than node so it can import the estate from
// src/lib/mock-data.ts directly, instead of keeping a second copy that drifts.
//
// Safe to run twice: documents keep their ids and are merged, and an existing
// CEO account is signed into rather than recreated.
//
// Three accounts are created, one per role, so every part of the app can be
// seen without inventing an account first. Override any address with
// CEO_EMAIL / ADMIN_EMAIL / STAFF_EMAIL, and the shared password with
// INIT_PASSWORD.

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
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

const PASSWORD = process.env.INIT_PASSWORD ?? "SmartPassword!";

/** One account per role. Office Staff are scoped to a building; nobody else. */
const ACCOUNTS = [
  {
    email: process.env.CEO_EMAIL ?? "daw.htun@university.edu",
    name: process.env.CEO_NAME ?? "Daw Htun",
    role: "ceo-super-admin",
    buildingId: null,
  },
  {
    email: process.env.ADMIN_EMAIL ?? "elysha@university.edu",
    name: process.env.ADMIN_NAME ?? "Elysha",
    role: "admin-manager",
    buildingId: null,
  },
  {
    email: process.env.STAFF_EMAIL ?? "hnin.nwe@university.edu",
    name: process.env.STAFF_NAME ?? "Hnin Nwe",
    role: "office-staff",
    buildingId: "b216",
  },
] as const;

/** What this script writes. */
const ESTATE = [
  "buildings",
  "rooms",
  "equipmentTypes",
  "equipmentUnits",
  "sensorTypes",
  "sensors",
] as const;

/**
 * What --reset deletes: everything, not just what gets rewritten. A reset that
 * left the last person's requests and log entries behind was not one.
 */
const ALL_COLLECTIONS = [
  ...ESTATE,
  "requests",
  "logBook",
  "equipmentHistory",
  "reports",
  "users",
] as const;

/**
 * Parents whose photos live in a `media` subcollection. Deleting a document
 * does not delete its subcollections, so these have to be walked or the
 * photos become unreachable rather than gone.
 */
const WITH_PHOTOS = ["equipmentUnits", "buildings"] as const;

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

/** A photo lives at `{parent}/{id}/media/photo` and outlives its parent. */
async function clearPhotos(parent: string): Promise<void> {
  const snap = await getDocs(collection(db, parent));
  let removed = 0;
  for (const d of snap.docs) {
    const media = await getDocs(collection(db, parent, d.id, "media"));
    for (const m of media.docs) {
      await deleteDoc(m.ref);
      removed += 1;
    }
  }
  if (removed > 0) {
    console.log(`  ${`${parent}/media`.padEnd(16)} cleared ${removed}`);
  }
}

/** Typed at the terminal, because --reset now deletes everything. */
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question}\n  Type "delete" to confirm: `);
  rl.close();
  return answer.trim().toLowerCase() === "delete";
}

/** Creates the account, or signs in to an existing one to recover its uid. */
async function ensureAccount(email: string): Promise<string> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, PASSWORD);
    console.log(`  + ${email} created`);
    return cred.user.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/email-already-in-use") throw error;
    // Already there from an earlier run. Signing in is how a client-SDK
    // script recovers the uid — there is no admin lookup without a key.
    try {
      const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
      console.log(`  · ${email} already exists`);
      return cred.user.uid;
    } catch (signInError) {
      const signInCode = (signInError as { code?: string }).code;
      if (signInCode !== "auth/invalid-credential") throw signInError;
      throw new Error(
        `${email} already exists with a different password, and this script ` +
          `cannot read a uid without signing in.\n\n` +
          `Either run it with the password that account already has:\n` +
          `  INIT_PASSWORD='the-existing-one' pnpm init:project\n\n` +
          `or delete the account in the Firebase console under\n` +
          `Authentication → Users, and run this again.`,
      );
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `Setting up ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}${DRY_RUN ? " (dry run)" : ""}\n`,
  );

  console.log("Accounts:");
  if (DRY_RUN) {
    for (const a of ACCOUNTS) {
      console.log(`  would create ${a.email.padEnd(26)} ${a.role}`);
    }
  } else {
    // Every account is created first, then the profiles are written while
    // signed in as the CEO — creating an account signs you in as it, and the
    // last one created would otherwise be the one writing everybody's role.
    const uids: string[] = [];
    for (const a of ACCOUNTS) uids.push(await ensureAccount(a.email));

    await signInWithEmailAndPassword(auth, ACCOUNTS[0].email, PASSWORD);
    for (const [i, a] of ACCOUNTS.entries()) {
      await setDoc(
        doc(db, "users", uids[i]),
        {
          email: a.email,
          name: a.name,
          role: a.role,
          buildingId: a.buildingId,
          status: "active",
          lastActiveAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
      console.log(`  · ${a.email.padEnd(26)} profile written as ${a.role}`);
    }
  }

  if (RESET) {
    if (!process.argv.includes("--yes")) {
      const ok = await confirm(
        `Delete EVERY document in ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}?`,
      );
      if (!ok) {
        console.log("Nothing was deleted.");
        process.exit(0);
      }
    }
    console.log("\nClearing:");
    for (const parent of WITH_PHOTOS) await clearPhotos(parent);
    for (const name of ALL_COLLECTIONS) await clear(name);
    console.log(
      "\n  Auth accounts are NOT deleted — the client SDK cannot remove another\n" +
        "  user's record. They will sign in and land on 'no profile' until the\n" +
        "  accounts below are recreated. To clear them entirely:\n" +
        `  https://console.firebase.google.com/project/${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/authentication/users`,
    );
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

  const rows = ACCOUNTS.map((a) => `  ${a.email.padEnd(26)} ${a.role}`).join(
    "\n",
  );
  console.log(`
Done. Sign in at http://localhost:3000/login

${rows}

  password for all three: ${PASSWORD}

There is no role switcher — to see another role, sign in as it.

No requests, Log Book entries, equipment history or reports were created;
those appear as you use the app.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`\n${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
