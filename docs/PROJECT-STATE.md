# Smart Building Monitoring — project state

A complete, detailed reference for this codebase, written so that someone (or
something) arriving with **no prior context** can read this one file and start
working. It covers what the product is, what is built, what every exported
function does, how each page behaves, and what is deliberately unfinished.

> `CLAUDE.md` in the repository root is the short map loaded into every session.
> This file is the long form. Where the two disagree, trust the source and fix
> both.

---

## 1. Orientation

### What this is

A **facilities-operations dashboard** for a three-building university estate,
built for the CET333 module. Facilities staff use it to watch equipment and
fire/door sensors, raise and progress maintenance requests, read the historical
ledger and the live log book, and (for senior roles) manage buildings, rooms,
user accounts and generated reports.

**How someone moves through it, and what each role is allowed to do**, is
[`APPLICATION-FLOW.md`](./APPLICATION-FLOW.md) — a capability matrix traced to
the predicates that enforce it, with four UML pages in
[`application-flow.drawio`](./application-flow.drawio). This document covers
what is built; that one covers how it behaves.

**The single most important fact: the data is real and the rules are not.**
Firebase Auth is live, eleven collections are in Firestore behind live
`onSnapshot` subscriptions, and a change made by one person persists for the
next. What `src/lib/mock-data.ts` still holds is the seed corpus and the things
generated on purpose — reports, historical records, the power series. But
`firestore.rules` is at the wide-open default and **is not deployed**, so every
role constraint in this document is enforced in the browser and nowhere else.
See §11.2.

### The three roles

| Role | `UserRole` | Rank | What they can do |
| --- | --- | --- | --- |
| Office Staff | `office-staff` | 3 | Scoped to **one building**. Reads everything in it; raises maintenance requests; acts on equipment (except decommission). Sensors are read-only. No Log Book, Reports or Administration. |
| Admin Manager | `admin-manager` | 2 | Whole estate. Acts on requests, sensors and equipment. Reads Log Book and Reports. Manages **user accounts** (Office Staff rows only), but not buildings/rooms. |
| CEO / Super Admin | `ceo-super-admin` | 1 | Everything, including buildings, rooms and any account but their own. |

Lower rank number = more privileged. **Gate on rank, never on role equality**
(`roleRank(role) <= minRank`), so a fourth role can slot into the ladder without
rewriting every check.

### Stack (exact versions from `package.json`)

| | |
| --- | --- |
| Framework | Next.js **16.3.4**, App Router, Turbopack |
| UI runtime | React **19.2.8** / react-dom 19.2.8 |
| Styling | Tailwind CSS **v4** (`@tailwindcss/postcss`), tokens in `src/app/globals.css` |
| Components | shadcn/ui **built on Base UI** (`@base-ui/react` ^1.8.0) — *not* Radix |
| Icons | `lucide-react` ^1.43.0 |
| Toasts | `sonner` ^2.0.8 |
| Theming | `next-themes` ^0.4.6 |
| Lint/format | Biome **2.4.2** |
| Language | TypeScript ^5, `strict` |

Because shadcn here sits on Base UI, **compose with the `render` prop, never
`asChild`**. See `NotificationsMenu` in `src/components/shell/notifications-menu.tsx`
for the pattern (`<PopoverTrigger render={<Button … />}>`).

### Scripts

```bash
npm run dev      # next dev
npm run build    # next build  — check the EXIT CODE, not the "✓ Compiled" line
npm run lint     # biome check
npm run format   # biome format --write
```

There is **no test script and no test runner installed**.

### How to read this document

1. Open `src/lib/types.ts` first — it is the domain model and every page is
   built on it. §4 below reproduces it with commentary.
2. Then `src/lib/derive.ts` (§5) — the rules that look like stored fields and
   are not.
3. Then `src/lib/app-state.tsx` (§6) — the one client store.
4. §8 is the page-by-page walkthrough; read only the page you need.

### Repository facts

- Branch: `feat/design-sync`. Main branch: `main`. 26 commits.
- ~14,100 lines of TypeScript/TSX under `src/`.
- `README.md` is still untouched `create-next-app` boilerplate.

---

## 2. Build status

| Area | Status | Notes |
| --- | --- | --- |
| Login + account-access screens | **Built (demo)** | `/login` is a demo account picker, not real auth. `forgot-password`, `first-sign-in`, `session-expired` are static screens. |
| App shell (sidebar, header, tabs) | **Built** | Three widths implemented: phone tab bar, tablet icon rail, desktop sidebar. |
| Dashboard | **Built** | KPI tiles, power series, estate table, decision list, live alerts, log feed. |
| Equipment | **Built** | Board by default, draggable between condition columns; Register/Board views, filters, detail drawer with history and six actions, new-unit drawer, inline edit/service/move forms. |
| Sensors | **Built** | Grouped by building, alarm rows break the rhythm, actions rendered from the type registry, deep-link via `?sensor=`. |
| Maintenance Requests | **Built** | Kanban/Table views, new-request drawer, forward and backward status moves. |
| Historical Records | **Built** | The Log Book filtered to estate sources (`admin` excluded), over a 90-day subscription. Range/building/source filters, daily grouping, CSV export. |
| Log Book | **Built** | Live feed, source filters, pause. Admin Manager + CEO only. |
| Reports | **Built** | Library + full report view, generate sheet, PDF/CSV buttons. |
| Administration | **Built** | Buildings (CEO) and User Accounts (Admin + CEO), separately gated. The type registries moved to the pages that use them. |
| Settings | **Built** | Your account (writes to `users`), Appearance (working theme picker, no Save — the swatch applies it), Password & sessions. |
| More (phone overflow) | **Built** | Lists the pages the tab bar has no room for. |
| Theming (light/dark) | **Built** | `next-themes` is mounted; `/settings` switches it. |
| Persistence | **Built** | Eleven collections in Firestore, live `onSnapshot` on every one. Only `powerSeries()`, `BUILDING_META` and `EQUIPMENT_TYPES` stay generated. |
| Authentication | **Built** | Firebase Auth, three real accounts, no role switcher. |
| Firebase backend | **Built** | Client SDK only; `firestore.rules` are **not deployed** — see §11.2. |
| Tests | **Built** | Vitest over `src/**/*.test.ts` — the pure rules, the mappers and the export shaping. |

Recent commit history (newest first) shows where the effort has been:

```
2529c95 feat: add units to the register, and remember how each page is shown
173000c refactor(reports): move the report description into a tooltip
45cda8e fix: carry the dark theme through, and inline the sensor edit too
58a62ac feat: apply the dark theme, and five smaller fixes
183ca34 fix: six reported defects across equipment, records, reports and the log book
```

---

## 3. Architecture

### Route tree

```
src/app/
  layout.tsx                  root: fonts, TooltipProvider, Providers, Toaster
  page.tsx                    redirect("/login")
  globals.css                 the whole token sheet

  login/page.tsx              sign-in card + demo account picker
  login/forgot-password/
  login/first-sign-in/
  login/session-expired/      three static account-access screens

  (app)/layout.tsx            the app shell — sidebar, 54px header, demo banner
  (app)/dashboard/page.tsx
  (app)/equipment/page.tsx
  (app)/sensors/page.tsx
  (app)/requests/page.tsx
  (app)/records/page.tsx
  (app)/logbook/page.tsx
  (app)/reports/page.tsx
  (app)/admin/page.tsx
  (app)/settings/page.tsx
  (app)/more/page.tsx
```

The `(app)` route group is a pathless group: it adds the shell layout without
adding a URL segment. `/login` sits outside it and therefore has no shell.

### Root layout — `src/app/layout.tsx`

- Loads **IBM Plex Sans** as a *variable* font (`--font-plex-sans`) — the design
  sets body copy at weight 450, a half-step above regular, which no static cut
  provides — and **IBM Plex Mono** at 400/500/600 (`--font-plex-mono`).
- `<html suppressHydrationWarning>` because next-themes sets the class on
  `<html>` before paint, which the server render cannot know about.
- Wraps everything in `<TooltipProvider delay={150}>` → `<Providers>` →
  `{children}` + `<Toaster />`.
- `metadata`: title "Smart Building Monitoring".

### Provider stack — `src/components/providers.tsx`

```
ThemeProvider (next-themes, attribute="class", defaultTheme="system",
               enableSystem, disableTransitionOnChange)
  └── AppStateProvider        (src/lib/app-state.tsx)
        └── ConfirmProvider   (src/components/shared/confirm-dialog.tsx)
```

`attribute="class"` rather than a data attribute, because `globals.css` defines
the dark palette under `.dark` and Tailwind's `dark:` variant matches that
subtree.

### App shell — `src/app/(app)/layout.tsx`

- `TITLES = [...NAV_ITEMS, ...MORE_ITEMS, ...MOBILE_TABS]`; the header title is
  the first entry whose `href` matches the pathname (exact or prefix).
- Header is `sticky top-0 z-40 h-(--header-h)` (54px) and holds: a brand mark
  (phone only, since there is no sidebar there), the page title, a scope note
  (`"Scoped to <building>"` for Office Staff, otherwise `"All buildings in
  scope"`), then `RoleSwitcher` (desktop only), `NotificationsMenu`,
  `AccountMenu`.
- `<DemoBanner />` sits directly under the header.
- `<main>` has `pb-24` on a phone so the floating tab bar does not cover content.

### Layering rule

```
format.ts  →  derive.ts  →  mock-data.ts  →  app-state.tsx  →  pages
```

`derive.ts` **imports no data** — only `format.ts` and types. That is deliberate:
mock-data (and later a Firebase layer) can apply the rules without an import
cycle, and the rules survive the backend swap untouched.

### Three widths

| Width | Navigation | Implementation |
| --- | --- | --- |
| Phone (`< md`, <768px) | Five bottom tabs | `MobileTabBar`, `fixed inset-x-0 bottom-0`, `md:hidden` |
| Tablet (`md..lg`) | 60px icon rail | First `<aside>` in `AppSidebar`, `w-15 md:flex lg:hidden` |
| Desktop (`lg+`) | 196px sidebar | Second `<aside>`, `w-(--sidebar-w) hidden lg:flex` |

Both drawers (form and detail) become **bottom sheets** on a phone via
`useIsMobile()`.

---

