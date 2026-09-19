// ============================================================================
// Seed data — mirrors the estate described in the design pass: Building 216,
// Building 209, Junction Square. Everything here is static, including the one
// device in alarm; app-state.tsx layers this session's changes on top as
// overrides, and no longer scripts anything.
// ============================================================================

import {
  countEscalated,
  countOpenRequests,
  ESCALATION_WINDOW_HOURS,
} from "./derive";
import type {
  Building,
  EnvironmentalSensor,
  EquipmentHistoryEvent,
  EquipmentTypeDef,
  EquipmentUnit,
  HistoricalRecord,
  LogBookEntry,
  MaintenanceRequest,
  Report,
  ReportDetail,
  Room,
  SensorStatusDef,
  SensorTypeDef,
} from "./types";

export const BUILDINGS: Building[] = [
  { id: "b216", name: "Building 216", code: "SITE 216" },
  { id: "b209", name: "Building 209", code: "SITE 209" },
  { id: "jsq", name: "Junction Square", code: "SITE JSQ" },
];

export const BUILDING_META: Record<
  string,
  { code: string; address: string; description: string; photoHint: string }
> = {
  b216: {
    code: "SITE 216",
    address: "216 University Avenue",
    description:
      "The main teaching block — lecture theatres, two teaching labs and the estate's oldest plant room. Highest device density of the three sites, and the building most often referenced: its Room 302 fire detector is the one currently in alarm.",
    photoHint: "Drop a photo of Building 216",
  },
  b209: {
    code: "SITE 209",
    address: "209 University Avenue",
    description:
      "Workshops and the loading bay. Smaller footprint than 216 but heavier equipment — the workshop's tool inventory and the atrium's AC plant are the two things that generate the most maintenance requests here.",
    photoHint: "Drop a photo of Building 209",
  },
  jsq: {
    code: "SITE JSQ",
    address: "Junction Square, Level 1-3",
    description:
      "Mixed-use block: reception, a server room and three lecture rooms across three levels. The server room's cooling load is watched closely — it's the site with the highest continuous power draw per room.",
    photoHint: "Drop a photo of Junction Square",
  },
};

export const ROOMS: Room[] = [
  {
    id: "r-216-302",
    buildingId: "b216",
    roomNumber: "Room 302",
    type: "lecture",
    floor: "3",
  },
  {
    id: "r-216-118",
    buildingId: "b216",
    roomNumber: "Room 118 — Teaching lab",
    type: "lab",
    floor: "1",
  },
  {
    id: "r-216-301",
    buildingId: "b216",
    roomNumber: "Room 301",
    type: "lecture",
    floor: "3",
  },
  {
    id: "r-216-303",
    buildingId: "b216",
    roomNumber: "Room 303",
    type: "lecture",
    floor: "3",
  },
  {
    id: "r-216-202",
    buildingId: "b216",
    roomNumber: "Room 202",
    type: "lecture",
    floor: "2",
  },
  {
    id: "r-216-corridor2",
    buildingId: "b216",
    roomNumber: "Level 2 corridor",
    type: "common",
    floor: "2",
  },
  {
    id: "r-216-store",
    buildingId: "b216",
    roomNumber: "Equipment store",
    type: "office",
    floor: "G",
  },
  {
    id: "r-216-plant",
    buildingId: "b216",
    roomNumber: "Roof plant room",
    type: "plant",
    floor: "3",
  },

  {
    id: "r-209-104",
    buildingId: "b209",
    roomNumber: "Workshop 1.04",
    type: "lab",
    floor: "1",
  },
  {
    id: "r-209-atrium",
    buildingId: "b209",
    roomNumber: "Atrium",
    type: "common",
    floor: "G",
  },
  {
    id: "r-209-basement",
    buildingId: "b209",
    roomNumber: "Basement store",
    type: "plant",
    floor: "G",
  },
  {
    id: "r-209-bay",
    buildingId: "b209",
    roomNumber: "Loading bay",
    type: "common",
    floor: "G",
  },
  {
    id: "r-209-105",
    buildingId: "b209",
    roomNumber: "Room 105",
    type: "lab",
    floor: "1",
  },
  {
    id: "r-209-210",
    buildingId: "b209",
    roomNumber: "Room 210",
    type: "lecture",
    floor: "2",
  },

  {
    id: "r-jsq-l2-14",
    buildingId: "jsq",
    roomNumber: "Room L2-14",
    type: "lecture",
    floor: "2",
  },
  {
    id: "r-jsq-l3-08",
    buildingId: "jsq",
    roomNumber: "Room L3-08",
    type: "lecture",
    floor: "3",
  },
  {
    id: "r-jsq-server",
    buildingId: "jsq",
    roomNumber: "Server room",
    type: "plant",
    floor: "1",
  },
  {
    id: "r-jsq-reception",
    buildingId: "jsq",
    roomNumber: "Reception",
    type: "office",
    floor: "G",
  },
  {
    id: "r-jsq-l1-02",
    buildingId: "jsq",
    roomNumber: "Room L1-02",
    type: "lecture",
    floor: "1",
  },
];

export const BUILDING_LOAD_KW: Record<string, number> = {
  b216: 214,
  b209: 167,
  jsq: 308,
};

export function buildingStats(buildingId: string) {
  const units = equipmentUnits().filter((u) => u.buildingId === buildingId);
  const faulty = units.filter((u) => u.condition === "faulty").length;
  const maint = units.filter((u) => u.condition === "under-maintenance").length;
  // Seed figures only. Anything on screen counts through useAppState so it
  // reflects moves made this session — see derive.countOpenRequests.
  const openReq = countOpenRequests(MAINTENANCE_REQUESTS, buildingId);
  const escalated = countEscalated(MAINTENANCE_REQUESTS, buildingId);
  const roomCount = roomsForBuilding(buildingId).length;
  return {
    faulty,
    maint,
    openReq,
    escalated,
    roomCount,
    kw: BUILDING_LOAD_KW[buildingId] ?? 0,
  };
}

// BUILDINGS and ROOMS above are the seed. The estate is editable from
// Administration, so the live lists live in AppStateProvider and it pushes
// them here — the same shim the sensor type registry uses, and for the same
// reason: every consumer keeps calling the same accessors, so renaming a
// building reaches every page instead of only the tab that renamed it.
let estateSource: { buildings: Building[]; rooms: Room[] } = {
  buildings: BUILDINGS,
  rooms: ROOMS,
};

export function setEstateSource(next: {
  buildings: Building[];
  rooms: Room[];
}): void {
  estateSource = next;
}

/** Every building on the estate, as it stands now. */
export function buildings(): Building[] {
  return estateSource.buildings;
}

/** Every room on the estate, as it stands now. */
export function rooms(): Room[] {
  return estateSource.rooms;
}

export function roomsForBuilding(buildingId: string): Room[] {
  return estateSource.rooms.filter((r) => r.buildingId === buildingId);
}

