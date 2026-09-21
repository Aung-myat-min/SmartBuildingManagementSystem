# Project overview

A short guide to how this project is built. For setting it up, see
[`README.md`](../README.md). For what each role may do in detail, see
[`APPLICATION-FLOW.md`](./APPLICATION-FLOW.md).

---

## 1. What the app is

A facilities dashboard for a university estate of three buildings. Staff use it
to watch equipment and sensors, raise and track maintenance requests, and read
the log book and reports.

Everything runs in the browser. There is no server of our own — the browser
talks to Firebase directly.

---

## 2. Technology used

| What | Why it is here |
| --- | --- |
| **Next.js 16** | The React framework. Gives us routing by folder name and the production build. |
| **React 19** | Builds the screens out of components. |
| **TypeScript** | Adds types to JavaScript, so mistakes show up while writing instead of when running. |
| **Tailwind CSS v4** | Styling written as small class names. All colours and sizes come from tokens in `globals.css`. |
| **shadcn/ui on Base UI** | Ready-made building blocks — dialogs, sheets, dropdowns — that we restyle. |
| **Firebase Authentication** | Handles sign-in, passwords and reset emails. |
| **Cloud Firestore** | The database. Stores all eleven collections and pushes changes live. |
| **lucide-react** | Icons. |
| **sonner** | The small pop-up messages ("toasts") after an action. |
| **next-themes** | Light and dark mode. |
| **Vitest** | Runs the tests. 149 tests across 10 files. |
| **Biome** | Formats the code and checks its style. One tool instead of ESLint + Prettier. |

### Why Firebase and not a normal backend