## 4. Data model — `src/lib/types.ts`

All timestamps and dates are **ISO strings**, never `Date` objects. IDs are
strings throughout.

### 4.1 Users and roles

```ts
type UserRole = "office-staff" | "admin-manager" | "ceo-super-admin";

interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  buildingId?: string;   // Office Staff are scoped to one building; others see all
}

interface ManagedUser extends AppUser {
  status: "active" | "suspended";
  lastActiveAt: string;  // ISO
  isSelf?: boolean;      // the signed-in CEO's own row — never editable or suspendable
}
```

`ManagedUser` is the row shape for Administration → User Accounts. The CEO's own
account cannot be edited or suspended from the UI: every estate needs at least
one Super Admin.

### 4.2 Estate

```ts
interface Building { id: string; name: string; }

type RoomType = "lecture" | "lab" | "office" | "plant" | "common";

interface Room {
  id: string;
  buildingId: string;
  roomNumber: string;
  type: RoomType;
  floor: string;   // "G" | "1" | "2" | "3" — a string, because ground floors vary
}
```

Confirmed scope: **Building 216, Building 209, Junction Square**. A source
comment records that room numbers for 209 and Junction Square are still pending
tutor confirmation; only 216's (202, 301, 302, 303, …) are locked in.

### 4.3 Equipment

Two levels coexist and mean different things.

**Room-level counts** — how many of a type are in a room and what state they are
in:

```ts
interface EquipmentTypeDef { id: string; label: string; }   // data-driven registry

interface Equipment {
  id: string;
  buildingId: string;
  roomId: string;
  typeId: string;          // → EquipmentTypeDef.id
  quantity: number;
  running: number;
  faulty: number;
  underMaintenance: number;
  updatedAt: string;
}
```

> **Invariant:** `running + faulty + underMaintenance === quantity`. This holds
> for every equipment type, even ones that are usually singular (one projector
> per room) — same shape everywhere, no branching.

**Asset-level units** — one physical, taggable thing, which is what the register,
the board and the detail drawer actually operate on:

```ts
type EquipmentCondition =
  | "healthy" | "faulty" | "under-maintenance" | "decommissioned";

interface EquipmentUnit {
  id: string;
  tag: string;              // e.g. "EQ-216-01"
  buildingId: string;
  roomId: string;
  typeId: string;
  condition: EquipmentCondition;
  installedAt: string;      // ISO date
  nextServiceDue: string;   // ISO date
  openRequestCount: number;
  lastServiceAt?: string;
}

type EquipmentHistoryEventType =
  | "installed" | "service" | "moved"
  | "fault-reported" | "returned-to-service" | "decommissioned";

interface EquipmentHistoryEvent {
  id: string;
  equipmentUnitId: string;
  type: EquipmentHistoryEventType;
  at: string;
  summary: string;
  actorName: string;
}
```

`decommissioned` units are hidden from the register by default.

### 4.4 Sensors

Each sensor **type** declares its own valid states and its own actions, so the
UI never needs to know in advance what a given sensor looks like:

```ts
interface SensorAction {
  id: string;             // "reset" | "lock" | "unlock"
  label: string;
  caption: string;        // what the action does, shown under the label
  resultStatus: string;   // the status this action transitions to
  requiresNote?: boolean; // fire-alarm reset requires a written reason
  allowedRoles: UserRole[];
}

interface SensorTypeDef {
  id: string;             // "fire-alarm" | "door-lock"
  label: string;
  statuses: string[];     // this type's own valid states
  actions: SensorAction[];
}

interface EnvironmentalSensor {
  id: string;
  buildingId: string;
  roomId: string;
  typeId: string;
  status: string;              // one of that type's statuses
  linkedEquipmentId?: string;  // the other half of a physically unified device
  updatedAt: string;
}
```

Registry as seeded:
- `fire-alarm` — statuses *normal / triggered / offline*; action **Reset**
  (`requiresNote`, Admin Manager + CEO).
- `door-lock` — statuses *locked / unlocked / forced-open / offline*; actions
  **Lock**, **Unlock**.

> **The two-record rule.** A fire detector is **two records**: an
> `EquipmentUnit` (the asset you tag, service and decommission) and an
> `EnvironmentalSensor` (its live state). They are joined by
> `linkedEquipmentId` and **never merged**. Each drawer points at the other via
> `SameDevicePanel` rather than duplicating its fields. Helpers:
> `sensorForEquipment()` and `equipmentForSensor()` in `src/lib/mock-data.ts`.

### 4.5 Maintenance requests

```ts
type RequestPriority = "normal" | "high";
type RequestStatus = "pending" | "in-progress" | "resolved" | "completed";

interface MaintenanceRequest {
  id: string;
  buildingId: string;
  roomId: string;
  equipmentId: string;
  issue: string;
  priority: RequestPriority;
  status: RequestStatus;
  submittedBy: string;       // uid
  submittedByName: string;
  submittedAt: string;
  updatedAt: string;
  notes?: string;            // resolution notes from Admin Manager / CEO
}
```

Workflow: Office Staff submits → Admin Manager/CEO is notified → they action it
→ Office Staff watches the status read-only.

**"Escalated" is not a field.** It is computed from `priority`, `status` and
`submittedAt` (see `isEscalated`), so the threshold can change without a data
migration.

### 4.6 Ledgers

Two ledgers, deliberately distinct.

```ts
type HistoricalRecordType = "alarm" | "request" | "service" | "access" | "system";

interface HistoricalRecord {
  id: string;
  timestamp: string;
  type: HistoricalRecordType;
  buildingId?: string;   // absent for estate-wide system entries
  roomId?: string;
  text: string;
  refId?: string;        // linked REQ-/EQ- id
  actorName: string;     // "System" for automated entries
}
```

**Historical Records** is the long-range chronological ledger of *everything the
system did* — alarms, requests, services, access events, system entries — not
just resolved requests. Available to **every role**. Filter by range/building/
type and export the filtered set to CSV.

```ts
type LogActionType =
  | "equipment-status-changed" | "request-created" | "request-status-changed"
  | "sensor-status-changed" | "building-added" | "building-edited"
  | "user-added" | "user-role-changed";

type LogBookSource = "alert" | "sensor" | "request" | "equipment" | "access" | "admin";

interface LogBookEntry {
  id: string;
  timestamp: string;
  actorUid?: string;
  actorName: string;          // "Sensor network" / "System · schedule" when automated
  actorRole?: UserRole;
  source: LogBookSource;
  actionType: LogActionType;
  title: string;
  detail: string;
  targetType: "building" | "room" | "equipment" | "sensor" | "request" | "user";
  targetId: string;
  buildingId?: string;
  refId?: string;
}
```

**Log Book** is the live, short-range feed (today / this shift), scoped to
**Admin Manager and CEO only**. Entries are always written by the system, never
composed by hand.

### 4.7 Reports

```ts
type ReportKind = "maintenance-performance" | "equipment-reliability" | "cost-of-maintenance";
type ReportStatus = "ready" | "scheduled" | "archived";

interface Report {
  id: string;
  kind: ReportKind;
  period: string;        // "August 2026" | "01–08 Sep 2026"
  buildingId?: string;   // absent = whole estate
  generatedAt: string;
  generatedBy: string;   // "System · schedule" or a person's name
  status: ReportStatus;
}

interface ReportKpi {
  label: string; value: number; unit: string;
  target: number; compare: "gte" | "lte" | "lt";
  targetLabel: string;   // "Target ≥ 90%"
}

interface ReportWeek      { label: string; resolved: number; carriedOver: number; }
interface ReportFaultType { typeLabel: string; count: number; }
interface ReportOffender  { tag: string; unitLabel: string; faults: number;
                            downtimeHours: number; costMmk: number; }
interface ReportCostLine  { label: string; valueMmk: number; isTotal?: boolean; }

interface ReportDetail extends Report {
  kpis: ReportKpi[];
  weeks: ReportWeek[];
  faultTypes: ReportFaultType[];
  offenders: ReportOffender[];
  costs: ReportCostLine[];
  budgetMmk: number;
  spentMmk: number;
  notes: string;
}
```

Costs are in **MMK** (Myanmar kyat), formatted by `formatMmk()`.

### 4.8 What is deliberately NOT stored

Six values look like fields and are computed at read time instead, so a
threshold change is an edit to `derive.ts` and not a data migration:

| Value | Derived by |
| --- | --- |
| Request escalated | `isEscalated()` — high + open + older than 24h |
| Equipment due for service | `isDueService()` — healthy + within 30 days of `nextServiceDue` |
| Sensor offline | `isSensorOffline()` |
| Sensor in alarm | `isAlarmStatus()` |
| Open-request counts | `countOpenRequests()` / `countEscalated()` |
| Report KPI pass/fail | `kpiPasses()` |

---

## 5. Function reference

### 5.1 `src/lib/format.ts`

| Signature | Behaviour |
| --- | --- |
| `ageHours(iso: string, now = Date.now()): number` | Whole hours since `iso`, clamped at 0. |
| `formatAge(iso, now?): string` | `"7h"` under a day, `"3d"` beyond. |
| `isAging(iso, priority: "normal" \| "high", now?): boolean` | High priority and older than 24h. *(Superseded in practice by `derive.isEscalated`, which also checks the status.)* |
| `formatClock(date = new Date()): string` | `HH:MM:SS`, en-GB. |
| `formatTime(iso): string` | `HH:MM`, en-GB. |
| `formatDayLabel(iso): string` | `"Mon, 15 Sep"`. |
| `formatDate(iso): string` | `"15 Sep 2026"`. |
| `formatMmk(value: number): string` | `"1,250,000 MMK"`, rounded, thousands-separated. |
| `formatRelative(iso): string` | `"just now"` / `"7h ago"` / `"3d ago"` / falls back to `formatDate` past 30 days. |

> **Hydration rule:** never call `formatClock()` during render. The prerendered
> HTML and the first client render would disagree by a second and hydration
> fails. Use `useLiveClock()` instead (§5.6).

### 5.2 `src/lib/derive.ts`

Thresholds — **change them here, nowhere else**:

```ts
const ESCALATION_WINDOW_HOURS = 24;   // a high-priority open request older than this is escalated
const DUE_SERVICE_DAYS = 30;          // a healthy unit this close to service shows as due
```