export function roomLabel(roomId: string): string {
  return estateSource.rooms.find((r) => r.id === roomId)?.roomNumber ?? roomId;
}

export function buildingName(buildingId: string): string {
  return (
    estateSource.buildings.find((b) => b.id === buildingId)?.name ?? buildingId
  );
}

// ---- Equipment types + registry ------------------------------------------

export const EQUIPMENT_TYPES: EquipmentTypeDef[] = [
  { id: "projector", label: "Projector" },
  { id: "air-conditioner", label: "Air conditioner" },
  { id: "fire-detector", label: "Fire detector" },
  { id: "door-controller", label: "Door controller" },
  { id: "lighting-controller", label: "Lighting controller" },
  { id: "temperature-sensor", label: "Temperature sensor" },
  { id: "air-handling-unit", label: "Air handling unit" },
  { id: "desktop-pc", label: "Desktop PC" },
  { id: "whiteboard-display", label: "Whiteboard display" },
  { id: "ceiling-lights", label: "Ceiling lights" },
];

function typeLabel(typeId: string): string {
  return EQUIPMENT_TYPES.find((t) => t.id === typeId)?.label ?? typeId;
}

// ---- Equipment units (asset register) --------------------------------------

export const EQUIPMENT_UNITS: EquipmentUnit[] = [
  {
    id: "EQ-216-01",
    tag: "EQ-216-01",
    buildingId: "b216",
    roomId: "r-216-302",
    typeId: "projector",
    condition: "faulty",
    installedAt: "2023-03-01",
    nextServiceDue: "2027-04-08",
    lastServiceAt: "2026-02-12",
  },
  {
    id: "EQ-216-02",
    tag: "EQ-216-02",
    buildingId: "b216",
    roomId: "r-216-302",
    typeId: "air-conditioner",
    condition: "healthy",
    installedAt: "2022-01-10",
    nextServiceDue: "2026-09-27",
    lastServiceAt: "2026-03-04",
  },
  {
    id: "EQ-216-03",
    tag: "EQ-216-03",
    buildingId: "b216",
    roomId: "r-216-302",
    typeId: "fire-detector",
    condition: "healthy",
    installedAt: "2021-06-15",
    nextServiceDue: "2026-12-08",
    lastServiceAt: "2026-06-11",
  },
  {
    id: "EQ-216-04",
    tag: "EQ-216-04",
    buildingId: "b216",
    roomId: "r-216-302",
    typeId: "door-controller",
    condition: "healthy",
    installedAt: "2021-06-15",
    nextServiceDue: "2026-09-03",
    lastServiceAt: "2026-03-09",
  },
  {
    id: "EQ-216-05",
    tag: "EQ-216-05",
    buildingId: "b216",
    roomId: "r-216-118",
    typeId: "projector",
    condition: "under-maintenance",
    installedAt: "2024-08-01",
    nextServiceDue: "2027-01-27",
    lastServiceAt: "2026-04-22",
  },
  {
    id: "EQ-216-06",
    tag: "EQ-216-06",
    buildingId: "b216",
    roomId: "r-216-corridor2",
    typeId: "lighting-controller",
    condition: "healthy",
    installedAt: "2020-02-14",
    nextServiceDue: "2026-09-21",
    lastServiceAt: "2026-03-18",
  },
  {
    id: "EQ-216-07",
    tag: "EQ-216-07",
    buildingId: "b216",
    roomId: "r-216-118",
    typeId: "temperature-sensor",
    condition: "healthy",
    installedAt: "2023-11-02",
    nextServiceDue: "2027-07-06",
    lastServiceAt: "2026-07-02",
  },
  {
    id: "EQ-216-08",
    tag: "EQ-216-08",
    buildingId: "b216",
    roomId: "r-216-plant",
    typeId: "air-handling-unit",
    condition: "faulty",
    installedAt: "2019-04-19",
    nextServiceDue: "2026-08-19",
    lastServiceAt: "2026-01-27",
  },
  {
    id: "EQ-216-09",
    tag: "EQ-216-09",
    buildingId: "b216",
    roomId: "r-216-store",
    typeId: "fire-detector",
    condition: "decommissioned",
    installedAt: "2018-06-03",
    nextServiceDue: "2026-11-08",
    lastServiceAt: "2025-11-14",
  },
  {
    id: "EQ-209-01",
    tag: "EQ-209-01",
    buildingId: "b209",
    roomId: "r-209-104",
    typeId: "projector",
    condition: "healthy",
    installedAt: "2023-05-11",
    nextServiceDue: "2026-11-24",
    lastServiceAt: "2026-05-30",
  },
  {
    id: "EQ-209-02",
    tag: "EQ-209-02",
    buildingId: "b209",
    roomId: "r-209-atrium",
    typeId: "air-conditioner",
    condition: "healthy",
    installedAt: "2021-09-20",
    nextServiceDue: "2026-10-03",
    lastServiceAt: "2026-04-08",
  },
  {
    id: "EQ-209-03",
    tag: "EQ-209-03",
    buildingId: "b209",
    roomId: "r-209-bay",
    typeId: "door-controller",
    condition: "under-maintenance",
    installedAt: "2022-03-08",
    nextServiceDue: "2027-03-16",
    lastServiceAt: "2026-06-16",
  },
  {
    id: "EQ-209-04",
    tag: "EQ-209-04",
    buildingId: "b209",
    roomId: "r-209-basement",
    typeId: "fire-detector",
    condition: "faulty",
    installedAt: "2020-07-22",
    nextServiceDue: "2026-08-27",
    lastServiceAt: "2026-02-21",
  },
  {
    id: "EQ-209-05",
    tag: "EQ-209-05",
    buildingId: "b209",
    roomId: "r-209-104",
    typeId: "lighting-controller",
    condition: "healthy",
    installedAt: "2024-01-14",
    nextServiceDue: "2027-04-17",
    lastServiceAt: "2026-07-19",
  },
  {
    id: "EQ-JSQ-01",
    tag: "EQ-JSQ-01",
    buildingId: "jsq",
    roomId: "r-jsq-l2-14",
    typeId: "door-controller",
    condition: "faulty",
    installedAt: "2023-02-17",
    nextServiceDue: "2026-10-25",
    lastServiceAt: "2026-05-05",
  },
  {
    id: "EQ-JSQ-02",
    tag: "EQ-JSQ-02",
    buildingId: "jsq",
    roomId: "r-jsq-l3-08",
    typeId: "projector",
    condition: "healthy",
    installedAt: "2022-10-04",
    nextServiceDue: "2026-09-29",
    lastServiceAt: "2026-03-12",
  },
  {
    id: "EQ-JSQ-03",
    tag: "EQ-JSQ-03",
    buildingId: "jsq",
    roomId: "r-jsq-server",
    typeId: "air-conditioner",
    condition: "under-maintenance",
    installedAt: "2021-06-21",
    nextServiceDue: "2026-08-30",
    lastServiceAt: "2026-01-28",
  },
  {
    id: "EQ-JSQ-04",
    tag: "EQ-JSQ-04",
    buildingId: "jsq",
    roomId: "r-jsq-l3-08",
    typeId: "temperature-sensor",
    condition: "healthy",
    installedAt: "2024-03-09",
    nextServiceDue: "2027-05-27",
    lastServiceAt: "2026-08-09",
  },
  {
    id: "EQ-JSQ-05",
    tag: "EQ-JSQ-05",
    buildingId: "jsq",
    roomId: "r-jsq-reception",
    typeId: "fire-detector",
    condition: "healthy",
    installedAt: "2021-08-15",
    nextServiceDue: "2027-01-30",
    lastServiceAt: "2026-06-03",
  },
  // Rooms people raise requests about had no assets in the register at all —
  // ten of the fourteen seeded requests pointed at a unit of roughly the right
  // type in some other room, and three at the wrong type entirely. These are
  // the units those requests are actually about.
  {
    id: "EQ-216-10",
    tag: "EQ-216-10",
    buildingId: "b216",
    roomId: "r-216-202",
    typeId: "air-conditioner",
    condition: "under-maintenance",
    installedAt: "2022-08-19",
    nextServiceDue: "2026-11-02",
    lastServiceAt: "2026-05-02",
  },
  {
    id: "EQ-216-11",
    tag: "EQ-216-11",
    buildingId: "b216",
    roomId: "r-216-301",
    typeId: "lighting-controller",
    condition: "healthy",
    installedAt: "2021-09-06",
    nextServiceDue: "2027-01-15",
    lastServiceAt: "2026-07-15",
  },
  {
    id: "EQ-216-12",
    tag: "EQ-216-12",
    buildingId: "b216",
    roomId: "r-216-301",
    typeId: "projector",
    condition: "healthy",
    installedAt: "2023-01-23",
    nextServiceDue: "2027-03-04",
    lastServiceAt: "2026-09-04",
  },
  {
    id: "EQ-216-13",
    tag: "EQ-216-13",
    buildingId: "b216",
    roomId: "r-216-303",
    typeId: "whiteboard-display",
    condition: "faulty",
    installedAt: "2024-02-05",
    nextServiceDue: "2027-02-05",
  },
  {
    id: "EQ-209-06",
    tag: "EQ-209-06",
    buildingId: "b209",
    roomId: "r-209-105",
    typeId: "desktop-pc",
    condition: "faulty",
    installedAt: "2023-10-11",
    nextServiceDue: "2026-10-11",
  },
  {
    id: "EQ-209-07",
    tag: "EQ-209-07",
    buildingId: "b209",
    roomId: "r-209-105",
    typeId: "lighting-controller",
    condition: "healthy",
    installedAt: "2021-11-30",
    nextServiceDue: "2027-05-20",
    lastServiceAt: "2026-05-20",
  },
  {
    id: "EQ-209-08",
    tag: "EQ-209-08",
    buildingId: "b209",
    roomId: "r-209-210",
    typeId: "projector",
    condition: "healthy",
    installedAt: "2022-04-14",
    nextServiceDue: "2027-04-14",
    lastServiceAt: "2026-04-14",
  },
  {
    id: "EQ-JSQ-06",
    tag: "EQ-JSQ-06",
    buildingId: "jsq",
    roomId: "r-jsq-l1-02",
    typeId: "air-conditioner",
    condition: "under-maintenance",
    installedAt: "2022-06-02",
    nextServiceDue: "2026-12-02",
    lastServiceAt: "2026-06-02",
  },
  {
    id: "EQ-JSQ-07",
    tag: "EQ-JSQ-07",
    buildingId: "jsq",
    roomId: "r-jsq-l1-02",
    typeId: "desktop-pc",
    condition: "healthy",
    installedAt: "2024-01-08",
    nextServiceDue: "2027-01-08",
    lastServiceAt: "2026-07-08",
  },
];

