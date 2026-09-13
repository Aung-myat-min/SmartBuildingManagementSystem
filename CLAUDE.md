# Smart Building Monitoring — codebase map

Facilities-operations dashboard for a 3-building estate (CET333). Frontend only;
all data is in-memory mock data. Firebase is planned as the backend later.

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
      layout.tsx          app shell: sidebar + 54px header + demo banner
      <route>/page.tsx    one file per page, sub-components colocated
  components/
    shell/                sidebar, header widgets (account, notifications, role switcher, demo banner)
    shared/               cross-page primitives (tone-badge, pulse-dot, access-denied, empty-state, confirm-dialog)
    ui/                   shadcn primitives
    providers.tsx         AppStateProvider + ConfirmProvider
  lib/                    types, mock data, app state, permissions, formatting, nav
```

## Data layer

**`lib/types.ts`** — the domain model. Read this first; every page is built on it.

| Group | Types |
| --- | --- |
| Users | `UserRole` (office-staff / admin-manager / ceo-super-admin), `AppUser`, `ManagedUser` |
| Estate | `Building`, `Room`, `RoomType` |
| Equipment | `EquipmentTypeDef`, `Equipment` (room-level count breakdown), `EquipmentUnit` (one taggable asset), `EquipmentCondition`, `EquipmentHistoryEvent` |
| Sensors | `SensorTypeDef` (carries its own `statuses[]` + `actions[]`), `SensorAction`, `EnvironmentalSensor` |
| Requests | `MaintenanceRequest`, `RequestStatus`, `RequestPriority` |
| Ledgers | `HistoricalRecord` (long-range, all roles), `LogBookEntry` (short-range, admin+CEO) |
| Reports | `Report`, `ReportDetail`, `ReportKpi`, `ReportWeek`, `ReportOffender`, `ReportCostLine` |

Two invariants the code relies on:
- `Equipment`: `running + faulty + underMaintenance === quantity`.
- A fire detector is **two records** — an `EquipmentUnit` (the asset) and an
  `EnvironmentalSensor` (the live state) — joined by `linkedEquipmentId`, never merged.
- Equipment and sensor *types* are data-driven registries, not hardcoded unions.

**`lib/mock-data.ts`** (~1750 lines) — seed data + derivations.
3 buildings · 19 rooms · 10 equipment types · 19 units · 2 sensor types · 17 sensors ·
14 requests · 8 users · 18 log entries · 13 reports.
Helpers: `buildingStats()`, `roomsForBuilding()`, `roomLabel()`, `buildingName()`,
`equipmentUnitLabel()`, `powerSeries()`, `reportDetail()`.
Lookups: `BUILDING_META`, `BUILDING_LOAD_KW`, `LOG_BOOK_SOURCE_META`,
`REQUEST_NEXT_STATUS`, `REQUEST_NEXT_ACTION`, `CURRENT_USERS`, `LIVE_ALARM_SENSOR_ID`.

**`lib/app-state.tsx`** — `useAppState()`, the single client-side store.
Holds the signed-in role, active building, a 1s `elapsed` tick, notifications, and
in-memory override maps so an action on one page shows up on every other page:
`requestStatus/advanceRequest`, `sensorStatus/setSensorStatus`,
`equipmentCondition/setEquipmentCondition`. `resetDemo()` clears all of it.

**`lib/permissions.ts`** — `roleRank()` (ceo=1, admin=2, staff=3), `roleLabel`, and
`can*` predicates. Gate on **rank**, never on role equality.

**`lib/format.ts`** — `ageHours`, `formatAge`, `isAging`, `formatClock`, `formatTime`,
`formatDayLabel`, `formatDate`, `formatMmk`, `formatRelative`.

**`lib/nav.ts`** — `NAV_ITEMS`, each with `minRank` and an optional badge key.

## Base styles

`app/globals.css` holds the whole token sheet. Everything is a CSS variable surfaced
as a Tailwind utility — **never hardcode a hex**.

- Ground `#e9ebef` · card `#fff` · border `#d8dbe1` · muted text `#6b7280`
- Primary `#4169e1`, `#2f4fb8` as on-white text
- Status tones as fill/text pairs: `success` `warning` `danger` `info` `neutral`,
  each with `-muted` (light fill) and `-foreground` (dark text). Use
  `bg-*-muted text-*-foreground` together; never the mid tone on the light fill.
- Surfaces: `surface`, `surface-subtle`, `surface-hover`
- Fonts: `--font-plex-sans` (body) / `--font-plex-mono` (ids, counts, timestamps,
  small uppercase labels). `font-tabular` utility for figure columns.
- Animations: `animate-sb-pulse` (live dot), `animate-sb-slide` (popover entry).
- A `.dark` block exists but no theme provider is mounted — the app is light-only.

Metrics: sidebar 196px · header 54px · page padding 20px · card gap 14–16px ·
radius 4–5px · body 12–12.5px · small caps labels 9.5–10px at `.06em`.

## Shared components

| Component | Use |
| --- | --- |
| `shared/tone-badge.tsx` | `<ToneBadge tone>` — every status, priority, condition, record type. `toneDotClass()` for raw dots. |
| `shared/pulse-dot.tsx` | Live dot; only where something is genuinely happening now. |
| `shared/confirm-dialog.tsx` | `useConfirm()` → promise. Decisions only, plus the one optional `requireReason` textarea. |
| `shared/access-denied.tsx` | Role-locked page: states the role, offers a switch. |
| `shared/empty-state.tsx` | Empty list/filter result. |

Container rules, applied consistently: right drawer (`ui/sheet.tsx` side="right") for
anything with fields; detail drawer (sheet + scroll-area) for a record with history and
actions; centred modal for decisions only; toast for every result.

## Pages

| Route | Purpose | Shape |
| --- | --- | --- |
| `/login` | Sign in + demo account picker | card; `/login/forgot-password`, `/login/first-sign-in`, `/login/session-expired` |
| `/dashboard` | Estate overview | KPI tiles, power series, estate table, requests needing a decision, live alerts, log feed |
| `/equipment` | Asset register | Register/Board toggle, filters, detail drawer with history + 6 actions |
| `/sensors` | Fire detection + door hardware | grouped by building, alarm rows break the rhythm |
| `/requests` | Maintenance requests | Kanban/Table toggle, new-request sheet, status advance |
| `/records` | Historical Records | range/building/type filters, daily grouping, CSV export |
| `/logbook` | Log Book | live feed, source filters, pause |
| `/reports` | Reports | library + full report view, generate sheet, PDF/CSV |
| `/buildings` | Buildings | one card per site (**being merged into Administration**) |
| `/admin` | Administration | Buildings / User Accounts tabs, sheets for each entity |
| `/settings` | Settings | left rail + sections |

## Conventions

- `"use client"` on every page; sub-components colocated in the same file.
- Tailwind arbitrary values carry the design's exact sizes (`text-[12.5px]`, `size-3.5`).
- Business logic stays in `lib/`; pages read from `useAppState()` and mock data.
- Biome formats and lints; run `npm run lint` before finishing.

## Demo scaffolding — not for production

The role switcher (`shell/role-switcher.tsx`), the demo banner, and the 20-second
alarm timer in `app-state.tsx` exist so a reviewer can reach every state without a
backend. They ship behind the demo banner and come out when Firebase lands.