| Signature | Behaviour |
| --- | --- |
| `OPEN_REQUEST_STATUSES: RequestStatus[]` | `["pending", "in-progress"]`. |
| `isRequestOpen(status): boolean` | Pending or in-progress. |
| `isEscalated(request, status = request.status, now?): boolean` | High priority **and** open **and** `ageHours(submittedAt) > 24`. Pass the live status when the request carries an in-session override. |
| `countOpenRequests(requests, buildingId?): number` | **The** open count. Callers pass an already-resolved list so in-session moves are reflected; omit `buildingId` for the whole estate. |
| `countEscalated(requests, buildingId?, now?): number` | Same shape, for escalated requests. |
| `type EquipmentBoardColumn = EquipmentCondition \| "due-service"` | The board's four conditions plus a computed fifth column. |
| `daysUntilService(unit, now?): number` | `ceil` of days to `nextServiceDue`; negative when overdue. |
| `isDueService(unit, condition = unit.condition, now?): boolean` | Healthy **and** ≤30 days out. A *view* of a healthy unit, never a stored condition — which is why it can be a board column without being an `EquipmentCondition`. |
| `boardColumnFor(unit, condition?, now?): EquipmentBoardColumn` | `"due-service"` when `isDueService`, else the condition. |
| `isSensorOffline(status): boolean` | `status === "offline"`. An offline device raises no alarms, so screens showing one must say so rather than imply all-clear. |
| `isAlarmStatus(status): boolean` | `"triggered"` or `"forced-open"`. |
| `kpiPasses(kpi: ReportKpi): boolean` | Value against target by `compare` (`gte`/`lte`/`lt`). Never a stored flag, so a target can move without rewriting generated reports. |

> **Never re-implement one of these inline.** The sidebar badge, toolbar chips,
> building cards and dashboard tiles all read the same helpers, which is the
> only reason they cannot disagree.

### 5.3 `src/lib/permissions.ts`

| Signature | Behaviour |
| --- | --- |
| `roleRank(role): 1 \| 2 \| 3` | ceo 1, admin 2, staff 3. |
| `roleLabel: Record<UserRole, string>` | "Office Staff" / "Admin Manager" / "CEO / Super Admin". |
| `canAct(role): boolean` | `role !== "office-staff"`. |
| `canAdvanceRequest(role)` | `canAct`. |
| `canActOnSensor(role)` | `canAct`. Sensors are read-only for Office Staff. |
| `canDecommissionEquipment(role)` | `canAct`. The **only** equipment action closed to Office Staff. |
| `canAccessReports(role)` | `canAct`. |
| `canAccessLogBook(role)` | `canAct`. |
| `canAccessAdministration(role)` | `canManageEstate \|\| canManageAccounts`. |
| `canManageEstate(role)` | CEO only — buildings and rooms. |
| `canManageAccounts(role)` | `roleRank(role) <= 2` — Admin Manager and CEO. |
| `canEditUser(actor, target, isSelf = false)` | `false` for self; CEO may edit anyone else; Admin Manager may edit **Office Staff rows only**. |
| `userEditLockReason(actor, target): string` | The tooltip for a padlocked user row. |
| `isBuildingLocked(role): boolean` | True for Office Staff — the building filter is **disabled rather than absent**, so the scope is visible rather than hidden. |

Lock-reason strings (these are the tooltips shown on padlocked controls):

```ts
SENSOR_LOCK_REASON       = "Sensors are read-only for Office Staff — raise a maintenance request instead."
DECOMMISSION_LOCK_REASON = "Decommissioning is limited to Admin Managers and the CEO."
ESTATE_LOCK_REASON       = "Buildings and rooms are managed by the CEO / Super Admin."
```

> **A control a role may not use stays on screen under a padlock with the reason
> in its tooltip. It is never hidden.** The design shows people what exists and
> why they cannot reach it.

Administration is split deliberately: one page, two tabs, two different gates.
An Admin Manager lands on User Accounts with the Buildings tab padlocked.

### 5.4 `src/lib/nav.ts`

```ts
interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  minRank: 1 | 2 | 3;          // visible when roleRank(role) <= minRank
  badgeKey?: "openRequests";
}
interface MoreItem extends NavItem { detail: string; }
```

`NAV_ITEMS` (8, desktop sidebar + tablet rail):

| Label | Href | Icon | minRank | Badge |
| --- | --- | --- | --- | --- |
| Dashboard | `/dashboard` | LayoutGrid | 3 | |
| Equipment | `/equipment` | Box | 3 | |
| Sensors | `/sensors` | Waves | 3 | |
| Maintenance Requests | `/requests` | Wrench | 3 | `openRequests` |
| Historical Records | `/records` | History | 3 | |
| Log Book | `/logbook` | ClipboardList | 2 | |
| Reports | `/reports` | BarChart3 | 2 | |
| Administration | `/admin` | ShieldCheck | 2 | |

`MOBILE_TABS` (5): Home `/dashboard`, Requests `/requests` (badged), Sensors,
Equipment, More `/more`.

`MORE_ITEMS` (5, listed on `/more` with a one-line `detail`): Historical
Records, Log Book, Reports, Administration, **Settings**.

Note what is *not* in the sidebar: the estate lives inside Administration rather
than having its own entry, and **Settings is reached from the account menu and
`/more`**, not the sidebar.

### 5.5 `src/lib/mock-data.ts` (~1,800 lines)

**Dataset census:** 3 buildings · 19 rooms · 10 equipment types · 19 equipment
units · 2 sensor types · 17 sensors · 14 maintenance requests · 3 current users
+ 8 managed users · 18 log-book entries · 13 reports · a generated Historical
Records ledger.

Exported constants:

| Export | Shape / contents |
| --- | --- |
| `BUILDINGS` | `Building[]` — b216, b209, Junction Square. |
| `BUILDING_META` | `Record<string, { code, address, description, photoHint }>` — the copy the Administration Buildings tab renders. |
| `ROOMS` | `Room[]`, 19 rooms across the three buildings. |
| `BUILDING_LOAD_KW` | `Record<string, number>` — base electrical load per building, the seed for `powerSeries()`. |
| `EQUIPMENT_TYPES` | `EquipmentTypeDef[]`, 10 entries (projector, air handling unit, card reader, fire sensor, …). |
| `EQUIPMENT` | `Equipment[]` — the room-level count breakdown. |
| `EQUIPMENT_UNITS` | `EquipmentUnit[]`, 19 taggable assets (`EQ-216-01`, …). |
| `EQUIPMENT_HISTORY` | `EquipmentHistoryEvent[]` — the timeline shown in the equipment detail drawer. |
| `SENSOR_TYPES` | `SensorTypeDef[]` — `fire-alarm` and `door-lock`, each carrying its own `statuses[]` and `actions[]`. |
| `SENSORS` | `EnvironmentalSensor[]`, 17 devices. |
| `LIVE_ALARM_SENSOR_ID` | `"FD-216-14"` — the detector the demo timer trips. |
| `MAINTENANCE_REQUESTS` | `MaintenanceRequest[]`, 14 seeded requests at mixed ages/priorities. |
| `REQUEST_NEXT_STATUS` | pending → in-progress → resolved → completed. |
| `REQUEST_PREV_STATUS` | The same walk backwards. |
| `REQUEST_NEXT_ACTION` | The button label for each forward step ("Start work", "Mark resolved", …). |
| `REQUEST_PREV_ACTION` | The button label for each backward step. |
| `CURRENT_USERS` | `Record<UserRole, AppUser>` — the signed-in identity per role, used by the role switcher. |
| `MANAGED_USERS` | `ManagedUser[]`, 8 rows for Administration → User Accounts (one flagged `isSelf`). |
| `HISTORICAL_RECORDS` | `HistoricalRecord[]` built by an IIFE from a **seeded PRNG** (`seededRandom`, `pick`, `HR_PEOPLE`), so the ledger is long, varied and identical on every load. |
| `LOG_BOOK` | `LogBookEntry[]`, 18 authored entries. |
| `LOG_BOOK_SOURCE_META` | `Record<LogBookSource, { label }>` — the uppercase label for each source (`ALERT`, `SENSOR`, …). Tones live in the pages. |
| `ATTENTION_ITEMS` | `AttentionItem[]` — the dashboard's "needs attention" rail (non-alarm items; the live fire alarm is injected separately). |
| `REPORTS` | `Report[]`, 13 library entries across the three kinds and three statuses. |

Exported helpers:

| Signature | Behaviour |
| --- | --- |
| `buildingStats(buildingId)` | `{ faulty, maint, openReq, escalated, roomCount, kw }` for one building, counted off `EQUIPMENT_UNITS` conditions and `BUILDING_LOAD_KW`. **Its `openReq`/`escalated` are seed figures only** — a source comment says so; anything on screen counts through `useAppState` instead, so it reflects this session's moves. |
| `roomsForBuilding(buildingId): Room[]` | Filter of `ROOMS`. |
| `roomLabel(roomId): string` | Human room label from an id. |
| `buildingName(buildingId): string` | Human building name from an id. |
| `sensorForEquipment(equipmentUnitId)` | The sensor half of a two-record device, or undefined. |
| `equipmentForSensor(sensorId)` | The equipment half, or undefined. |
| `equipmentUnitLabel(u: EquipmentUnit): string` | Type label + location, e.g. "Projector · 216 / 302". |
| `powerSeries(buildingId, bars = 24): number[]` | Deterministic 24-bar kW curve for the dashboard sparkline — a base load per building, a midday sine bulge and a small seeded wobble. Not live, but shaped like it. |
| `reportDetail(report: Report): ReportDetail` | Expands a library row into the full report — KPIs, weekly resolution, fault types, worst offenders, cost lines, budget and notes. |

Internal (not exported): `typeLabel(typeId)`, `seededRandom(seed)`,
`pick(rnd, arr)`, `HR_PEOPLE`.

### 5.6 `src/hooks/`