// ---- The two-record join ---------------------------------------------------
//
// A fire detector is one physical device with a row in each table: the
// EquipmentUnit is the asset (tag, condition, service history), the
// EnvironmentalSensor is the live state (status, last report). They are
// joined by linkedEquipmentId and never merged — both drawers cross to the
// other record rather than duplicating its fields.
//
// The join key is the unit's **id**, not its tag. They are equal in the seed,
// which is exactly why this has to be settled now: a tag is a label somebody
// can edit, and the day the equipment drawer's "Save details" writes for real,
// a rename would otherwise orphan this join, every request's equipmentId and
// every log entry's refId at once.
//
// Like the estate and the sensor registry, these read through a holder the
// provider feeds, so they answer for the live register rather than the frozen
// seed once the data is subscribed.
export function equipmentUnitLabel(u: EquipmentUnit): string {
  return typeLabel(u.typeId);
}

export const EQUIPMENT_HISTORY: EquipmentHistoryEvent[] = [
  {
    id: "h1",
    equipmentUnitId: "EQ-216-01",
    type: "fault-reported",
    at: "2026-09-09T18:50:00Z",
    summary: "Lamp fault persists after reseat — marked faulty",
    actorName: "Hnin Nwe",
  },
  {
    id: "h2",
    equipmentUnitId: "EQ-216-01",
    type: "service",
    at: "2026-02-12T09:00:00Z",
    summary: "Lamp module replaced, 1200h counter reset",
    actorName: "Elysha",
  },
  {
    id: "h3",
    equipmentUnitId: "EQ-216-01",
    type: "installed",
    at: "2023-03-01T00:00:00Z",
    summary: "Installed in Room 302",
    actorName: "Facilities team",
  },
  {
    id: "h4",
    equipmentUnitId: "EQ-216-08",
    type: "fault-reported",
    at: "2026-01-27T08:00:00Z",
    summary: "Reporting fault after overnight trip",
    actorName: "Su Myat",
  },
  {
    id: "h5",
    equipmentUnitId: "EQ-216-08",
    type: "installed",
    at: "2019-04-19T00:00:00Z",
    summary: "Installed in Roof plant room",
    actorName: "Facilities team",
  },
];

// ---- Sensor types + registry ------------------------------------------------

