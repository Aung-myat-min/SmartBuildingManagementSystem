// Core domain types — Smart Building Monitoring System (CET333)
//
// Two decisions the rest of the code leans on: equipment and sensor types are
// data-driven registries, not hardcoded unions; and a fire detector is one
// device with two records, linked by id rather than merged.

// Display tones

// The five status colours the whole UI is painted from. Defined here rather
// than in the badge component so data modules (registries, mock data) can
// carry a tone without importing React.
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Users & Roles

export type UserRole = "office-staff" | "admin-manager" | "ceo-super-admin";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  /** Office Staff are scoped to one building. Admin Manager & CEO see all. */
  buildingId?: string;
  /**
   * A contact number, theirs to set from Settings. Optional because the three
   * seeded accounts were provisioned without one and a facilities contact is
   * not something an administrator should invent on someone's behalf.
   */
  phone?: string;
  /**
   * The mock corpus's id for this person, e.g. "u-hnin". Seeded records carry
   * it in `submittedBy` and `actorUid`, and a real Firebase uid never matches
   * one — without this join, no seeded request would be withdrawable or
   * verifiable by whoever raised it. Only the ownership predicates read it,
   * and it goes when the data migrates.
   */
  legacyUid?: string;
}

// Administration > User Accounts. Superset of AppUser with the fields the
// account-management table needs. "Is this me?" is a comparison against the
// signed-in uid, never a stored flag — an estate always needs at least one
// Super Admin, and the account doing the editing is the one that must not be
// able to demote or suspend itself.
export interface ManagedUser extends AppUser {
  status: "active" | "suspended";
  lastActiveAt: string; // ISO timestamp
}

// Buildings & Rooms

// Confirmed scope: Building 216, Building 209, Junction Square.
// Room numbers for 209 and Junction Square are still pending tutor
// confirmation — only 216's are locked in (202, 301, 302, 303, ...).
export interface Building {
  id: string;
  name: string;
  /** Site code shown beside the name, e.g. "SITE 216". */
  code: string;
}

export type RoomType = "lecture" | "lab" | "office" | "plant" | "common";

export interface Room {
  id: string;
  buildingId: string;
  roomNumber: string;
  type: RoomType;
  floor: string; // e.g. "G", "1", "2" — not numeric-only, ground floors vary
}

// Equipment (type registry + count-breakdown model)

// Data-driven registry, NOT a hardcoded string union. Adding a new equipment
// type later (e.g. "whiteboard") means adding a row here, not touching code.
export interface EquipmentTypeDef {
  id: string; // e.g. "projector"
  label: string; // e.g. "Projector"
}

// Applied uniformly to every equipment type, even ones usually singular
// (e.g. one Projector per room) — same shape everywhere, no branching.
// Invariant: running + faulty + underMaintenance === quantity
export interface Equipment {
  id: string;
  buildingId: string;
  roomId: string;
  typeId: string; // references EquipmentTypeDef.id
  quantity: number;
  running: number;
  faulty: number;
  underMaintenance: number;
  updatedAt: string; // ISO timestamp
}

// Register/Board views need a single asset-level condition, distinct from
// the room-level running/faulty/underMaintenance count breakdown above.
// "decommissioned" units are hidden from the register by default.
export type EquipmentCondition =
  | "healthy"
  | "faulty"
  | "under-maintenance"
  | "decommissioned";

// One physical, taggable unit — what the Equipment register/board and its
// side drawer (history + actions) actually operate on.
export interface EquipmentUnit {
  id: string;
  tag: string; // e.g. "EQ-216-01"
  buildingId: string;
  roomId: string;
  typeId: string;
  condition: EquipmentCondition;
  installedAt: string; // ISO date
  nextServiceDue: string; // ISO date
  lastServiceAt?: string; // ISO date
  /**
   * How far `nextServiceDue` moves when a service is recorded. Both equipment
   * forms have always collected it; without it recording a service would have
   * to guess how far ahead to schedule the next one.
   */
  serviceIntervalDays?: number;
}

export type EquipmentHistoryEventType =
  | "installed"
  | "service"
  | "moved"
  | "fault-reported"
  | "returned-to-service"
  | "decommissioned";

export interface EquipmentHistoryEvent {
  id: string;
  equipmentUnitId: string;
  type: EquipmentHistoryEventType;
  at: string; // ISO timestamp
  summary: string;
  actorName: string;
}

// Environmental Sensors (type registry with per-type states/actions)