| Hook | Behaviour |
| --- | --- |
| `useLiveClock(): string \| null` (`use-live-clock.ts`) | Returns `null` until mount, then a ticking `HH:MM:SS` every second. Callers render a placeholder until the first tick. Exists **because** reading the time during render breaks hydration. |
| `useIsMobile(): boolean` (`use-mobile.ts`) | `matchMedia` against a 768px breakpoint; `false` until mount. |
| `usePersistedState<T>(key, fallback): [T, setter]` (`use-persisted-state.ts`) | `localStorage` under the `sbm:` prefix. Reads **after mount** (the server has no localStorage) and refuses to write the fallback back over a stored value before it is read. Every access is wrapped in `try/catch` — private windows and blocked site data both throw. |

> **What `usePersistedState` is for:** how a page is *shown* — which view is
> selected, what is collapsed, how a list is sorted. **Not** what is being
> *looked at*: search text and data filters are task-scoped, and silently
> restoring them leaves someone staring at a filtered list wondering where their
> records went.

---

## 6. Client state — `src/lib/app-state.tsx`

`useAppState()` is the single client-side store. It throws if used outside
`AppStateProvider`. There is no other global state anywhere in the app.

### 6.1 The `AppState` surface

**Identity and scope**

| Field | Behaviour |
| --- | --- |
| `role: UserRole` | Initial value `"admin-manager"`. |
| `setRole(role)` | Switches role; switching **to** `office-staff` also pins `activeBuildingId` to that user's building (`CURRENT_USERS["office-staff"].buildingId ?? "b216"`). |
| `currentUser: AppUser` | `CURRENT_USERS[role]`, with `buildingId` set only for Office Staff. |
| `activeBuildingId: string` | Initial `"b216"`. |
| `setActiveBuildingId(id)` | **A no-op when the role is `office-staff`** — their scope is fixed. |

**The demo clock and alarm**

| Field | Behaviour |
| --- | --- |
| `elapsed: number` | Seconds since mount/reset, ticked by a 1s interval. |
| `alarmActive: boolean` | `elapsed >= 20`. |
| `alarmSeconds: number` | `max(0, elapsed - 20)` — how long the alarm has been ringing. |
| `liveAlarmSensorId: string` | `LIVE_ALARM_SENSOR_ID` (`"FD-216-14"`). |

When `alarmActive` first flips true, a one-shot effect (guarded by a
`useRef`) unshifts a `danger`-toned, pulsing "Fire alarm triggered" notification.
The ref resets when `alarmActive` goes false, so `resetDemo()` re-arms it.

**Notifications**

`notifications: Notification[]` (seeded with three `BASE_NOTIFICATIONS`),
`unreadCount`, `markNotificationRead(id)`, `markAllNotificationsRead()`.

```ts
interface Notification {
  id: string;
  tone: "danger" | "warning" | "info" | "neutral";
  title: string; detail: string; time: string;
  read: boolean; pulse?: boolean;
}
```

**Requests — the one list and the one count**

```ts
requests        // every request with this session's moves applied
scopedRequests  // the same list narrowed to what the signed-in role may see
openRequestCount
```

Resolution chain:

1. `requests` = `[...createdRequests, ...MAINTENANCE_REQUESTS]` with each
   record's `status` replaced by `requestOverrides[id] ?? r.status`.
2. `scopedRequests` = for Office Staff, `requests` filtered to
   `activeBuildingId`; for everyone else, `requests` unchanged.
3. `openRequestCount` = `countOpenRequests(scopedRequests)`.

> The sidebar badge, the tablet rail badge, the phone tab badge, the Requests
> toolbar chip, the dashboard tiles and the building cards **all** read
> `openRequestCount`. That is the only reason they cannot disagree. Do not
> recount open requests anywhere.

| Mutator | Behaviour |
| --- | --- |
| `addRequest(request)` | Unshifts onto `createdRequests`. |
| `requestStatus(req)` | The live status for one request (override, else stored). |
| `moveRequest(id, "next" \| "prev")` | Walks the request exactly **one** step along `REQUEST_NEXT_STATUS` / `REQUEST_PREV_STATUS`; a no-op at either end. The submitted-at age never resets, so an escalated request stays escalated. |

**Sensor and equipment overrides**

| Mutator | Behaviour |
| --- | --- |
| `sensorStatus(sensorId, fallback): string` | Override, else the seeded status. |
| `setSensorStatus(sensorId, status)` | Records an override. |
| `equipmentCondition(unitId, fallback): EquipmentCondition` | Override, else the seeded condition. |
| `setEquipmentCondition(unitId, condition)` | Records an override. |

**Reset**

`resetDemo()` clears `elapsed`, the alarm ref, notifications, request overrides,
created requests, sensor overrides and equipment overrides — everything back to
the seed.

### 6.2 The point of the override maps

An action taken on one page must be visible on every other page. Marking a unit
faulty in the equipment drawer changes the register, the board column, the
building card and the dashboard tile, because they all resolve through the same
override map rather than holding their own copies.

**Limitation:** every override is React state. A reload, a hard refresh or a
dev-server restart loses the lot. This is intentional demo behaviour, not a bug.

---

## 7. Shared components and container rules

### 7.1 `src/components/shared/`

**`tone-badge.tsx`**

```ts
type Tone = "success" | "warning" | "danger" | "info" | "neutral";
<ToneBadge tone={Tone} {...HTMLAttributes<HTMLSpanElement>} />
toneDotClass(tone: Tone): string
```

Every status, priority, condition and record type in the app renders through
`ToneBadge` — small-caps mono, `bg-*-muted text-*-foreground`. `toneDotClass()`
gives the raw solid-colour dot class for cases that need a dot rather than a
badge.

**`pulse-dot.tsx`** — `<PulseDot tone pulse? className? />`. A 6px dot,
optionally `animate-sb-pulse`. Use it **only where something is genuinely
happening now**.

**`empty-state.tsx`** — `<EmptyState className?>{children}</EmptyState>`. The
dashed-border box for an empty list or a filter that matched nothing.

**`access-denied.tsx`** — `<AccessDenied title body actionLabel? onAction? />`.
The role-locked page: a padlock, what role is required, and an optional button
that switches to a role that can see it.

**`confirm-dialog.tsx`**

```ts
type ConfirmTone = "danger" | "warning" | "info";

interface ConfirmOptions {
  title: string;
  body: React.ReactNode;
  tone?: ConfirmTone;
  note?: React.ReactNode;        // what the action costs, in its own numbers
  confirmLabel?: string;
  cancelLabel?: string;
  requireReason?: boolean;       // the ONE field allowed in a modal
  reasonPlaceholder?: string;
}

interface ConfirmResult { confirmed: boolean; reason?: string; }

const confirm = useConfirm();                       // → (o: ConfirmOptions) => Promise<ConfirmResult>
const { confirmed, reason } = await confirm({ … });
```

`note` must say what the action costs **in its own numbers** — "Its 6 devices
stop reporting", not "This cannot be undone". `requireReason` is set by
fire-alarm reset and decommission, and the action refuses to proceed without it.

**`form-drawer.tsx`**

```tsx
<FormDrawer open onOpenChange title description? submitLabel
            cancelLabel? onSubmit error? submitDisabled?>
  <FormField label hint? className?>{control}</FormField>
  <FormFieldLocked label value icon? />
</FormDrawer>
```

The 392px right drawer (`--drawer-form-w`). Everything that takes fields —
creating and editing buildings, rooms, users, sensors and reports — opens here,
so the shape of a form never changes between pages. `title` renders as a
small-caps kicker ("NEW BUILDING"). `FormFieldLocked` is the read-only variant:
padded with a lock rather than hidden.

**`detail-drawer.tsx`**

```tsx
<DetailDrawer open onOpenChange size="wide" | "narrow">
  <DetailDrawerHeader tag chip action? onClose>…</DetailDrawerHeader>
  <DetailMetaGrid><DetailMeta label value tone? /> …</DetailMetaGrid>
  <DetailDrawerSection label? className?>…</DetailDrawerSection>
  <SameDevicePanel id note linkLabel onOpen />
  <DrawerActionGrid>
    <DrawerAction icon label caption? lockedReason? tone="default"|"danger" onClick />
  </DrawerActionGrid>
  <DrawerInlineForm title description? submitLabel onSubmit onCancel error?>
    <DrawerField label className?>{control}</DrawerField>
  </DrawerInlineForm>
</DetailDrawer>
```

- `size="wide"` = 412px (`--drawer-detail-w`), for equipment, which carries a
  photo and six actions. `size="narrow"` = 392px, for a sensor.
- `SameDevicePanel` is the cross-link between the two records that describe one
  physical device — neither drawer duplicates the other's fields, it points at
  it.
- `DrawerAction` with `lockedReason` set renders disabled, with a padlock icon
  replacing its own icon and the reason in the `title` tooltip.
- `DrawerInlineForm` keeps editing, recording a service and moving a unit
  **inside** the record's own drawer — stacking a second drawer on top would
  bury the record you are editing.

### 7.2 Container rules — fixed across every page

| Situation | Container |
| --- | --- |
| Anything with fields | Form drawer, 392px right (bottom sheet on a phone) |
| A record with history and actions | Detail drawer, 412px (392 `narrow`) |
| A decision only | Centred confirm modal, 452px (`--modal-w`), whose `note` says what the action costs in its own numbers |
| Every result | **One** toast, bottom-left, six seconds, **no undo** |

### 7.3 `src/components/shell/`

| Component | Behaviour |
| --- | --- |
| `AppSidebar` | Renders two `<aside>` elements: the tablet 60px icon rail (`md:flex lg:hidden`) and the desktop 196px sidebar (`hidden lg:flex`). Filters `NAV_ITEMS` by `roleRank(role) <= item.minRank` and paints the `openRequests` badge. "Maintenance Requests" is the one label 196px cannot hold beside a badge, so it truncates and keeps its tooltip. |
| `MobileTabBar` | `md:hidden`, fixed to the bottom, five `MOBILE_TABS` at 48px minimum targets so they can be hit one-handed in a corridor. |
| `AccountMenu` | Avatar with initials, name and role label; dropdown to Settings (`/settings`) and sign-out (`/login`). |
| `NotificationsMenu` | Bell with an unread count badge; 392px popover (`--menu-notif-w`) listing notifications with tone dots, mark-one-read and mark-all-read. Composed with Base UI's `render` prop. |
| `RoleSwitcher` | **Demo scaffolding.** Three segmented buttons that call `setRole`. Desktop header only. |
| `DemoBanner` | **Demo scaffolding.** States that data is simulated, counts `elapsed` seconds, announces the fire alarm once `alarmActive`, and offers "Restart demo" → `resetDemo()`. |

