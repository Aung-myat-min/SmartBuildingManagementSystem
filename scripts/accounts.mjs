// The seeded identities, shared by both seed paths so they cannot drift.
//
// Taken from the mock corpus, so the seeded Log Book and requests refer to
// people who exist. `legacyUid` joins a real Firebase uid back to the corpus's
// `submittedBy` / `actorUid` — without it no seeded request is withdrawable or
// verifiable by whoever raised it. It goes when the data migrates.

export const DEV_PASSWORD = process.env.SEED_PASSWORD ?? "Password!2026";

/** The three that can sign in. */
export const ACCOUNTS = [
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
 * no Auth record — they are people to administer, not people who sign in during
 * the demo. Suspended, so the table never implies they can.
 */
export const PROFILES_ONLY = [
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

/** The document body written for an account, whichever path wrote it. */
export function userDoc(person, { status }) {
  return {
    email: person.email,
    name: person.name,
    role: person.role,
    buildingId: person.buildingId,
    legacyUid: person.legacyUid,
    status,
  };
}