// Each sensor type defines its OWN valid statuses and manageable actions,
// since a fire alarm and a door lock don't behave alike. The UI renders
// whatever a given type's definition says — it doesn't need to know in
// advance what any specific type looks like.

/**
 * One state a sensor type can sit in. `id` is the stable key stored on
 * EnvironmentalSensor.status and never changes once created; `label` is the
 * display string and is always editable. `isAlarm` is what raises the alarm
 * count and breaks the row rhythm on the sensors page — it is a property of
 * the status, not a hardcoded list of status ids. `pulse` adds the live dot.
 */
export interface SensorStatusDef {
  id: string; // e.g. "triggered" — referenced by EnvironmentalSensor.status
  label: string; // e.g. "Triggered"
  tone: Tone;
  isAlarm: boolean;
  pulse?: boolean;
  /**
   * A state that is fine briefly and a problem if it persists — a door held
   * unlocked, say. After this many minutes in the status the row switches to
   * `escalateTone`. Set both or neither; without them the tone never moves.
   * The threshold lives on the status rather than in derive.ts so it stays
   * editable from Administration.
   */
  escalateAfterMinutes?: number;
  escalateTone?: Tone;
}

export interface SensorAction {
  id: string; // e.g. "reset", "lock", "unlock"
  label: string; // e.g. "Reset"
  caption: string; // what the action does, shown under the label in the drawer
  resultStatus: string; // SensorStatusDef.id this action transitions the sensor to
  requiresNote?: boolean; // e.g. fire alarm reset requires a reason
  /** Which roles may run this action. Enforced per action, not per page. */
  allowedRoles: UserRole[];
}

export interface SensorTypeDef {
  id: string; // slug, generated from the label at creation and immutable after
  label: string;
  /** Key into the fixed icon allowlist — a string, never a component. */
  icon: SensorIconKey;
  statuses: SensorStatusDef[]; // this type's own valid states, never empty
  actions: SensorAction[];
  /** Retired types stay in the registry so existing records still resolve. */
  archived?: boolean;
}

/**
 * The icons a sensor type may choose from. A fixed allowlist rather than a
 * free string, so a registry entry stays plain data — the key-to-component
 * map lives in lib/icons.ts.
 */
export type SensorIconKey =
  | "flame"
  | "lock"
  | "door"
  | "thermometer"
  | "droplet"
  | "wind"
  | "zap"
  | "activity";

// Seeded registry entries (more can be added at runtime from Administration
// without changing this shape):
//   fire-alarm  -> Normal / Triggered (alarm) / Offline
//                  actions: Reset (requiresNote, admin-manager + ceo-super-admin)
//   door-lock   -> Locked / Unlocked (amber after 30m) / Forced open (alarm) / Offline
//                  actions: Lock, Unlock (admin-manager + ceo-super-admin)

export interface EnvironmentalSensor {
  id: string;
  buildingId: string;
  roomId: string;
  typeId: string; // references SensorTypeDef.id
  status: string; // must be a SensorStatusDef.id on typeId's SensorTypeDef
  /**
   * Set when this sensor is the "live status" half of a physically unified
   * device — e.g. the Fire Alarm sensor record links back to its Fire
   * Sensor equipment record. Two records, one physical device.
   */
  linkedEquipmentId?: string;
  /**
   * When the sensor entered its current status, as distinct from when it last
   * reported. A status whose tone changes with age is measured from this — an
   * unlocked door is blue for thirty minutes and amber after — so a routine
   * report must not restart the clock. Absent on a device that has never
   * changed status, where `updatedAt` is the best answer there is.
   */
  statusChangedAt?: string;
  updatedAt: string;
}

// Maintenance Requests

export type RequestPriority = "normal" | "high";

//   requested -> approved -> in-progress -> resolved -> completed
//
// Approval is the gate that keeps unreviewed work off the board; staff raise
// and follow, they never move a request themselves. "requested" is not yet
// work — everything from "approved" on is committed, with someone accountable.
export type RequestStatus =
  | "requested"
  | "approved"
  | "in-progress"
  | "resolved"
  | "completed";