---

## 8. Page-by-page walkthrough

Every page is `"use client"`, and its sub-components are **colocated in the same
file** rather than split out. Business logic stays in `lib/`; pages read from
`useAppState()`, which resolves the Firestore subscriptions.

### 8.1 `/login` and the account-access screens

**`src/app/login/page.tsx`** (178 lines) — a single 420px card outside the app
shell.

- Brand mark, "Sign in" heading, email + password inputs (email defaults to
  `CURRENT_USERS[role].email`, password to a placeholder), a "Keep me signed in"
  checkbox and a "Forgot password" link.
- `handleSignIn` **does not validate anything** — it calls
  `router.push("/dashboard")`.
- Below a separator, **Demo accounts**: three buttons (`DEMO_ACCOUNTS`) that
  call `setRole()` and show which one is currently previewing. The card's footer
  reads "Currently previewing as <role>".
- Footer links to `/login/first-sign-in` and `/login/session-expired` so a
  reviewer can reach those states.

**`/login/forgot-password`** (141 lines) — local `email`, `error`, `sent`,
`expiry`, `resendCooldown` state. Validates only that the address contains `@`;
on send, computes a 30-minute expiry with `formatClock()`, flips to a
confirmation panel and starts a 30-second resend cooldown counted down by a
`setTimeout` effect.

**`/login/first-sign-in`** (125 lines) — set-your-password screen for a new
account (`NEW_USER_EMAIL`). A `RULES` array of four live-checked rules (≥10
characters, one uppercase, one number, both fields match); the submit button is
inert until `allMet`, then pushes `/dashboard`.

**`/login/session-expired`** (66 lines) — a blurred ghost of the Requests page
behind a scrim, with a warning-topped card: signed out after 30 minutes idle,
nothing lost. Both buttons return to `/login`.

None of these screens talk to any auth system.

### 8.2 `/dashboard` (523 lines)

**Role gate:** none — every role sees it, but Office Staff (`staff = !canAct(role)`)
get a reduced version.

**Layout:** `xl:grid-cols-[1fr_308px]` — a main column and a right rail that
stacks underneath on narrow widths.

**Main column, top to bottom:**

1. **Building header.** A `<select>` of `BUILDINGS` bound to `activeBuildingId`,
   rendered **only for non-staff** (Office Staff have no choice to make).
   Beneath it, "<n> rooms monitored · last poll <clock>", where the clock comes
   from `useLiveClock()` and renders `—` until the first tick. On the right, a
   status pill: `ALARM · <n>s` in danger tones when
   `activeBuildingId === "b216" && alarmActive`, otherwise `ALL NORMAL` in
   success tones, both with a pulsing dot.

2. **Equipment status card.** Sums `running` / `underMaintenance` / `faulty`
   across `EQUIPMENT` rows for the active building into four `Stat` tiles, plus
   a three-segment proportional bar. Links to `/equipment`.

3. **Power consumption card.** `powerSeries(activeBuildingId)` → 24 bars;
   headline is the last bar as current kW demand, and `kwhToday` is the mean bar
   × 24. Marked LIVE with a pulsing dot.

4. **Estate overview table.** One row per building (**only the active one for
   Office Staff**), showing a tone dot, room count, a status word
   (Attention/In service/Normal derived from `buildingStats`), faulty count,
   maintenance count, `countOpenRequests(scopedRequests, b.id)` and load in kW.
   The open count comes from the shared helper, never a local recount.

5. **Requests needing a decision.** `scopedRequests` filtered to open, sorted
   **escalated first then oldest first**, capped at four. Escalated rows get a
   `bg-danger-muted/40` wash and a danger-toned age. Each row has an **Advance**
   button calling `moveRequest(r.id, "next")`, `disabled` for Office Staff with
   a padlock icon in the button. A `countEscalated()` badge sits in the header;
   an `EmptyState` shows when the queue is empty.

**Right rail:**

- **Live alerts.** When the demo alarm is active it leads with a danger card for
  `FD-216-14` (Building 216 / Room 302) counting `alarmSeconds`, whose
  *Acknowledge* button links to `/sensors` — or renders as a padlocked disabled
  button for Office Staff (note the Base UI `render` / `nativeButton` pattern
  used to switch a `Button` between a link and a plain button). Then every
  `ATTENTION_ITEMS` entry, filtered to the active building for Office Staff.
- **Log Book — live.** The first seven `LOG_BOOK` entries (building-filtered for
  Office Staff), each a timestamp + title + actor, ending in a link to
  `/logbook`.

**Local helper:** `Stat({ value, label, className })` — the mono numeral over a
muted caption.

### 8.3 `/equipment` (1,106 lines)

The asset register. Operates on **`EquipmentUnit`** records (taggable assets),
not on the room-level `Equipment` counts.

**Role gate:** none. Every role reads and acts; only *Decommission* and *Delete*
are closed to Office Staff (`canDecommissionEquipment`), and the building filter
is disabled for them (`isBuildingLocked`).

**Persisted (`usePersistedState`):** `equipment.view` (`"register" | "board"`)
and `equipment.showDecommissioned` (boolean). Search text, building filter and
type filter are **deliberately not persisted**.

**Toolbar** (wraps at every width): search over tag / type label / room label;
a building `<select>` (disabled with a tooltip for Office Staff, whose scope is
forced to `activeBuildingId`); a type `<select>` over `EQUIPMENT_TYPES`; a
Show/Hide decommissioned toggle; then three `Chip` counters — units in scope,
`!<faulty>`, and units due for service within `DUE_SERVICE_DAYS`; then the
Register/Board `ViewButton` pair; then **+ New unit**.

Every unit's live condition is resolved through
`conditionOf(u) = equipmentCondition(u.id, u.condition)`, so in-session changes
show immediately.

**Register view** — a table with columns Tag · Type · Location · Condition ·
Installed · Next service · Requests · Detail. Faulty rows carry a 3px danger
left border, due-service rows a warning one. Clicking a row opens the detail
drawer. `EmptyState` when nothing matches.

**Board view** — Kanban columns from `BOARD_ORDER` (`healthy`, `due-service`,
`faulty`, `under-maintenance`), plus `decommissioned` when the toggle is on.
Each unit is placed by `boardColumnFor(u, conditionOf(u))`. Cards show the tag,
days to service (`"12d"`, or `"5d over"` when negative), type and room. Column
accents come from `COLUMN_META`.

**`NewUnitDrawer`** — a `FormDrawer` (there is no record open yet, so it gets
its own drawer). Fields: asset tag, equipment type, building + room (room list
follows the building), installed date, service interval (90/180/365 days).
Validates that the tag is non-empty and not already on the register, then
toasts. Resets its fields on every open.

**`EquipmentDrawer`** — the wide (412px) `DetailDrawer`. Rendered *closed*
rather than unmounted when nothing is selected, so it animates out.

- **Header:** tag, condition `ToneBadge`, an **Edit details** button and a
  **Delete** button (padlocked with `DECOMMISSION_LOCK_REASON` for Office
  Staff). Below, a photo slot — a `<label>` wrapping a hidden file input that
  stores a local `URL.createObjectURL` preview, with a Remove link.
- **`DetailMetaGrid`:** Installed · Next service (warning-toned when due) ·
  Open requests · Last service · Service due in (`"12 days"` / `"5 days over"`)
  · Condition.
- **`SameDevicePanel`** when `sensorForEquipment(unit.tag)` finds the other half
  of the device; opening it closes the drawer and routes to
  `/sensors?device=<sensorId>`.
- **Six actions** in a `DrawerActionGrid`:

  | Action | Result | Confirm |
  | --- | --- | --- |
  | Mark faulty | condition → `faulty` | danger, with a note that it shows as faulty everywhere it is counted |
  | Return to service | → `healthy` | info |
  | Under maintenance | → `under-maintenance` | warning |
  | Record a service | opens `ServiceForm` inline | — |
  | Move unit | opens `MoveForm` inline | — |
  | Decommission | → `decommissioned` | danger, **`requireReason`**, note says it drops out of every count while its history stays |

  **Delete** (in the header) is distinct from Decommission: decommission retires
  a unit but keeps it on the books; delete removes the asset record outright,
  which is why it also asks for a reason. A line under the grid states that
  every action writes a Log Book entry.

- **Inline forms** (`DrawerInlineForm`, so the record stays visible):
  `EditUnitForm` (tag, type, installed, service interval; tag must be
  non-empty), `ServiceForm` (parts, cost), `MoveForm` (building + room).
- **History:** `EQUIPMENT_HISTORY` filtered to the unit, each entry a dot,
  summary, `formatRelative(at)` and actor.

**Local helpers:** `typeLabel(typeId)`, `Chip`, `ViewButton`, and the
`COLUMN_META` / `BOARD_ORDER` tables.

### 8.4 `/sensors` (785 lines)

Fire detection and door hardware, grouped by building.

**Suspense split.** `SensorsPage` is a two-line component that renders
`<React.Suspense fallback={null}><SensorsView /></React.Suspense>`. This is not
decoration: `useSearchParams()` opts its subtree into client rendering, and
without its own boundary the route fails to prerender. **Any page that adds
`useSearchParams()` must do the same.**

**Role gate:** none for reading. Every action is gated twice — `canActOnSensor(role)`
(`mayAct`) **and** `action.allowedRoles.includes(role)` from the type registry.
Office Staff see every control padlocked with `SENSOR_LOCK_REASON`. The **+ New
sensor** button is the one control hidden rather than padlocked (`canAct(role)`).

**Persisted:** `sensors.show` (`"all" | "alarms" | "offline"`). Per-building
collapse is plain component state.

**Deep link:** `?device=<sensorId>` opens that sensor's drawer on mount — this is
how the equipment drawer's `SameDevicePanel` hands over. Closing the drawer
`router.replace("/sensors")` to drop the parameter.

**Toolbar:** a Show filter (All devices / Alarms only / Offline), an alarm
counter (danger-toned when non-zero), an offline counter, a devices-in-scope
counter, "Polled every 30s · <clock>" from `useLiveClock()`, and + New sensor.