export const SENSOR_TYPES: SensorTypeDef[] = [
  {
    id: "fire-alarm",
    label: "Fire detector",
    icon: "flame",
    statuses: [
      { id: "normal", label: "Normal", tone: "success", isAlarm: false },
      {
        id: "triggered",
        label: "Triggered",
        tone: "danger",
        isAlarm: true,
        pulse: true,
      },
      { id: "offline", label: "Offline", tone: "neutral", isAlarm: false },
    ],
    actions: [
      {
        id: "reset",
        label: "Reset",
        caption: "Clears the alarm and returns the detector to normal",
        resultStatus: "normal",
        requiresNote: true,
        allowedRoles: ["admin-manager", "ceo-super-admin"],
      },
    ],
  },
  {
    id: "door-lock",
    label: "Door lock",
    icon: "lock",
    statuses: [
      { id: "locked", label: "Locked", tone: "success", isAlarm: false },
      {
        id: "unlocked",
        label: "Unlocked",
        tone: "info",
        isAlarm: false,
        // A door left open all morning is a different thing from one somebody
        // just walked through, so the tone moves once it stops being brief.
        escalateAfterMinutes: 30,
        escalateTone: "warning",
      },
      {
        id: "forced-open",
        label: "Forced open",
        tone: "danger",
        isAlarm: true,
        pulse: true,
      },
      { id: "offline", label: "Offline", tone: "neutral", isAlarm: false },
    ],
    actions: [
      {
        id: "lock",
        label: "Lock",
        caption: "Engages the lock on the next door cycle",
        resultStatus: "locked",
        allowedRoles: ["admin-manager", "ceo-super-admin"],
      },
      {
        id: "unlock",
        label: "Unlock",
        caption: "Releases the lock until it is locked again",
        resultStatus: "unlocked",
        allowedRoles: ["admin-manager", "ceo-super-admin"],
      },
    ],
  },
];

// SENSOR_TYPES above is the seed. The live registry is editable from
// Administration, so it lives in AppStateProvider — and this module holds the
// current list behind the same three accessors every consumer already calls.
//
// The provider pushes each new list here with setSensorRegistrySource, which
// is why swapping the source stayed a change to this file alone. When the
// registry moves to Firestore, this holder is what the subscription feeds.
let registrySource: SensorTypeDef[] = SENSOR_TYPES;

export function setSensorRegistrySource(next: SensorTypeDef[]): void {
  registrySource = next;
}

/** The registry as the UI should list it: current order, archived entries out. */
export function sensorTypes(): SensorTypeDef[] {
  return registrySource.filter((t) => !t.archived);
}

/** Resolves by id including archived types, so existing records still render. */
export function sensorType(typeId: string): SensorTypeDef | undefined {
  return registrySource.find((t) => t.id === typeId);
}

export function statusDef(
  typeId: string,
  statusId: string,
): SensorStatusDef | undefined {
  return sensorType(typeId)?.statuses.find((st) => st.id === statusId);
}

export const SENSORS: EnvironmentalSensor[] = [
  {
    id: "FD-216-14",
    buildingId: "b216",
    roomId: "r-216-302",
    typeId: "fire-alarm",
    // The one device in alarm. A 20-second timer in app-state used to trip it;
    // that went with the rest of the demo scaffolding, so the state now lives
    // in the data where every other sensor's does.
    status: "triggered",
    linkedEquipmentId: "EQ-216-03",
    updatedAt: "2026-09-09T20:38:00Z",
  },
  {
    id: "FD-216-08",
    buildingId: "b216",
    roomId: "r-216-corridor2",
    typeId: "fire-alarm",
    status: "normal",
    updatedAt: "2026-09-09T20:19:38Z",
  },
  {
    id: "FD-216-03",
    buildingId: "b216",
    roomId: "r-216-118",
    typeId: "fire-alarm",
    status: "normal",
    updatedAt: "2026-09-09T20:19:38Z",
  },
  {
    id: "FD-216-21",
    buildingId: "b216",
    roomId: "r-216-plant",
    typeId: "fire-alarm",
    status: "offline",
    updatedAt: "2026-09-09T15:20:00Z",
  },
  {
    id: "DL-216-302",
    buildingId: "b216",
    roomId: "r-216-302",
    typeId: "door-lock",
    status: "unlocked",
    updatedAt: "2026-09-09T08:14:00Z",
  },
  {
    id: "DL-216-001",
    buildingId: "b216",
    roomId: "r-216-store",
    typeId: "door-lock",
    status: "locked",
    updatedAt: "2026-09-09T19:02:00Z",
  },
  {
    id: "DL-216-045",
    buildingId: "b216",
    roomId: "r-216-store",
    typeId: "door-lock",
    status: "locked",
    updatedAt: "2026-09-09T17:40:00Z",
  },
  {
    id: "FD-209-02",
    buildingId: "b209",
    roomId: "r-209-atrium",
    typeId: "fire-alarm",
    status: "normal",
    updatedAt: "2026-09-09T20:21:42Z",
  },
  {
    id: "FD-209-06",
    buildingId: "b209",
    roomId: "r-209-104",
    typeId: "fire-alarm",
    status: "normal",
    updatedAt: "2026-09-09T20:21:42Z",
  },
  {
    id: "FD-209-11",
    buildingId: "b209",
    roomId: "r-209-basement",
    typeId: "fire-alarm",
    status: "offline",
    updatedAt: "2026-09-08T13:00:00Z",
  },
  {
    id: "DL-209-104",
    buildingId: "b209",
    roomId: "r-209-104",
    typeId: "door-lock",
    status: "locked",
    updatedAt: "2026-09-09T18:25:00Z",
  },
  {
    id: "DL-209-000",
    buildingId: "b209",
    roomId: "r-209-bay",
    typeId: "door-lock",
    status: "unlocked",
    updatedAt: "2026-09-09T07:50:00Z",
  },
  {
    id: "FD-JSQ-09",
    buildingId: "jsq",
    roomId: "r-jsq-l3-08",
    typeId: "fire-alarm",
    status: "normal",
    updatedAt: "2026-09-09T20:28:49Z",
  },
  {
    id: "FD-JSQ-04",
    buildingId: "jsq",
    roomId: "r-jsq-server",
    typeId: "fire-alarm",
    status: "normal",
    updatedAt: "2026-09-09T20:28:49Z",
  },
  {
    id: "DL-JSQ-214",
    buildingId: "jsq",
    roomId: "r-jsq-l2-14",
    typeId: "door-lock",
    status: "forced-open",
    updatedAt: "2026-09-09T20:14:00Z",
  },
  {
    id: "DL-JSQ-308",
    buildingId: "jsq",
    roomId: "r-jsq-l3-08",
    typeId: "door-lock",
    status: "locked",
    updatedAt: "2026-09-09T18:55:00Z",
  },
  {
    id: "DL-JSQ-001",
    buildingId: "jsq",
    roomId: "r-jsq-reception",
    typeId: "door-lock",
    status: "locked",
    updatedAt: "2026-09-09T20:10:00Z",
  },
];

/** Room 302's fire detector — the sensor the scripted 20s demo alarm drives. */
let assetSource: { units: EquipmentUnit[]; sensors: EnvironmentalSensor[] } = {
  units: EQUIPMENT_UNITS,
  sensors: SENSORS,
};

export function setAssetSource(next: {
  units: EquipmentUnit[];
  sensors: EnvironmentalSensor[];
}): void {
  assetSource = next;
}

export function equipmentUnits(): EquipmentUnit[] {
  return assetSource.units;
}

