# Smart Building Monitoring — codebase map

Facilities-operations dashboard for a 3-building estate (CET333). Firebase Auth
is real and **eight collections live in Firestore**, each behind a live
`onSnapshot`. What is left in `mock-data.ts` is the seed corpus and the things
that are generated on purpose — reports, historical records, the power series.

Full reference — build status, every exported function, page-by-page behaviour
and the known gaps — lives in [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
shadcn/ui on **Base UI** (not Radix) · lucide-react · sonner · Biome.

`npm run dev` · `npm run build` · `npm run lint` (biome check) · `npm run format`.

## Directory map

```
src/
  app/
    layout.tsx            root: fonts, <Providers>, <Toaster>
    page.tsx              redirects to /login
    login/                login + account-access screens (outside the app shell)
    (app)/
      layout.tsx          auth gate, then the shell: sidebar + 54px header
      <route>/page.tsx    one file per page, sub-components colocated
  components/
    shell/                sidebar, header widgets (account, notifications), auth-gate
    shared/               cross-page primitives (tone-badge, pulse-dot, access-denied, empty-state, confirm-dialog)
    ui/                   shadcn primitives
    providers.tsx         ThemeProvider + AuthProvider + ConfirmProvider
                          (AppStateProvider lives inside the auth gate, below)
  lib/                    types, seed corpus, Firestore stores, app state,
                          permissions, formatting, nav
```

## Data layer

**`lib/types.ts`** — the domain model. Read this first; every page is built on it.

| Group | Types |
| --- | --- |
| Users | `UserRole` (office-staff / admin-manager / ceo-super-admin), `AppUser` (+ `legacyUid`), `ManagedUser` |
| Estate | `Building` (id, name, site `code`), `Room`, `RoomType` |
| Equipment | `EquipmentTypeDef`, `Equipment` (room-level count breakdown), `EquipmentUnit` (one taggable asset), `EquipmentCondition`, `EquipmentHistoryEvent` |
| Sensors | `SensorTypeDef` (own `statuses[]` + `actions[]` + `icon` key), `SensorStatusDef`, `SensorAction`, `EnvironmentalSensor` |
| Requests | `MaintenanceRequest` (+ `declineNote`, `verificationRequested`, `withdrawn`), `RequestStatus` (5 steps, approval first), `RequestPriority` |
| Ledgers | `HistoricalRecord` (long-range, all roles), `LogBookEntry` (short-range, admin+CEO) |
| Reports | `Report`, `ReportDetail`, `ReportKpi`, `ReportWeek`, `ReportOffender`, `ReportCostLine` |

Two invariants the code relies on:
- `Equipment`: `running + faulty + underMaintenance === quantity`.
- A fire detector is **two records** — an `EquipmentUnit` (the asset) and an
  `EnvironmentalSensor` (the live state) — joined by `linkedEquipmentId`, never merged.
- Equipment and sensor *types* are data-driven registries, not hardcoded unions.

**`lib/mock-data.ts`** (~1750 lines) — seed data + derivations.
3 buildings · 19 rooms · 10 equipment types · 19 units · 2 sensor types · 17 sensors ·
14 requests · 18 log entries · 13 reports. Accounts are **not** here — they
live in Firestore; see `lib/users-store.ts`.
Helpers: `buildingStats()`, `roomsForBuilding()`, `roomLabel()`, `buildingName()`,
`equipmentUnitLabel()`, `powerSeries()`, `reportDetail()`.
Lookups: `BUILDING_META`, `BUILDING_LOAD_KW`, `LOG_BOOK_SOURCE_META`,
`REQUEST_NEXT_STATUS`, `REQUEST_NEXT_ACTION`.
Estate: `buildings()` / `rooms()` / `roomsForBuilding()` / `roomLabel()` /
`buildingName()` resolve through `setEstateSource()`, which the provider feeds —
so renaming a building in Administration reaches every building filter in the
app, not just the tab that renamed it. Never read `BUILDINGS` or `ROOMS`
directly outside mock-data; they are the seed, not the state.
Sensor registry: `sensorTypes()` / `sensorType()` / `statusDef()` — always read
a sensor type through these, never through `SENSOR_TYPES`. They resolve against
whatever `setSensorRegistrySource()` was last handed, which is the live registry
the provider holds, and are where a Firestore subscription will attach.

**`lib/derive.ts`** — the values that look like fields and are not. Pure rules,
no data imports, so the layering stays `format → derive → mock-data → app-state`.
Escalation (high + open + past `ESCALATION_WINDOW_HOURS`), due-service (healthy
within `DUE_SERVICE_DAYS` — a board column, not a condition), offline status,
`statusTone` (a status whose `escalateAfterMinutes` has passed switches tone —
an unlocked door is blue for 30 minutes, then amber), `countOpenRequests` /
`countEscalated`, and `kpiPasses`. Change a threshold here, not in a migration.
Whether a status counts as an alarm is **not** here — it is the `isAlarm` flag
on the status's registry entry. **Never re-implement one of these inline.**

**`lib/auth.tsx`** — `useAuth()`, the signed-in identity, and the only module
that imports `firebase/auth`. `status` is one discriminated field
(`loading` / `signed-out` / `signed-in` / `no-profile` / `suspended`) because
being authenticated is not the same as being usable here: no page can render
until the role resolves. The profile is an `onSnapshot` on `users/{uid}`, so a
role change or suspension takes effect without a re-login. `endedReason` tells
a session that was taken away from a deliberate sign-out.

**`lib/firebase.ts`** — the one `initializeApp`, with
`ignoreUndefinedProperties` (the domain is full of optionals). The web config is
**not** a secret; authorisation is `firestore.rules`. Also exports
`provisionerApp()`, the second instance account creation runs on.

**`lib/firestore-store.ts`** — the mechanical half of a collection:
`useLiveCollection<T>(query, map, sort?)`, `COLLECTIONS`, `WriteResult`,
`readError` / `writeError`. Queries stay single-collection and
single-field-ordered, so `firestore.indexes.json` stays empty — do not add a
`where` here without the composite index it will then need.

**`lib/store-mappers.ts`** — every document → domain mapper, pure, importing
only types. Separate from the store modules because those import
`@/lib/firebase`, which throws without a configured project and would make them
untestable. Timestamps become ISO strings here and nowhere else.

**The store modules**, one per domain, each a `useX()` plus writes returning
`WriteResult`:

| Module | Collections | Notes |
| --- | --- | --- |
| `users-store.ts` | `users` | `createUser` runs on the provisioner app so it does not swap the admin's session. |
| `logbook-store.ts` | `logBook` | Append-only, `serverTimestamp()`, `limit(200)`. |
| `estate-store.ts` | `buildings`, `rooms` | Deleting a building batches its rooms with it. |
| `sensor-types-store.ts` | `sensorTypes` | Statuses and actions are nested arrays — the unit the validation judges. |
| `sensors-store.ts` | `sensors` | `writeSensorStatus` writes status **and** `statusChangedAt` together. |
| `equipment-store.ts` | `equipmentUnits`, `equipmentHistory` | Every write that changes what happened to a unit batches the history row with it. Photos at `equipmentUnits/{id}/media/photo`. |
| `requests-store.ts` | `requests` | Exports `CLEAR` (`deleteField()`) — `undefined` is *ignored*, not cleared. |

The human id is the document id everywhere one exists (`b216`, `FD-216-14`,
`EQ-216-01`, `REQ-4192`), because every cross-reference already holds that
string. `logBook` and `equipmentHistory` take auto-ids.

**`lib/photo.ts`** — `fitWithin` / `dataUrlBytes` / `photoTooLarge` (pure,
tested) and `downscaleImage` (canvas, browser only). There is no Storage
bucket, so a photo is a 640px q0.7 JPEG data URL in a document, refused over
700 KB because a document is capped at 1 MiB.

**`lib/estate-rules.ts`** — `buildingDeletionRefusal` / `roomsToCascade`. Pure,
so the "what may be deleted" question is testable without Firestore.

**`scripts/seed-firestore.ts`** — `npx vite-node scripts/seed-firestore.ts`,
`--dry-run`, `--reset`. Imports the corpus directly rather than duplicating it.
Seeded rows are rewritten on every run; rows made in the app are untouched.

**`lib/app-state.tsx`** — `useAppState()`, the one place the subscriptions are
resolved and re-exposed under the names every page already used.
Takes the resolved `user` as a required prop and re-exposes `role` /
`currentUser`, so pages read identity the way they always did. Mounted **inside**
the auth gate, so it is never asked to render without an identity.
Holds the active building and notifications — the only two things still in
memory, because they are session-scoped UI state, not domain data.
It holds the **estate** (`buildings`, `rooms`, plus `addBuilding` /
`updateBuilding` / `deleteBuilding` — which takes the building's rooms with it —
and `addRoom` / `updateRoom` / `removeRoom`), and the resolved device list
`sensors` with `addSensor` / `editSensor` / `removeSensor` / `setSensorStatus`.
Both are single resolved lists for the same
reason `requests` is: the Sensors page, the building device counts and the
sensor type registry's archive guard all read the one list, so they cannot
disagree about what exists.
It holds the **asset register** (`equipmentUnits`, `equipmentHistory`, plus
`addUnit` / `editUnit` / `removeUnit` / `recordService` / `moveUnit` /
`setEquipmentCondition`). Every one of those that changes what happened to a
unit also appends the history row that says so, in one batch — a register whose
dates moved without a row is the drawer lying about what was done.
It also holds the live sensor type registry (`sensorTypeRegistry` plus
`addSensorType` / `updateSensorType` / `archiveSensorType` and the status and
action mutators), which is where the registry's validation is enforced — a type
with sensors cannot be archived, a status with sensors in it cannot be removed.
`requests` / `scopedRequests` / `openRequestCount` are the one resolved list and
the one count — the sidebar badge, toolbar chips, building cards and dashboard
tiles all read them, so they cannot disagree. `moveRequest(id, "next" | "prev")`
walks a request one step through
`requested → approved → in-progress → resolved → completed`; `declineRequest`
attaches a reason **without** moving it, `withdrawRequest` drops a staff
member's own unapproved request out of every list, and `requestVerification`
flags that its submitter thinks resolved work is done — all four are writes
returning `WriteResult`, and `requestIds` is every id in the collection
(withdrawn included) so a new one cannot collide. There is no `resetDemo()`, and **signing out no longer discards
anything**: the overrides are gone, and a write by one person is there for the
next. `dataLoading` / `dataError` aggregate every subscription, and the shell
renders `<ShellSkeleton>` until the first snapshots land.

It also owns the **Log Book**. `log(draft)` stamps the id, the time and the
actor from the signed-in role, and appends it to the `logBook` collection —
the Log Book page and the dashboard rail both read the one subscription, so
they cannot disagree. Every action in the app writes one entry: the
provider logs what it owns (requests, sensor status, equipment condition, the
sensor type registry), and a screen holding its own state (Administration's
buildings, rooms and accounts; the equipment register; reports; the password
form) calls `log()` itself. A refused registry change writes nothing.

**`lib/permissions.ts`** — the **affordance** layer; `firestore.rules` is the
enforcement layer, and they have to say the same thing. `roleRank()` (ceo=1,
admin=2, staff=3), `roleLabel`, `isActor()` (matches a real uid *or* the
`legacyUid` the mock corpus was written against), and
`can*` predicates. Gate on **rank**, never on role equality. Administration is
split three ways: `canManageEstate` (CEO) vs `canManageAccounts` and
`canManageSensorTypes` (Admin Manager + CEO), with
`canEditUser(actor, target)` limiting an Admin Manager to Office Staff rows. The
`*_LOCK_REASON` strings are the tooltips shown on padlocked controls.

**`lib/format.ts`** — `ageHours`, `formatAge`, `formatClock`, `formatTime`,
`formatDayLabel`, `formatDate`, `formatStamp` (date · time, for rows that must
say when, not just how long ago), `formatPeriod` (a date range read back as a
report's label — a whole calendar month is named, anything else shows its
span), `formatMmk`, `formatRelative`.
Never call `formatClock()` during render — use `useLiveClock()` (`src/hooks`), or
the server and client disagree by a second and hydration fails.

**`lib/nav.ts`** — `NAV_ITEMS` (8, desktop sidebar), `MOBILE_TABS` (5, phone bottom
bar) and `MORE_ITEMS` (the overflow listed on `/more`). Settings is reached from
the account menu and `/more`, not the sidebar.

## Base styles

`app/globals.css` holds the whole token sheet. Everything is a CSS variable surfaced
as a Tailwind utility — **never hardcode a hex**.

- Ground `#f4f5f7` · card `#fff` · border `#d8dbe1` · rules `#e6e8ec` (section) and
  `#f1f2f5` (row) · muted text `#6b7280`
- Primary `#4169e1`, `#2f4fb8` as on-white text
- Status tones as fill/text pairs: `success` `warning` `danger` `info` `neutral`,
  each with `-muted` (light fill) and `-foreground` (dark text). Use
  `bg-*-muted text-*-foreground` together; never the mid tone on the light fill.
- Surfaces: `surface`, `surface-subtle`, `surface-hover`
- Fonts: `--font-plex-sans` (body, loaded as the **variable** font so `font-[450]`
  resolves) / `--font-plex-mono` (ids, counts, timestamps, small uppercase labels).
- Animations: `animate-sb-pulse` (live dot), `animate-sb-slide` (popover entry).
- A `.dark` block carries the dark palette; `next-themes` is mounted in
  `providers.tsx` (`attribute="class"`) and `/settings` switches light/dark/system.

Metrics are tokens, not literals: `--sidebar-w` 196 · `--header-h` 54 ·
`--page-pad` 20 · `--drawer-form-w` 392 · `--drawer-detail-w` 412 · `--modal-w` 452.
Radius 4–5px · body 12–12.5px · small caps labels 9.5–10px at `.06em`.

## Shared components

| Component | Use |
| --- | --- |
| `shared/tone-badge.tsx` | `<ToneBadge tone>` — every status, priority, condition, record type. `toneDotClass()` for raw dots. |
| `shared/pulse-dot.tsx` | Live dot; only where something is genuinely happening now. |
| `shared/confirm-dialog.tsx` | `useConfirm()` → promise. Decisions only, plus the one optional `requireReason` textarea. |
| `shared/access-denied.tsx` | Role-locked page: states the role and who to ask. No action — with real accounts there is nothing to switch to. |
| `shared/empty-state.tsx` | Empty list/filter result. |
| `shared/form-drawer.tsx` | `FormDrawer` — the 392px right drawer for anything with fields, plus `FormField` / `FormFieldLocked`. |
| `lib/export.ts` | `toCsv()` / `downloadCsv()` — RFC 4180 quoting and a UTF-8 BOM, shared by both ledgers. `printToPdf()` is the browser's print dialog; `@media print` in globals.css drops the shell. |
| `shared/date-range-filter.tsx` | `DateRangeFilter` — from/to bounds on a toolbar, native date inputs, `withTime` for datetime-local. `withinRange()` does the comparison; an open end means unbounded, and a bare end date covers its whole day. |
| `shared/detail-drawer.tsx` | `DetailDrawer` — a record with history and actions (412px wide, 392px `size="narrow"`), plus `SameDevicePanel` and `DrawerAction`. |
| `lib/icons.ts` | `SENSOR_ICONS` / `sensorIcon()` — the fixed icon allowlist a sensor type picks from by key, never a component reference. |

**Container rules, fixed across every page.** Fields → form drawer. A record with
history and actions → detail drawer. Decisions only → centred 452px confirm, whose
`note` says what the action costs in its own numbers. Every result → one toast,
bottom-left, six seconds, no undo. On a phone both drawers become bottom sheets.

A control a role may not use stays on screen under a padlock with the reason in its
tooltip — it is never hidden.

## Pages

| Route | Purpose | Shape |
| --- | --- | --- |
| `/login` | Real sign-in (email + password) | card; `/login/forgot-password` (sends a reset), `/login/first-sign-in` (the reset link's landing page, reads `oobCode`), `/login/session-expired` (a session taken away, not an idle timeout) |
| `/dashboard` | Estate overview | KPI tiles, power series, estate table, requests needing a decision, live alerts, log feed |
| `/equipment` | Asset register | Register/Board toggle, filters, detail drawer with history + 6 actions |
| `/sensors` | Live device state | grouped by building, one column per registry type, alarm rows break the rhythm |
| `/requests` | Maintenance requests | Kanban/Table toggle, new-request sheet, five-column approval workflow; staff raise, withdraw and verify, approvers move |
| `/records` | Historical Records | range/building/type filters, daily grouping, CSV export |
| `/logbook` | Log Book | live feed fed by `logBook`, source and date-time filters, pause |
| `/reports` | Reports | library + full report view, generated-between filter, generate sheet with a date-range period, PDF/CSV |
| `/admin` | Administration | Buildings (photo, description, counts, room table) / User Accounts / Sensor Types tabs; Buildings is CEO-only and padlocked for an Admin Manager, the other two are shared |
| `/settings` | Settings | Your account, Appearance, Password & sessions |
| `/more` | More | phone-only overflow nav |

## Conventions

- `"use client"` on every page; sub-components colocated in the same file.
- Three widths: phone (`< md`, bottom tabs), tablet (`md..lg`, 60px icon rail),
  desktop (`lg+`, 196px sidebar). Page toolbars must `flex-wrap`; wide tables scroll
  inside their card via `overflow-x-auto` + a `min-w-*`, never push the page.
- `useSearchParams()` needs its own `<Suspense>` boundary or the route fails to
  prerender.
- Verify a build with its **exit code** — "✓ Compiled successfully" prints before
  the prerender step that can still fail.
- Tailwind arbitrary values carry the design's exact sizes (`text-[12.5px]`, `size-3.5`).
- Business logic stays in `lib/`; pages read from `useAppState()`, never from
  a store module's `useX()` directly and never from the seed arrays.
- Biome formats and lints; run `npm run lint` before finishing.
- `npm test` runs Vitest over `src/**/*.test.ts` — the pure rules in `lib/` and
  the export shaping. Firebase and the browser are out of scope there; mocking
  them would test the mock.

## Auth and authorisation

Three real accounts, one per role — see `README.md` for the addresses and the
shared development password. There is no role switcher: to see another role,
sign in as it.

**The route guard (`shell/auth-gate.tsx`) is UX, not security.** A client-only
SDK has no server-side gate; it exists so nobody lands on a chrome-full
dashboard while signed out. Authorisation is `firestore.rules`, which run on
Google's servers. When a `can*` predicate changes, change the matching rule in
the same commit.

Suspension works *through* the rules: a suspended account's own profile read is
refused, and `lib/auth.tsx` turns that `permission-denied` into a sign-out. It
looks like a bug if you do not know that.

`usePersistedState` keys are scoped to the signed-in uid, so two people sharing
a browser do not share view preferences. That is now the only per-session state
there is — everything else is in Firestore and outlives the sign-out.