**Body:** one collapsible card per building (only the user's building for Office
Staff), headed by name, `BUILDING_META` code, an "<n> in alarm" pulsing badge
and a device count. Inside, a two-column grid — **one column per
`SENSOR_TYPES` entry** — so fire detection and door hardware sit side by side
and collapse to one column under `lg`.

Each device row shows a `PulseDot` (pulsing only in alarm), the device id, its
room and `formatRelative(updatedAt)`, and a status `ToneBadge`.
**Alarm rows break the rhythm**: `bg-danger-muted/50` and a 3px danger left
border. Rows in alarm **or** offline expose their type's actions inline,
filtered to those whose `resultStatus` differs from the current status, each
padlocked if disallowed, followed by either "Offline devices raise no alarms."
or "Recorded in the Log Book."

**`runAction(sensor, action)`** is shared by the rows and the drawer: it builds
a confirm from the `SensorAction` itself — title `"<label> <id>?"`, body naming
the resulting status, `requireReason` and a danger tone when
`action.requiresNote` (the fire-alarm reset), then `setSensorStatus()` and one
toast. **Nothing about fire alarms or door locks is hardcoded here**; the page
renders whatever the registry declares.

**`SensorDrawer`** — a **narrow (392px)** `DetailDrawer`.

- Header: device id, status badge, type label and location.
- `DetailMetaGrid`: Type · Status · Last report · **Vocabulary** (the type's
  whole `statuses[]` list, joined) — a direct window onto the registry.
- `SameDevicePanel` back to the equipment record when `equipmentForSensor()`
  finds one.
- Actions grid rendered from `type.actions`, icons looked up in `ACTION_ICON`,
  each padlocked when not allowed. The caption underneath changes when the
  device is offline.
- A footer row with **Edit details** (switches the drawer into an inline
  `DrawerInlineForm` rather than stacking a second drawer) and **Remove**
  (toasts "demo-only" — deliberately not wired).

**`useSensorFields(seed, active)`** — the shared registration field state (name,
type, building, room, status, linked equipment tag, error), reseeded whenever
the form opens. Used by both the inline edit and `NewSensorDrawer`, so the two
forms cannot drift apart. `SensorFields` renders them; `FIELD_INPUT` /
`FIELD_SELECT` are the shared class strings.

**Lookup tables:** `STATUS_TONE`, `STATUS_LABEL`, `ACTION_ICON`, `TYPE_ICON`.
Adding a sensor type means adding a tone and an icon here — not changing the
page's logic.

### 8.5 `/requests` (749 lines)

**Role gate:** none for reading. `canAdvanceRequest(role)` (`mayAdvance`) gates
every move; Office Staff see the advance button padlocked with "Office Staff
submit and watch requests; Admin Managers action them." **Anyone may raise a
request** — that is the Office Staff path into the system.

**Persisted:** `requests.view` (`"board" | "table"`), `requests.sort`
(`"time" | "priority"`), `requests.doneCollapsed`. Search and building filter
are not persisted.

**Data:** reads `scopedRequests` from `useAppState()` — never `MAINTENANCE_REQUESTS`
directly — then applies the local building filter and a search over id, issue,
room label and submitter name, and sorts by submitted time (or high priority
first, then time).

**Toolbar:** search with a clear "×", building `<select>` (disabled for Office
Staff), sort `<select>`, three counters — total in scope, `!<high>`, and an
aging counter titled with `ESCALATION_WINDOW_HOURS` that turns danger-toned when
non-zero — then the Board/Table toggle and **New request**.

**`move(request, direction)`** — the one mover:

- Forward: `moveRequest(id, "next")` plus one toast.
- Backward: **always asks first.** The confirm's note reads "Its age stays at
  <n>h — stepping back does not restart the clock", because work gets marked
  done too early and stepping back should be visible rather than quiet.
- Both directions walk exactly one step via `REQUEST_NEXT_STATUS` /
  `REQUEST_PREV_STATUS`, and stop at the ends.

**Board view** — four columns from `COLUMNS` (Pending / In progress / Resolved /
Completed), each with a coloured top border and a count badge. **Completed
collapses sideways to a 46px rail** with vertical text rather than disappearing,
so the board keeps its width for active work; the grid template switches to
`repeat(3, minmax(0,1fr)) 46px`. Cards are `RequestCard`.

**Table view** — Id · Building · Location · Equipment · Issue · Priority ·
Status · Age · Submitted by · Action. Escalated rows get a 3px danger left
border and a clock icon beside the age. The Action cell is `MoveButtons`.

**`MoveButtons`** — an `Undo2` icon button back (only when a previous status
exists *and* the role may act) and a labelled forward button whose text comes
from `REQUEST_NEXT_ACTION[status]`, padlocked when `!mayAdvance`.

**`RequestCard`** — the board card: id, issue, room/equipment/age meta with
icons, priority and status badges, and the same move controls.