export function sensorForEquipment(
  equipmentId: string,
): EnvironmentalSensor | undefined {
  return assetSource.sensors.find((s) => s.linkedEquipmentId === equipmentId);
}

export function equipmentForSensor(
  sensor: EnvironmentalSensor,
): EquipmentUnit | undefined {
  if (!sensor.linkedEquipmentId) return undefined;
  return assetSource.units.find((u) => u.id === sensor.linkedEquipmentId);
}

// ---- Maintenance requests ---------------------------------------------------

export const MAINTENANCE_REQUESTS: MaintenanceRequest[] = [
  {
    id: "REQ-4192",
    buildingId: "b216",
    roomId: "r-216-302",
    equipmentId: "EQ-216-01",
    issue: "Projector will not power on; lamp indicator flashing red",
    priority: "high",
    status: "requested",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: "2026-09-08T13:00:00Z",
    updatedAt: "2026-09-08T13:00:00Z",
  },
  {
    id: "REQ-4188",
    buildingId: "b216",
    roomId: "r-216-202",
    equipmentId: "EQ-216-10",
    issue: "AC unit 2 leaking condensate onto floor tiles",
    priority: "high",
    status: "in-progress",
    submittedBy: "u-ko",
    submittedByName: "Elysha",
    submittedAt: "2026-09-08T18:00:00Z",
    updatedAt: "2026-09-09T09:00:00Z",
  },
  {
    id: "REQ-4185",
    buildingId: "b216",
    roomId: "r-216-301",
    equipmentId: "EQ-216-11",
    issue: "Three of eight fluorescent tubes not lighting",
    priority: "normal",
    status: "requested",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: "2026-09-09T06:00:00Z",
    updatedAt: "2026-09-09T06:00:00Z",
  },
  {
    id: "REQ-4181",
    buildingId: "jsq",
    roomId: "r-jsq-l2-14",
    equipmentId: "EQ-JSQ-01",
    issue: "Card reader intermittently rejects valid staff cards",
    priority: "high",
    status: "approved",
    submittedBy: "u-zaw",
    submittedByName: "Zaw Lin",
    submittedAt: "2026-09-08T15:00:00Z",
    updatedAt: "2026-09-08T15:00:00Z",
  },
  {
    id: "REQ-4177",
    buildingId: "b209",
    roomId: "r-209-105",
    equipmentId: "EQ-209-06",
    issue: "Two lab machines fail to boot after power event",
    priority: "normal",
    status: "in-progress",
    submittedBy: "u-zaw2",
    submittedByName: "Zaw Lin",
    submittedAt: "2026-09-09T01:00:00Z",
    updatedAt: "2026-09-09T05:00:00Z",
  },
  {
    id: "REQ-4174",
    buildingId: "b216",
    roomId: "r-216-303",
    equipmentId: "EQ-216-13",
    issue: "Touch layer unresponsive on left third of panel",
    priority: "normal",
    status: "approved",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: "2026-09-09T12:00:00Z",
    updatedAt: "2026-09-09T12:00:00Z",
  },
  {
    id: "REQ-4170",
    buildingId: "jsq",
    roomId: "r-jsq-l1-02",
    equipmentId: "EQ-JSQ-06",
    issue: "Fan noise above normal under full load",
    priority: "normal",
    status: "in-progress",
    submittedBy: "u-zaw",
    submittedByName: "Zaw Lin",
    submittedAt: "2026-09-09T09:00:00Z",
    updatedAt: "2026-09-09T10:00:00Z",
  },
  {
    id: "REQ-4166",
    buildingId: "b216",
    roomId: "r-216-202",
    equipmentId: "EQ-216-10",
    issue: "Filter clogged — replaced and unit retested",
    priority: "normal",
    status: "resolved",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: "2026-09-07T04:00:00Z",
    updatedAt: "2026-09-09T08:00:00Z",
  },
  {
    id: "REQ-4163",
    buildingId: "jsq",
    roomId: "r-jsq-l1-02",
    equipmentId: "EQ-JSQ-07",
    issue: "Replacement PSU fitted to workstation 6",
    priority: "normal",
    status: "resolved",
    submittedBy: "u-zaw",
    submittedByName: "Zaw Lin",
    submittedAt: "2026-09-06T14:00:00Z",
    updatedAt: "2026-09-09T08:00:00Z",
  },
  {
    id: "REQ-4161",
    buildingId: "b209",
    roomId: "r-209-105",
    equipmentId: "EQ-209-07",
    issue: "Two tubes and one starter replaced",
    priority: "normal",
    status: "resolved",
    submittedBy: "u-zaw2",
    submittedByName: "Zaw Lin",
    submittedAt: "2026-09-06T20:00:00Z",
    updatedAt: "2026-09-09T08:00:00Z",
  },
  {
    id: "REQ-4158",
    buildingId: "b209",
    roomId: "r-209-210",
    equipmentId: "EQ-209-08",
    issue: "HDMI input board swapped out",
    priority: "high",
    status: "resolved",
    submittedBy: "u-zaw2",
    submittedByName: "Zaw Lin",
    submittedAt: "2026-09-05T12:00:00Z",
    updatedAt: "2026-09-09T08:00:00Z",
  },
  {
    id: "REQ-4155",
    buildingId: "jsq",
    roomId: "r-jsq-l3-08",
    equipmentId: "EQ-JSQ-04",
    issue: "Sensor re-paired to gateway after firmware update",
    priority: "normal",
    status: "completed",
    submittedBy: "u-zaw",
    submittedByName: "Zaw Lin",
    submittedAt: "2026-09-04T20:00:00Z",
    updatedAt: "2026-09-08T08:00:00Z",
  },
  {
    id: "REQ-4152",
    buildingId: "b216",
    roomId: "r-216-301",
    equipmentId: "EQ-216-12",
    issue: "Lamp module replaced, 1200h counter reset",
    priority: "normal",
    status: "completed",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: "2026-09-04T00:00:00Z",
    updatedAt: "2026-09-08T08:00:00Z",
  },
  {
    id: "REQ-4149",
    buildingId: "b216",
    roomId: "r-216-302",
    equipmentId: "EQ-216-04",
    issue: "Card reader firmware updated, rejections cleared",
    priority: "high",
    status: "completed",
    submittedBy: "u-ko",
    submittedByName: "Elysha",
    submittedAt: "2026-09-02T20:00:00Z",
    updatedAt: "2026-09-07T20:00:00Z",
  },
];

// Requests move forward one step, and back one step at a time behind a
// confirm — work gets marked done too early. Completed is the end of the
// line forward; requested is the end of the line back. The age never resets.
//
// The first step is the approval gate. Stepping back across it un-approves a
// request rather than deleting it, which is a different thing from declining
// one (declining leaves the status alone and attaches a reason).
export const REQUEST_NEXT_STATUS: Record<
  MaintenanceRequest["status"],
  MaintenanceRequest["status"] | null