export interface MaintenanceRequest {
  id: string;
  buildingId: string;
  roomId: string;
  equipmentId: string;
  issue: string;
  priority: RequestPriority;
  status: RequestStatus;
  submittedBy: string; // uid of Office Staff
  submittedByName: string;
  submittedAt: string; // ISO timestamp
  updatedAt: string;
  notes?: string; // resolution notes from Admin Manager/CEO
  /**
   * Why an approver sent this back. The status does not move — the request
   * stays "requested" and the note tells its submitter what to fix, so they
   * can withdraw it and raise a corrected one. Cleared once it is approved.
   */
  declineNote?: string;
  /**
   * The submitter has looked at the resolved work and says it is done. It is
   * a flag, not a status: an approver still presses Close out. Requests with
   * no Office Staff behind them never carry it.
   */
  verificationRequested?: boolean;
  /**
   * Pulled back by its own submitter before approval. Withdrawn requests drop
   * out of every list and count rather than sitting on the board.
   */
  withdrawn?: boolean;
  /**
   * What the work cost, recorded when it is marked resolved.
   *
   * Three states, and the difference matters: absent means nobody was asked
   * (every request resolved before this existed), `0` means asked and there
   * was no cost, above zero is the amount. An average over the absent ones
   * would be invented; an average over the zeroes is real.
   */
  costMmk?: number;
  // NOTE: "escalated" (high-priority + aging past threshold) is computed
  // client-side from submittedAt/priority/status — not stored, so the
  // threshold can change without a data migration.
}

// Historical Records (long-range ledger)

// Log Book (system-written live audit trail)

// Scoped to Admin Manager & CEO only — Office Staff already have their own
// request history via Historical Records. Distinct from Historical Records:
// Log Book is the live, short-range feed (today/this shift) that picks up
// actions taken elsewhere in the app as they happen; Historical Records is
// the same kind of event, held long-range. Entries here are always written
// by the system, never composed by hand.
export type LogActionType =
  | "equipment-status-changed"
  | "request-created"
  | "request-status-changed"
  | "request-declined"
  | "request-withdrawn"
  | "request-verification-requested"
  | "sensor-status-changed"
  | "sensor-type-added"
  | "sensor-type-edited"
  | "sensor-type-archived"
  | "building-added"
  | "building-edited"
  | "building-deleted"
  | "room-added"
  | "room-edited"
  | "room-removed"
  | "user-added"
  | "user-edited"
  | "user-role-changed"
  | "user-status-changed"
  | "report-generated"
  | "password-changed";

export type LogBookSource =
  | "alert"
  | "sensor"
  | "request"
  | "equipment"
  | "access"
  | "admin";

export interface LogBookEntry {
  id: string;
  timestamp: string; // ISO timestamp
  actorUid?: string;
  actorName: string; // "Sensor network" / "System · schedule" for automated entries
  actorRole?: UserRole;
  source: LogBookSource;
  actionType: LogActionType;
  title: string;
  detail: string;
  targetType:
    | "building"
    | "room"
    | "equipment"
    | "sensor"
    | "request"
    | "user"
    | "report";
  targetId: string;
  buildingId?: string; // for filtering; absent for user/building-level actions
  refId?: string; // linked REQ-/EQ-/device id, where relevant
}

// Reports

export type ReportKind =
  | "maintenance-performance"
  | "equipment-reliability"
  | "cost-of-maintenance";

export type ReportStatus = "ready" | "scheduled" | "archived";

export interface Report {
  id: string;
  kind: ReportKind;
  period: string; // e.g. "August 2026" or "01–08 Sep 2026"
  buildingId?: string; // absent = whole estate
  generatedAt: string; // ISO timestamp
  generatedBy: string; // "System · schedule" or a person's name
  status: ReportStatus;
}

// Pass/fail is computed from value against target (see derive.kpiPasses), not
// stored — so a target can move without rewriting every generated report.
export interface ReportKpi {
  label: string;
  value: number;
  unit: string;
  target: number;
  compare: "gte" | "lte" | "lt";
  targetLabel: string; // e.g. "Target ≥ 90%"
}

export interface ReportWeek {
  label: string;
  resolved: number;
  carriedOver: number;
}

export interface ReportFaultType {
  typeLabel: string;
  count: number;
}

export interface ReportOffender {
  tag: string;
  unitLabel: string;
  faults: number;
  downtimeHours: number;
  costMmk: number;
}

export interface ReportCostLine {
  label: string;
  valueMmk: number;
  isTotal?: boolean;
}

export interface ReportDetail extends Report {
  kpis: ReportKpi[];
  weeks: ReportWeek[];
  faultTypes: ReportFaultType[];
  offenders: ReportOffender[];
  costs: ReportCostLine[];
  budgetMmk: number;
  spentMmk: number;
  notes: string;
}