**`NewRequestDrawer`** — a `FormDrawer`. Building → Room → Equipment cascade
(the equipment list is `EQUIPMENT_UNITS` filtered to the chosen room, so a
request is always raised **against a specific unit** and the register and the
request stay in step), a free-text issue (must be at least 8 characters — "Describe
the fault in a sentence so it can be triaged"), and a priority select whose hint
explains the aging rule. On submit it builds a `MaintenanceRequest` with a fresh
`REQ-` id, `status: "pending"`, the current user as submitter and `now` for both
timestamps, hands it to `addRequest()` and toasts.

**Local helper:** `equipmentLabel(equipmentId)` resolves an equipment **tag**
back to a readable unit label.

### 8.6 `/records` — Historical Records (363 lines)

The long-range ledger, **available to every role** (Office Staff scoped to their
building).

**Persisted:** `records.range` (7 / 30 / 90 days). Building filter, type filter,
search and the pagination `limit` are all component state.

**Filtering:** `HISTORICAL_RECORDS` cut by timestamp against
`Date.now() - range * 86400000`, then by building, then by type, then by a
search over text, actor, `refId` and room label.

**Four KPI cards:** total records in range, alarms, requests, and average per
day (one decimal).

**Records-per-day chart:** a stacked bar per day for `min(range, 14)` days,
segmented by `TYPE_ORDER` with a legend. Heights are percentages of the busiest
day.

> **A Tailwind v4 gotcha worth knowing, documented in the source:** `@theme
> inline` does not emit every `--color-*` as a usable custom property, so
> `var(--color-danger)` inside an inline `style` resolved to nothing and the
> bars rendered transparent. The fix is the `TONE_BG` map from tone → a real
> utility class (`bg-danger`). `TONE_BORDER_L` does the same for the row
> borders. **Do not put a theme colour in an inline style.**

**The ledger:** header row TIME · TYPE · SOURCE · RECORD · BY, then records
**grouped by day** with a sticky-looking day header ("Mon, 15 Sep · 12 records").
Each row carries a 3px type-coloured left border, a `ToneBadge` for the type,
the building/room (or "Estate-wide" when `buildingId` is absent), the text and
the actor. `Load 40 more` extends `limit` by 40.

**Export CSV** toasts "Exported <n> records to CSV (demo only)" — it is a stub,
not a real export.

### 8.7 `/logbook` — Log Book (416 lines)

The live, system-written feed. **Admin Manager and CEO only.**

**Role gate:** `if (!canAccessLogBook(role))` returns `<AccessDenied>` naming the
role and offering "Switch to Admin Manager for this demo" → `setRole()`. This is
the reference implementation of a role-locked page.

**Persisted:** `logbook.source` (the source filter). Pause, search and building
filter are component state.

**Layout:** `xl:grid-cols-[1fr_296px]` — feed plus a right rail.

**Feed column:**
- A status card: LIVE / PAUSED badge with a pulsing dot, a description, the live
  clock, and a Pause/Resume button.
- A filter card: search (title, detail, actor, refId), a **shadcn `Select`** for
  the building (disabled for Office Staff — though they cannot reach the page),
  an "<n> shown" badge and an "<n> alerts" badge when alerts are in view.
- Entries **grouped by day *and shift***: the group key is
  `` `${dayLabel(ts)} — ${shiftLabel(hour)}` ``, where `dayLabel` gives
  "Today"/"Yesterday"/weekday and `shiftLabel` gives Day (06–14), Evening
  (14–22) or Night (22–06). Each entry shows time, a source-toned dot (pulsing
  only for `alert`), title, a source badge from `LOG_BOOK_SOURCE_META`, a linked
  `refId` chip, the detail line and the actor.

**Right rail:**
- **Today** — entry and alert counts. Note the deliberate workaround: the seed
  data is fixed, so "today" is the **most recent day the data holds**
  (`latestDay`), not the wall-clock date; otherwise the panel would read 0 of 0
  the day after the data was written.
- **Sources** — "All sources" plus one row per `SOURCE_ORDER` entry with counts,
  acting as the source filter.
- **What writes here** — the top five actors by entry count, built by reducing
  `LOG_BOOK` into a name → `{role, count, sources}` map. People are described by
  their role label; automated writers by the kinds of entry they produce, since
  the point of the panel is that nothing here is written by hand. It closes by
  pointing at Historical Records for the same events beyond today.

**Local helpers:** `shiftLabel(hour)`, `dayLabel(iso)`, `SOURCE_TONE`,
`SOURCE_ORDER`.

### 8.8 `/reports` (664 lines)

**Role gate:** `canAccessReports(role)` — Office Staff get `<AccessDenied>` with
the same switch-role escape hatch as the Log Book.

**Nothing is persisted here**; search, building filter and kind filter are all
component state, and generated reports live in a local `extra` array.

**Two modes in one route.** When `openReportId` is set the page returns
`<ReportDetailView>` *instead of* the library — there is no separate route and
no drawer, because a full report needs the whole page.

**Library view**

- Toolbar: search (id, kind label, period, building), building `<select>`, kind
  `<select>`, an "<n> reports" badge, **+ Generate report**.
- Reports are **grouped by kind** (`maintenance-performance`,
  `equipment-reliability`, `cost-of-maintenance`), each group headed by a rule
  and a count, cards in a 1/2/3-column responsive grid.
- Each card: kind title, scope + period, a status badge (`READY` / `SCHEDULED` /
  `ARCHIVED`), "Generated <date> · <who>", and **Open / PDF / CSV** buttons, all
  three disabled unless `status === "ready"`. PDF and CSV toast "demo only".
- A 3px left border coloured by `KIND_TONE` distinguishes the three kinds.

**`GenerateReportSheet`** — a shadcn `Sheet` (not `FormDrawer`) with three
`Field`s: report kind, period (September 2026 / an ad-hoc range / Q3 2026) and
scope (whole estate or one building). On Generate it builds a `Report` with a
fresh `RPT-` id, `status: "ready"`, `generatedBy: currentUser.name`, prepends it
to `extra` and toasts with the description "Visible in this session only."

**`ReportDetailView`** — expands the row with `reportDetail(report)`, memoised.

1. **Header bar:** a back-to-Library button, the kind title wrapped in a
   `Tooltip` whose content is `KIND_BLURB[kind]` — a paragraph saying what the
   report actually measures, since the title alone does not (moved into a
   tooltip by commit `173000c`) — the scope/period/generated-by/status line, and
   PDF / CSV buttons.
2. **KPI cards:** one per `detail.kpis`, top-bordered success or warning by
   `kpiPasses(k)`, showing value + unit, an `ON TARGET` / `WATCH` badge and the
   `targetLabel`.
3. **Requests by week:** stacked bars of resolved (success) over carried-over
   (warning), with the total above each bar.
4. **Faults by equipment type:** horizontal bars, each row a different colour
   from `FAULT_BARS` (`bg-chart-1`…`bg-chart-5`) so five rows read apart at a
   glance rather than being one flat blue.
5. **Worst offenders table:** TAG · UNIT · FAULTS · DOWNTIME · COST, costs via
   `formatMmk`.
6. **Cost of maintenance:** the `ReportCostLine` list with the `isTotal` row
   ruled off and bolded, then an against-budget bar — `budgetPct` of
   `budgetMmk`, coloured danger when `spentMmk > budgetMmk`.
7. **Notes:** the free-text summary, capped at `78ch` for readability.

The same `TONE_BORDER_L` workaround as `/records` applies here, with the reason
restated in the source: Tailwind only emits the colour tokens it sees in a
class, so these are real utility classes rather than `var(--color-*)` read from
an inline style.

### 8.9 `/admin` — Administration (1,098 lines)

**One page, two tabs, two different gates.**

- Page gate: `canManageAccounts(role)` (rank ≤ 2). Office Staff get
  `<AccessDenied>` offering "Switch to CEO for this demo".
- Buildings tab: `canManageEstate(role)` (CEO only). For an Admin Manager the
  tab button renders with a **`Lock` icon instead of `Building2`**, disabled,
  with `ESTATE_LOCK_REASON` in its tooltip.

**Persisted:** `admin.tab`. Note the guard — a stored preference must not put an
Admin Manager on a tab they cannot open, so an effect forces `tab = "users"`
whenever `!mayEstate`.

**Local mutable copies.** Unlike other pages, Administration holds its own
`useState` copies of `buildings`, `rooms` and `users` seeded from `BUILDINGS` /
`ROOMS` / `MANAGED_USERS`. Estate edits are therefore visible on this page only
and are lost on navigation — a known limitation of the mock layer, not a design
choice.

The toolbar shows the tab pair, a note that changes with the role ("Buildings
and rooms shape everything the other pages count." / "Admin Managers manage
accounts; the estate itself is the CEO's."), and a count chip
(`3 SITES · 19 ROOMS` or `8 ACCOUNTS`).

#### Buildings tab (`BuildingsTab`)

Layout `grid-cols-[308px_minmax(0,1fr)]`, collapsing to one column under `lg`.

- **Left:** one selectable card per building — name, `BUILDING_META` code, and
  rooms / devices / staff counts — plus a dashed **+ Add building** button.
- **Right, detail panel:**
  - A photo placeholder showing `meta.photoHint`, the building name, code,
    address and description from `BUILDING_META`, with **Edit** and **Delete**.
  - A stat row: ROOMS · DEVICES · FAULTY · **OPEN REQ** (from
    `countOpenRequests(requests, id)`, the shared helper again) · STAFF.
  - A **room table** — Room · Type · Floor · Devices · Actions — wrapped in
    `overflow-x-auto` with `min-w-140`, so below a tablet it keeps its column
    widths and scrolls **inside the card** rather than pushing the page sideways.
    This is the canonical example of the wide-table rule.
  - An inline add-room row (name, type, floor, Add room) beneath the table.

- **Confirms, each stating the cost in its own numbers:**
  - *Remove room* — "Its 6 devices stop reporting and drop out of every count on
    the estate", or "It holds no devices, so no counts change" when empty.
  - *Delete building* — danger, **`requireReason`**, note counts the rooms,
    devices and accounts that lose their building scope.

- **Drawers:** `NewBuildingDrawer`, `EditBuildingDrawer`, `EditRoomDrawer` — all
  `FormDrawer`s.

#### User Accounts tab (`UsersTab`)

- Toolbar: search (name, email, building), role filter, an "<n> OF <m>" chip,
  **+ New account**.
- Table (`min-w-260`, horizontally scrolling inside its card): Name with an
  initials avatar · Email · Role badge (`ROLE_TONE`) · Assigned building ("All
  buildings" when unscoped) · Status · Last active (`formatRelative`) · Actions.
  Suspended rows get a `bg-surface-subtle` wash.
- Per-row **Edit** and **Suspend/Restore**, both driven by
  `canEditUser(actorRole, u.role, u.isSelf)`. When locked they render with a
  padlock and one of two reasons: `userEditLockReason(...)` for a row out of
  range, or "Every estate needs at least one Super Admin — this account cannot
  edit itself." for the `isSelf` row.
- `toggleStatus` confirms first: suspending warns that the person is signed out
  and cannot sign back in, with the note "Their history stays in the Log Book
  and Historical Records — nothing they recorded is removed."
- **`UserDrawer`** is used twice — once for create, once for edit — with
  `editing` distinguishing them. Two rules are encoded in it:
  - `assignableRoles` is `["office-staff", "admin-manager"]` for the CEO and
    `["office-staff"]` for an Admin Manager. **A role cannot be granted above
    the granter.**
  - Building scope is only meaningful for Office Staff, so for any other role
    the field renders as `FormFieldLocked` reading "All buildings" with a
    padlock — visible, not hidden.
  - Validation: a name, and an email containing `@`.

**Local helpers:** `initials(name)`, `TabButton`, `Stat`, `RowButton`,
`TextInput`, `SelectInput`, and the `ROOM_TYPE_LABEL` / `ROOM_TYPES` / `FLOORS`
/ `ROLE_TONE` tables.

### 8.10 `/settings` (442 lines)

**Role gate:** none — everyone has an account. Reached from the account menu and
`/more`, **not the sidebar**.

**Persisted:** `settings.section` (`"profile" | "appearance" | "security"`).

**Layout:** `grid-cols-[216px_minmax(0,1fr)]` — a section list on the left that
becomes a horizontally scrolling chip row under `lg`.

**`ProfileSection`** — avatar with initials, name, email, a demo-only "Change
photo" button, then Full name and Phone as editable inputs and **Role** and
**Building scope** as padlocked read-only boxes ("set by an administrator").
Save toasts; nothing persists.

**`AppearanceSection`** — the real theme picker. Uses `useTheme()` from
next-themes: `theme` may be `"system"`, and `resolvedTheme` is what the page is
actually painting, so the preview reads from `resolvedTheme` while the selection
reads from `theme`. A `mounted` flag guards against the server/client mismatch
before hydration. Three `THEMES` cards (Light / Dark / System), each a miniature
painted with literal hex swatches (the one legitimate place hexes appear —
they are preview chips, not applied styling), and a caption "Currently painting
<light|dark>."

**`SecuritySection`** — current / new / confirm password fields with local
validation (at least 10 characters, and the two must match), a Change password
button that clears the fields and toasts, and a link to
`/login/forgot-password`.

**Local helpers:** `SectionCard`, `FieldLabel`, `initials`, `SECTIONS`,
`THEMES`.

### 8.11 `/more` (108 lines)

The phone's overflow navigation.

- An identity card: avatar, name, email, role badge.
- A **Pages** list of `MORE_ITEMS` the role can reach (`rank <= minRank`), each
  with its `detail` line, an open-requests badge where applicable, and a chevron.
- Beneath it, a padlocked footer **naming the pages the role cannot reach**
  rather than hiding them — "Log Book, Reports, Administration are limited to
  Admin Managers and the CEO. Your role is Office Staff." Same principle as the
  padlocked controls: the gap gets explained.
- A Sign out button routing to `/login`.

---

## 9. Styling and design tokens

Everything lives in `src/app/globals.css` (247 lines), surfaced as Tailwind
utilities through `@theme inline`. **Never hardcode a hex** in application code.

### Palette (light)

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#f4f5f7` | the ground |
| `--card` / `--popover` | `#ffffff` | raised surfaces |
| `--foreground` | `#111318` | body ink |
| `--muted-foreground` | `#6b7280` | secondary text |
| `--border` | `#d8dbe1` | card and control borders |
| `--input` | `#c9cdd6` | field borders |
| `--divider` / `--rule` | section and row rules |
| `--primary` | `#4169e1` | the one brand blue |
| `--accent` / `--accent-foreground` | `#eef2fd` / `#2f4fb8` | the blue as a light fill and as on-white text |
| `--surface`, `--surface-subtle`, `--surface-hover` | | table headers, hover rows |

### Status tones

Five tones, each with a mid value, a `-foreground` (dark text) and a `-muted`
(light fill):

| Tone | mid | foreground | muted |
| --- | --- | --- | --- |
| success | `#16a34a` | `#15803d` | `#e9f6ec` |
| warning | `#d97706` | `#b45309` | `#fbf1e2` |
| danger | `#dc2626` | `#b91c1c` | `#fdeceb` |
| info | `#4169e1` | `#2f4fb8` | `#eef2fd` |
| neutral | — | `#4a5160` | `#eef0f3` |

> **Use `bg-*-muted` with `text-*-foreground` together. Never put the mid tone's
> text on the light fill** — it fails contrast. `ToneBadge` already pairs them
> correctly; follow it.

### Layout metrics — tokens, not literals

```
--sidebar-w      196px
--header-h        54px
--page-pad        20px
--drawer-form-w  392px   create/edit
--drawer-detail-w 412px  a record with history and actions
--modal-w        452px   decisions only
--menu-notif-w   392px
--menu-acct-w    236px
--radius        0.5rem   (radius-sm/md/lg/xl derive from it)
```

Body copy 12–12.5px · small-caps mono labels 9.5–10px at `.06em` tracking ·
corner radius 4–5px.

### Type

- `--font-plex-sans` (IBM Plex Sans, **variable**) for body — the design uses
  `font-[450]`, which only resolves because the variable font is loaded.
- `--font-plex-mono` (IBM Plex Mono, 400/500/600) for ids, counts, timestamps
  and small uppercase labels.

### Animations

`--animate-sb-pulse` (`sb-pulse 1.4s infinite`, the live dot) and
`--animate-sb-slide` (`sb-slide 0.16s ease-out`, popover entry), used as
`animate-sb-pulse` / `animate-sb-slide`.

### Dark mode

A `.dark` block redefines the palette, and **`ThemeProvider` is mounted**
(`attribute="class"`), so the app genuinely supports light, dark and system,
switchable from `/settings` → Appearance. *(If you find an older note saying the
app is light-only with no provider mounted, it predates commits `58a62ac` and
`45cda8e` and is wrong.)*

### The inline-style trap

Tailwind v4's `@theme inline` does not emit every `--color-*` as a usable custom
property, so `style={{ background: "var(--color-danger)" }}` resolves to nothing
and the element renders transparent. Both `/records` and `/reports` carry a
`TONE_BG` / `TONE_BORDER_L` map from tone → a real utility class for this
reason. **Put theme colours in classes; keep inline styles for computed
geometry** (bar heights, grid templates).

---

## 10. Conventions checklist

- `"use client"` at the top of every page; sub-components colocated in the same
  file rather than split into a directory.
- Business logic lives in `lib/`. Pages read from `useAppState()`;
  they do not re-derive rules. **Never re-implement a `derive.ts` helper inline.**
- Gate on **rank** (`roleRank(role) <= n`), never on role equality.
- A control a role may not use is **padlocked with a tooltip, never hidden**.
- Containers are fixed: fields → form drawer, record+history → detail drawer,
  decision → confirm modal, result → one toast (bottom-left, six seconds, no
  undo).
- Page toolbars must `flex-wrap`. Wide tables scroll inside their card
  (`overflow-x-auto` + a `min-w-*`) and never push the page sideways — see the
  Administration room table and the user table.
- `useSearchParams()` needs its own `<Suspense>` boundary or the route fails to
  prerender — see `/sensors`.
- Never call `formatClock()` during render; use `useLiveClock()`.
- `usePersistedState` stores *how a page is shown*, never *what is being looked
  at*.
- Tailwind arbitrary values carry the design's exact sizes (`text-[12.5px]`,
  `size-3.5`, `w-37.5`) — that is intentional, not sloppiness.
- shadcn here is on **Base UI**: compose with `render`, never `asChild`.
- Verify a build by its **exit code**. "✓ Compiled successfully" prints before
  the prerender step that can still fail.
- Run `npm run lint` (Biome) before finishing.

---

## 11. Status, gaps and the Firebase path

### 11.1 What is in Firestore

Eleven collections, each with a store module in `src/lib/` and a live
`onSnapshot` resolved by `AppStateProvider`:

| Collection | Store module | Document id |
| --- | --- | --- |
| `users` | `users-store.ts` | Firebase uid |
| `logBook` | `logbook-store.ts` | auto |
| `buildings` / `rooms` | `estate-store.ts` | `b216`, `r-216-302` |
| `sensorTypes` | `sensor-types-store.ts` | `fire-alarm` |
| `sensors` | `sensors-store.ts` | `FD-216-14` |
| `equipmentUnits` / `equipmentHistory` | `equipment-store.ts` | `EQ-216-01` / auto |
| `requests` | `requests-store.ts` | `REQ-4192` |

The human id **is** the document id everywhere it exists, because
`request.equipmentId`, `sensor.linkedEquipmentId`, `room.buildingId` and every
log entry's `refId` already hold those strings; auto-ids would have forced a
second lookup at every cross-reference. `logBook` and `equipmentHistory` are
append-only and take auto-ids, and both are queried with a `limit(200)`.

`src/lib/firestore-store.ts` holds the mechanical half — `useLiveCollection`,
`readError`, `writeError`, `COLLECTIONS` — so each store module carries only
what is about its domain. `src/lib/store-mappers.ts` holds the document →
domain mappers, extracted because the store modules import `@/lib/firebase`,
which throws without a configured project and would make them untestable.

Every query is single-collection and single-field-ordered, so
`firestore.indexes.json` stays empty and nothing here needs an index deploy.

**Still generated, deliberately:** `powerSeries()`, `BUILDING_META`,
`EQUIPMENT_TYPES`. Persisting invented data buys nothing.

**Reports are no longer among them.** `src/lib/reporting.ts` computes all three
kinds from live `requests`, `equipmentUnits` and `equipmentHistory`, and a
generated report is written to the `reports` collection with its figures
snapshotted — a report is a record of what was true for its period, so
reopening it later must show the same numbers. `Report` carries
`periodStart` / `periodEnd`; the old `period` label alone could not be
recomputed or audited. Expect thin figures until the app has been used: cost
coverage reports the share of resolved requests actually carrying a figure,
which is the honest headline while that share is low.

**Historical Records is no longer among them.** It reads `logBook` through
`useLogHistory()` — its own 90-day subscription, because the shared feed's
`limit(200)` cannot cover a long-range ledger — filtered to every source except
`admin`. That exclusion is load-bearing: Office Staff reach `/records`
(`minRank: 3`) and not `/logbook` (`minRank: 2`), so account and estate changes
must not surface there.

**Notifications stay in memory** — session-scoped UI state, not domain data.

Three seams in `mock-data.ts` make the module-level helpers keep working:
`setEstateSource`, `setSensorRegistrySource` and `setAssetSource` are fed from
the subscriptions in the provider's render body, so `roomLabel`,
`buildingName`, `roomsForBuilding`, `sensorType`, `statusDef`,
`equipmentForSensor`, `sensorForEquipment` and `buildingStats` all resolve
against live data without any caller knowing.

### 11.2 Known gaps

- **The security rules are at the wide-open default and are not deployed.**
  Everything above is world-readable and world-writable by anyone holding the
  API key, which is public and in the bundle. This is a deliberate decision
  for the coursework, not an oversight, but it is the single largest gap: the
  route guard in `shell/auth-gate.tsx` is UX, and `permissions.ts` only
  decides what a padlock looks like. `firestore.rules` is the enforcement
  layer, and it is not enforcing.
- **Deleting an account is not possible from the app.** The client SDK cannot
  remove another user's Auth record; the product suspends instead. A failed
  provisioning leaves an Auth record with no profile, which signs out with an
  explanation but needs the console to clear.
- **Photos are documents, not files.** There is no Storage bucket, so a unit
  photo is a 640px JPEG data URL at `equipmentUnits/{id}/media/photo`, fetched
  when the drawer opens and refused over 700 KB. At 28 units this is fine; at a
  few hundred it wants its own collection or a real bucket.
- **Test coverage is narrow.** `npm test` runs Vitest over the pure modules,
  the mappers and the export shaping. Nothing covers the components, and
  nothing covers Firestore itself — that needs the emulator, and mocking the
  SDK would test the mock.
- **`README.md` is still `create-next-app` boilerplate.**
- **Reports are still generated.** `reportDetail()` computes every KPI, weekly
  figure and cost line from `seededRandom(reportId)`. Two of the three kinds —
  maintenance-performance and equipment-reliability — are now derivable from
  live `requests` and `equipmentHistory`, and `costMmk` on a resolved request
  makes the third possible. Not yet wired.
- **Room numbers for Building 209 and Junction Square are provisional** — a
  comment in `src/lib/types.ts` records that only 216's are confirmed.
- **`legacyUid` is still load-bearing.** Seeded requests carry
  `submittedBy: "u-hnin"`, and a Firebase uid never matches one, so
  `isActor()` matches either. It goes when the seed corpus does.

### 11.3 What changed when the data became writable

Worth knowing, because several of these are not visible in a diff:

- **Signing out no longer discards anything.** It used to unmount
  `AppStateProvider` and take the session's overrides with it. The overrides
  are gone; a write by one person is there for the next. Both this document
  and `CLAUDE.md` used to present that unmount as the mechanism keeping one
  person's work out of another's session, and it is no longer true.
- **Nine controls started writing.** Add to register, Save details, Delete,
  Save service, Move unit, the unit photo, Register sensor, the sensor inline
  Save changes and the Settings profile save had only ever logged and toasted.
  The Appearance Save button was deleted instead: the swatch already applies
  the theme, so it could only ever have confirmed something already done.
- **Two joins were ambiguous and are not any more.** `EquipmentUnit.tag` is an
  ordinary editable field; the document id is the join key. A sensor's id is
  frozen, and the field is padlocked with the reason, because the unit it
  shares a body with points at it by name.
- **`declineNote` needs `deleteField()`, not `undefined`.** Firestore runs with
  `ignoreUndefinedProperties`, so `undefined` skips a field rather than
  clearing it. `requests-store.ts` exports `CLEAR` for this.
- **The request id generator mints against every id**, withdrawn ones included.
  It used to mint against the scoped list, so an Office Staff member could have
  overwritten another building's request.
- **`equipmentHistory.at` is an ISO string, not a Timestamp**, unlike the Log
  Book: Firestore orders by type before value, so a collection holding both
  would sort into two separate blocks.

### 11.4 Seeding

`scripts/seed-firestore.ts`, run with `npx vite-node`. It imports
`src/lib/mock-data.ts` directly — TypeScript, behind the `@/` alias — rather
than duplicating the corpus into a `.mjs` sibling, which would guarantee drift.

Seeded documents keep their corpus ids and are written with merge, so a re-run
refreshes them. Rows created in the app have generated ids and are never
touched — which does mean an edit made in the app **to a seeded row** is
overwritten on the next run. The script prints that asymmetry every time.

`--dry-run` says what it would write; `--reset` clears each collection first.