> = {
  requested: "approved",
  approved: "in-progress",
  "in-progress": "resolved",
  resolved: "completed",
  completed: null,
};

export const REQUEST_PREV_STATUS: Record<
  MaintenanceRequest["status"],
  MaintenanceRequest["status"] | null
> = {
  requested: null,
  approved: "requested",
  "in-progress": "approved",
  resolved: "in-progress",
  completed: "resolved",
};

export const REQUEST_NEXT_ACTION: Record<
  MaintenanceRequest["status"],
  string | null
> = {
  requested: "Approve",
  approved: "Start work",
  "in-progress": "Mark resolved",
  resolved: "Close out",
  completed: null,
};

export const REQUEST_PREV_ACTION: Record<
  MaintenanceRequest["status"],
  string | null
> = {
  requested: null,
  approved: "Withdraw approval",
  "in-progress": "Back to approved",
  resolved: "Reopen work",
  completed: "Reopen",
};

// ---- Historical Records (long-range ledger) --------------------------------

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

const HR_TEXT: Record<HistoricalRecord["type"], string[]> = {
  alarm: [
    "Fire alarm triggered",
    "Fire alarm reset with written reason",
    "Door forced open past 90s threshold",
    "Sensor stopped reporting",
    "Sensor restored to normal",
  ],
  request: [
    "Request opened",
    "Request assigned to engineer",
    "Work started on request",
    "Request marked resolved",
    "Request closed out",
    "Request escalated past 24h",
  ],
  service: [
    "Scheduled service completed",
    "Filter replaced and unit tested",
    "Firmware updated",
    "Unit returned to service",
    "Unit taken under maintenance",
  ],
  access: [
    "Card access granted",
    "Door unlocked from console",
    "Door locked on schedule",
    "Access denied — unknown card",
  ],
  system: [
    "Account created",
    "Role permissions changed",
    "Report exported",
    "Nightly backup completed",
    "Sensor polling interval changed",
  ],
};

const HR_PEOPLE = [
  "Elysha",
  "Su Myat",
  "Hnin Nwe",
  "Zaw Lin",
  "Thida Win",
  "Nay Oo",
  "Daw Htun",
];

export const HISTORICAL_RECORDS: HistoricalRecord[] = (() => {
  const rnd = seededRandom(20260909);
  const types: HistoricalRecord["type"][] = [
    "alarm",
    "request",
    "request",
    "service",
    "access",
    "access",
    "system",
  ];
  const buildingIds = ["b216", "b216", "b209", "jsq"];
  const out: HistoricalRecord[] = [];
  const now = new Date("2026-09-09T20:41:00Z").getTime();
  let counter = 0;
  for (let day = 0; day < 30; day++) {
    const n = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const type = pick(rnd, types);
      const buildingId = pick(rnd, buildingIds);
      const rooms = roomsForBuilding(buildingId);
      const room = type === "system" ? undefined : pick(rnd, rooms);
      const base = pick(rnd, HR_TEXT[type]);
      const isRequest = type === "request";
      const isService = type === "service";
      const refId = isRequest
        ? `REQ-${4000 + Math.floor(rnd() * 900)}`
        : isService
          ? `EQ-${buildingId.toUpperCase()}-0${1 + Math.floor(rnd() * 9)}`
          : undefined;
      const scheduled = base === "Door locked on schedule";
      const reader = base === "Access denied — unknown card";
      const dayStart = Math.floor((now - day * 86400000) / 86400000) * 86400000;
      const hour = 6 + Math.floor(rnd() * 16); // spread across a 06:00-22:00 workday
      const minute = Math.floor(rnd() * 60);
      const timestamp = new Date(
        Math.min(now, dayStart + hour * 3600000 + minute * 60000),
      ).toISOString();
      out.push({
        id: `hr-${counter++}`,
        timestamp,
        type,
        buildingId: type === "system" ? undefined : buildingId,
        roomId: room?.id,
        text: base + (refId ? ` · ${refId}` : ""),
        refId,
        actorName:
          type === "system"
            ? "System"
            : scheduled
              ? "System · schedule"
              : reader
                ? "System · card reader"
                : pick(rnd, HR_PEOPLE),
      });
    }
  }
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
})();

// ---- Log Book (live, system-written feed) ----------------------------------