The project needed real data that survives a reload, and a sign-in system,
without writing and hosting a server. Firebase gives both. The trade-off is
that the browser talks straight to the database, so the database's own rules
are the only real protection — see [Security](#7-security-in-one-paragraph).

---

## 3. Project structure

```
src/
  app/                  every page, one folder per URL
    login/              sign in, forgot password, first sign-in
    (app)/              the pages you see after signing in
      layout.tsx        the sidebar, header, and the sign-in check
      dashboard/        overview of the estate
      equipment/        the asset register and the condition board
      sensors/          live device states
      requests/         maintenance requests
      records/          historical records
      logbook/          the live log
      reports/          generated reports
      admin/            buildings, rooms, user accounts
      settings/         your account, theme, password

  components/
    ui/                 the plain building blocks (button, dialog, ...)
    shared/             pieces used on many pages (drawers, badges, ...)
    shell/              sidebar, header, sign-in gate

  lib/                  all the logic. See the next section.
  hooks/                small reusable React helpers

docs/                   these documents
scripts/                setup and seeding scripts
```

**Rule of thumb:** a page file holds only what that page shows. Anything two
pages need goes in `components/shared/`. Anything that is logic rather than
looks goes in `lib/`.

### Inside `lib/`

The folder has three kinds of file, and the difference matters.

**Pure logic — no database, no React.** These are plain functions. They can be
tested easily, and they are where the rules live.

| File | What it decides |
| --- | --- |
| `types.ts` | The shape of every record. Read this first. |
| `derive.ts` | Values that look stored but are worked out: is a request late, is a unit due a service, what colour is a status. |
| `reporting.ts` | All the report figures. |
| `permissions.ts` | What each role may do. |
| `estate-rules.ts` | When a building may be deleted, what floors a room may be on. |
| `format.ts` | Dates, times and money as text. |
| `photo.ts` | Resizing a photo so it fits in the database. |
| `mock-data.ts` | The starting data used to fill a new project. |

**Database access — one file per area.** Each one is the only file that knows
how its records are stored. Most cover one collection; `estate-store` covers
buildings and rooms together, `equipment-store` covers units and their history,
and `media-store` handles photos for both buildings and equipment.

```
users-store · logbook-store · estate-store · sensor-types-store
sensors-store · equipment-store · equipment-types-store
requests-store · reports-store · media-store
```

They all share `firestore-store.ts` (the live-reading machinery) and
`store-mappers.ts` (turning a database document into an app record).

**Shared state — one file.** `app-state.tsx` puts the collections together and
hands them to the pages.

---

## 4. The model it follows

This is a **layered architecture** (sometimes called three-tier). It is *not*
MVC, and it is worth saying why: MVC assumes a controller receives a request
and picks a view. Here the browser holds the state and the screen re-draws
itself when data changes, so there is nothing for a controller to do.

Data flows in one direction:

```
   ┌─────────────────────────────────────────┐
   │  Pages and components  (presentation)   │   what you see
   └───────────────────┬─────────────────────┘
                       │ reads and calls
   ┌───────────────────▼─────────────────────┐
   │  app-state.tsx         (application)    │   one shared state
   └───────────────────┬─────────────────────┘
                       │ uses
   ┌───────────────────▼─────────────────────┐
   │  *-store.ts files      (data access)    │   one per area
   └───────────────────┬─────────────────────┘
                       │ reads and writes
   ┌───────────────────▼─────────────────────┐
   │  Cloud Firestore       (database)       │
   └─────────────────────────────────────────┘

   Pure rule files (derive, reporting, permissions, ...) sit beside
   these layers. Any layer may use them; they use nothing themselves.
```

Three patterns are used inside that:

**Repository pattern.** Each `*-store.ts` is a repository: it is the only file
that knows how its records are stored. A page never writes to the database
itself, so changing how requests are saved means changing one file.

**Provider pattern (single source of truth).** `app-state.tsx` holds one list
per kind of record. The sidebar badge, the toolbar chip and the dashboard tile
all read the *same* list, so they cannot show different numbers.

**Separated pure logic.** Rules live in plain functions with no database and no
React. This is why the tests can check a report's figures exactly without a
browser or a Firebase connection.

### How a change travels

Pressing **Mark resolved** on a request:

1. The page calls `moveRequest()` from `app-state.tsx`.
2. That calls `patchRequestWrite()` in `requests-store.ts`.
3. Firestore saves it and tells every open screen.
4. Every page showing that request updates itself — including other tabs.
5. A log book entry is written in the same step.

Nobody refreshes anything. The screen follows the database.

---

## 5. Use cases

Three roles, ranked. A higher role can do everything a lower one can.

| Role | In one sentence |
| --- | --- |
| **Office Staff** | Raises requests and works on equipment, inside one building. |
| **Admin Manager** | Decides what happens: approves requests, acts on sensors, manages accounts and device types. |
| **CEO / Super Admin** | Everything, plus the buildings and rooms themselves. |

### Main use cases

**Everyone**

- Sign in; change your own password, name and phone
- See the dashboard, equipment register and sensor states
- Raise a maintenance request
- Withdraw your own request, before it is approved
- Say that resolved work looks done, on your own request
- Add equipment, record a service, move a unit, take a photo
- Search the historical records

**Admin Manager and above**

- Approve a request, move it along, or send it back with a reason
- Reset an alarm, lock or unlock a door
- Register, edit or remove a sensor
- Decommission or delete an equipment unit
- Read the log book and generate reports
- Manage user accounts and the sensor and equipment type lists

**CEO only**

- Add, edit or delete buildings and rooms

### The request lifecycle

```
requested → approved → in-progress → resolved → completed
```

Only an Admin Manager or the CEO moves a request along, and each step can be
moved back by one. The person who raised it can withdraw it before approval,
and can say that resolved work looks finished — but an approver still closes
it.

The full table of who may do what, with the code that enforces each rule, is in
[`APPLICATION-FLOW.md`](./APPLICATION-FLOW.md). The same folder has UML
diagrams in `application-flow.drawio`.

---

## 6. Where the data lives

Eleven collections in Firestore:

| Collection | Holds |
| --- | --- |
| `users` | Accounts and their roles |
| `buildings`, `rooms` | The estate |
| `equipmentTypes`, `equipmentUnits`, `equipmentHistory` | The asset register and what happened to each unit |
| `sensorTypes`, `sensors` | Devices and the states they may report |
| `requests` | Maintenance requests |
| `logBook` | Every action anyone takes |
| `reports` | Generated reports, with their figures saved |

Each record keeps the id a person would recognise — `EQ-216-01`, `REQ-4192`,
`b216` — so records point at each other by a name you can read.

One thing is still made up rather than recorded: the power-usage chart. There
are no meters behind it. Everything else on screen is a real stored record.

---

## 7. Security, in one paragraph

The app checks roles and hides or padlocks what you may not use — but that
check runs in the browser, so it prevents mistakes, not attacks. The only real
protection is `firestore.rules`, which runs on Google's servers. **Those rules
are not published yet**, so the database is currently open to anyone with the
project key. Publishing them is one command and is explained in the README.