export const LOG_BOOK: LogBookEntry[] = [
  {
    id: "L-1",
    timestamp: "2026-09-09T20:14:00Z",
    actorName: "Sensor network",
    source: "alert",
    actionType: "sensor-status-changed",
    title: "Door forced open",
    detail:
      "Junction Square / Room L2-14 held open past the 90-second threshold, no valid card on the reader.",
    targetType: "sensor",
    targetId: "DL-JSQ-214",
    buildingId: "jsq",
    refId: "DL-JSQ-214",
  },
  {
    id: "L-2",
    timestamp: "2026-09-09T19:58:00Z",
    actorName: "Nay Oo",
    actorRole: "office-staff",
    source: "access",
    actionType: "sensor-status-changed",
    title: "Card access granted",
    detail:
      "Junction Square / Reception — out-of-hours entry on a valid staff card.",
    targetType: "sensor",
    targetId: "DL-JSQ-001",
    buildingId: "jsq",
    refId: "DL-JSQ-001",
  },
  {
    id: "L-3",
    timestamp: "2026-09-09T19:30:00Z",
    actorName: "Hnin Nwe",
    actorRole: "office-staff",
    source: "request",
    actionType: "request-created",
    title: "Request opened · REQ-4149",
    detail:
      "Building 216 / Room 302 — card reader intermittent. Priority high.",
    targetType: "request",
    targetId: "REQ-4149",
    buildingId: "b216",
    refId: "REQ-4149",
  },
  {
    id: "L-4",
    timestamp: "2026-09-09T18:50:00Z",
    actorName: "Hnin Nwe",
    actorRole: "office-staff",
    source: "equipment",
    actionType: "equipment-status-changed",
    title: "Marked faulty",
    detail:
      "Projector in Room 302 — lamp fault persists after reseat, unit out of service.",
    targetType: "equipment",
    targetId: "EQ-216-01",
    buildingId: "b216",
    refId: "EQ-216-01",
  },
  {
    id: "L-5",
    timestamp: "2026-09-09T17:40:00Z",
    actorName: "System · schedule",
    source: "access",
    actionType: "sensor-status-changed",
    title: "Door locked on schedule",
    detail:
      "Building 216 / Equipment store secured at the end of the working day.",
    targetType: "sensor",
    targetId: "DL-216-045",
    buildingId: "b216",
    refId: "DL-216-045",
  },
  {
    id: "L-6",
    timestamp: "2026-09-09T17:05:00Z",
    actorName: "Thida Win",
    actorRole: "office-staff",
    source: "equipment",
    actionType: "equipment-status-changed",
    title: "Service recorded",
    detail:
      "Atrium air conditioner serviced by contractor, gas topped up. Next service due in six months.",
    targetType: "equipment",
    targetId: "EQ-209-02",
    buildingId: "b209",
    refId: "EQ-209-02",
  },
  {
    id: "L-7",
    timestamp: "2026-09-09T16:20:00Z",
    actorName: "Sensor network",
    source: "sensor",
    actionType: "sensor-status-changed",
    title: "Sensor stopped reporting",
    detail:
      "Junction Square / Room L3-08 temperature sensor — no reading since 16:18.",
    targetType: "sensor",
    targetId: "EQ-JSQ-04",
    buildingId: "jsq",
    refId: "EQ-JSQ-04",
  },
  {
    id: "L-8",
    timestamp: "2026-09-09T15:45:00Z",
    actorName: "Elysha",
    actorRole: "admin-manager",
    source: "request",
    actionType: "request-status-changed",
    title: "Request moved to In progress",
    detail:
      "Building 209 / Workshop 1.04 — engineer assigned and work started.",
    targetType: "request",
    targetId: "REQ-4131",
    buildingId: "b209",
    refId: "REQ-4131",
  },
  {
    id: "L-9",
    timestamp: "2026-09-09T14:20:00Z",
    actorName: "Sensor network",
    source: "sensor",
    actionType: "sensor-status-changed",
    title: "Reading above range",
    detail:
      "Junction Square / Server room at 26.4°C, three degrees above the set point.",
    targetType: "equipment",
    targetId: "EQ-JSQ-03",
    buildingId: "jsq",
    refId: "EQ-JSQ-03",
  },
  {
    id: "L-10",
    timestamp: "2026-09-09T13:10:00Z",
    actorName: "System · card reader",
    source: "access",
    actionType: "sensor-status-changed",
    title: "Access denied — unknown card",
    detail:
      "Building 216 / Main entrance — card not on the register, entry refused.",
    targetType: "sensor",
    targetId: "DL-216-001",
    buildingId: "b216",
    refId: "DL-216-001",
  },
  {
    id: "L-11",
    timestamp: "2026-09-09T11:35:00Z",
    actorName: "Su Myat",
    actorRole: "admin-manager",
    source: "request",
    actionType: "request-status-changed",
    title: "Request resolved",
    detail:
      "Building 216 / Level 2 corridor lighting — controller reset and tested.",
    targetType: "request",
    targetId: "REQ-4118",
    buildingId: "b216",
    refId: "REQ-4118",
  },
  {
    id: "L-12",
    timestamp: "2026-09-09T10:50:00Z",
    actorName: "Sensor network",
    source: "sensor",
    actionType: "sensor-status-changed",
    title: "Sensor stopped reporting",
    detail:
      "Building 216 / Roof plant room detector — last value normal, no reading since 10:48.",
    targetType: "sensor",
    targetId: "FD-216-21",
    buildingId: "b216",
    refId: "FD-216-21",
  },
  {
    id: "L-13",
    timestamp: "2026-09-09T09:15:00Z",
    actorName: "Daw Htun",
    actorRole: "ceo-super-admin",
    source: "admin",
    actionType: "user-added",
    title: "Account created",
    detail: "Zaw Lin added as Office Staff, scoped to Building 216.",
    targetType: "user",
    targetId: "u-zaw",
    buildingId: "b216",
  },
  {
    id: "L-14",
    timestamp: "2026-09-09T08:00:00Z",
    actorName: "System · schedule",
    source: "access",
    actionType: "sensor-status-changed",
    title: "Door unlocked on schedule",
    detail: "Building 216 / Main entrance opened for the working day.",
    targetType: "sensor",
    targetId: "DL-216-001",
    buildingId: "b216",
    refId: "DL-216-001",
  },
  {
    id: "L-15",
    timestamp: "2026-09-09T07:20:00Z",
    actorName: "System",
    source: "sensor",
    actionType: "sensor-status-changed",
    title: "Nightly self-test passed",
    detail:
      "186 devices reporting across the estate, two offline and already logged.",
    targetType: "sensor",
    targetId: "estate",
    buildingId: "b216",
  },
  {
    id: "L-16",
    timestamp: "2026-09-08T23:40:00Z",
    actorName: "Sensor network",
    source: "sensor",
    actionType: "sensor-status-changed",
    title: "Sensor stopped reporting",
    detail: "Building 209 / Basement store detector dropped off the network.",
    targetType: "sensor",
    targetId: "FD-209-11",
    buildingId: "b209",
    refId: "FD-209-11",
  },
  {
    id: "L-17",
    timestamp: "2026-09-08T22:05:00Z",
    actorName: "System",
    source: "request",
    actionType: "request-status-changed",
    title: "Request escalated past 24h",
    detail:
      "High-priority request unresolved for 24 hours — escalated to the Admin Manager.",
    targetType: "request",
    targetId: "REQ-4102",
    buildingId: "b209",
    refId: "REQ-4102",
  },
  {
    id: "L-18",
    timestamp: "2026-09-08T18:25:00Z",
    actorName: "System · schedule",
    source: "access",
    actionType: "sensor-status-changed",
    title: "Door locked on schedule",
    detail: "Building 209 / Workshop 1.04 secured for the night.",
    targetType: "sensor",
    targetId: "DL-209-104",
    buildingId: "b209",
    refId: "DL-209-104",
  },
];

// ---- Dashboard "needs attention" rail (non-alarm items; the live fire
// alarm scenario is layered on top at runtime from app-state) -------------

export interface AttentionItem {
  id: string;
  sev: "faulty" | "maint" | "offline";
  buildingId: string;
  typeLabel: string;
  location: string;
  detail: string;
  since: string;
  action: string;
}

export const ATTENTION_ITEMS: AttentionItem[] = [
  {
    id: "att-1",
    sev: "maint",
    buildingId: "b216",
    typeLabel: "Air conditioner",
    location: "216 / Room 202",
    detail: "AC unit under maintenance since Monday",
    since: "3d",
    action: "Mark running",
  },
  {
    id: "att-2",
    sev: "faulty",
    buildingId: "b209",
    typeLabel: "Desktop PC",
    location: "209 / Room 105",
    detail: "2 of 24 lab machines faulty",
    since: "19h",
    action: "Log request",
  },
  {
    id: "att-3",
    sev: "offline",
    buildingId: "jsq",
    typeLabel: "Temperature sensor",
    location: "Junction Sq / L3-08",
    detail: "Sensor not reporting since 16:18",
    since: "5h",
    action: "Ping",
  },
];

// Deterministic per-building power draw for the dashboard's "kW demand"
// sparkline — not truly live, but shaped like it (small daily wobble).
export function powerSeries(buildingId: string, bars = 24): number[] {
  const base = buildingId === "jsq" ? 308 : buildingId === "b216" ? 214 : 167;
  const rnd = seededRandom(base * 31);
  return Array.from({ length: bars }, (_, i) => {
    const timeOfDay = Math.sin((i / bars) * Math.PI); // low at night, high midday
    return Math.round(base * (0.55 + 0.45 * timeOfDay) * (0.9 + rnd() * 0.2));
  });
}

export const LOG_BOOK_SOURCE_META: Record<
  LogBookEntry["source"],
  { label: string }
> = {
  alert: { label: "ALERT" },
  sensor: { label: "SENSOR" },
  request: { label: "REQUEST" },
  equipment: { label: "EQUIPMENT" },
  access: { label: "ACCESS" },
  admin: { label: "ADMIN" },
};

// ---- Reports -----------------------------------------------------------------

export const REPORTS: Report[] = [
  {
    id: "RPT-2608-216",
    kind: "maintenance-performance",
    period: "August 2026",
    buildingId: "b216",
    generatedAt: "2026-09-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "ready",
  },
  {
    id: "RPT-2608-209",
    kind: "maintenance-performance",
    period: "August 2026",
    buildingId: "b209",
    generatedAt: "2026-09-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "ready",
  },
  {
    id: "RPT-2608-JSQ",
    kind: "maintenance-performance",
    period: "August 2026",
    buildingId: "jsq",
    generatedAt: "2026-09-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "ready",
  },
  {
    id: "RPT-2608-EST",
    kind: "maintenance-performance",
    period: "August 2026",
    generatedAt: "2026-09-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "ready",
  },
  {
    id: "RPT-2608-REL",
    kind: "equipment-reliability",
    period: "August 2026",
    generatedAt: "2026-09-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "ready",
  },
  {
    id: "RPT-2608-CST",
    kind: "cost-of-maintenance",
    period: "August 2026",
    generatedAt: "2026-09-02T00:00:00Z",
    generatedBy: "Daw Htun",
    status: "ready",
  },
  {
    id: "RPT-2609-ADH",
    kind: "equipment-reliability",
    period: "01–08 Sep 2026",
    buildingId: "b216",
    generatedAt: "2026-09-08T00:00:00Z",
    generatedBy: "Elysha",
    status: "ready",
  },
  {
    id: "RPT-2607-216",
    kind: "maintenance-performance",
    period: "July 2026",
    buildingId: "b216",
    generatedAt: "2026-08-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "ready",
  },
  {
    id: "RPT-2607-EST",
    kind: "maintenance-performance",
    period: "July 2026",
    generatedAt: "2026-08-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "ready",
  },
  {
    id: "RPT-2607-REL",
    kind: "equipment-reliability",
    period: "July 2026",
    buildingId: "b209",
    generatedAt: "2026-08-01T00:00:00Z",
    generatedBy: "Su Myat",
    status: "ready",
  },
  {
    id: "RPT-2607-CST",
    kind: "cost-of-maintenance",
    period: "July 2026",
    generatedAt: "2026-08-03T00:00:00Z",
    generatedBy: "Daw Htun",
    status: "ready",
  },
  {
    id: "RPT-2606-EST",
    kind: "maintenance-performance",
    period: "June 2026",
    generatedAt: "2026-07-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "archived",
  },
  {
    id: "RPT-2609-EST",
    kind: "maintenance-performance",
    period: "September 2026",
    generatedAt: "2026-10-01T00:00:00Z",
    generatedBy: "System · schedule",
    status: "scheduled",
  },
];

export function reportDetail(report: Report): ReportDetail {
  // Deterministic per-report figures so numbers stay stable across renders.
  const seed = Array.from(report.id).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = seededRandom(seed * 7919);
  const scope = report.buildingId
    ? buildingName(report.buildingId)
    : "Whole estate";

  const weeks = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5"].map((label) => {
    const resolved = 8 + Math.floor(rnd() * 14);
    const carriedOver = Math.floor(rnd() * 5);
    return { label, resolved, carriedOver };
  });

  const faultTypes = EQUIPMENT_TYPES.slice(0, 5)
    .map((t) => ({
      typeLabel: t.label,
      count: 1 + Math.floor(rnd() * 9),
    }))
    .sort((a, b) => b.count - a.count);

  const offenderUnits = EQUIPMENT_UNITS.filter((u) =>
    report.buildingId ? u.buildingId === report.buildingId : true,
  ).slice(0, 5);
  const offenders = offenderUnits
    .map((u) => ({
      tag: u.tag,
      unitLabel: `${typeLabel(u.typeId)} — ${roomLabel(u.roomId)}`,
      faults: 1 + Math.floor(rnd() * 6),
      downtimeHours: 2 + Math.floor(rnd() * 40),
      costMmk: 20000 + Math.floor(rnd() * 400000),
    }))
    .sort((a, b) => b.faults - a.faults);

  const partsCost = 420000 + Math.floor(rnd() * 300000);
  const laborCost = 260000 + Math.floor(rnd() * 200000);
  const contractorCost = 180000 + Math.floor(rnd() * 250000);
  const total = partsCost + laborCost + contractorCost;
  const budgetMmk = Math.round(total * (1.05 + rnd() * 0.25));

  const totalResolved = weeks.reduce((a, w) => a + w.resolved, 0);
  const totalCarried = weeks.reduce((a, w) => a + w.carriedOver, 0);
  const resolutionRate = Math.round(
    (totalResolved / (totalResolved + totalCarried)) * 100,
  );

  return {
    ...report,
    kpis: [
      {
        label: "RESOLVED WITHIN 24H",
        value: resolutionRate,
        unit: "%",
        target: 90,
        compare: "gte",
        targetLabel: "Target ≥ 90%",
      },
      {
        label: "AVG. RESPONSE TIME",
        value: Math.round(40 + rnd() * 200) / 10,
        unit: "hrs",
        target: ESCALATION_WINDOW_HOURS,
        compare: "lte",
        targetLabel: `Target ≤ ${ESCALATION_WINDOW_HOURS}h`,
      },
      {
        label: "ESCALATION RATE",
        value: Math.round(rnd() * 180) / 10,
        unit: "%",
        target: 10,
        compare: "lt",
        targetLabel: "Target < 10%",
      },
      {
        label: "SPEND AGAINST BUDGET",
        value: Math.round((total / budgetMmk) * 1000) / 10,
        unit: "%",
        target: 100,
        compare: "lte",
        targetLabel: "Target ≤ 100%",
      },
    ],
    weeks,
    faultTypes,
    offenders,
    costs: [
      { label: "Parts", valueMmk: partsCost },
      { label: "Labour", valueMmk: laborCost },
      { label: "Contractors", valueMmk: contractorCost },
      { label: "Total", valueMmk: total, isTotal: true },
    ],
    budgetMmk,
    spentMmk: total,
    notes: `${scope} — ${report.period}. Figures are drawn from resolved and in-progress maintenance requests plus scheduled contractor visits recorded in the Log Book for the period. Costs are estimated from parts, labour and contractor invoices on file; treat as indicative until finance reconciles the month.`,
  };
}
