// ============================================================================
// Core domain types — Smart Building Monitoring System (CET333)
//
// Reflects decisions confirmed across planning sessions (client meeting +
// design discussion), not just the assignment brief's bare feature list:
//   - 3 roles (incl. CEO/Super Admin, a scope addition beyond the brief)
//   - Equipment uses a uniform count-breakdown model (no per-type special-casing)
//   - Equipment & Sensor types are data-driven registries, not hardcoded unions
//   - Fire Sensor (equipment) and Fire Alarm (sensor) are one physical device,
//     linked via equipmentId, not merged into a single record
// ============================================================================

// ---- Users & Roles --------------------------------------------------------

export type UserRole = "office-staff" | "admin-manager" | "ceo-super-admin";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  /** Office Staff are scoped to one building. Admin Manager & CEO see all. */
  buildingId?: string;
}

// ---- Buildings & Rooms -----------------------------------------------------

// Confirmed scope: Building 216, Building 209, Junction Square.
// Room numbers for 209 and Junction Square are still pending tutor
// confirmation — only 216's are locked in (202, 301, 302, 303, ...).
export interface Building {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  buildingId: string;
  roomNumber: string;
}

// ---- Equipment (type registry + count-breakdown model) --------------------

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

// ---- Environmental Sensors (type registry with per-type states/actions) ---

// Each sensor type defines its OWN valid statuses and manageable actions,
// since a fire alarm and a door lock don't behave alike. The UI renders
// whatever a given type's definition says — it doesn't need to know in
// advance what any specific type looks like.
export interface SensorAction {
  id: string; // e.g. "reset", "lock", "unlock"
  label: string; // e.g. "Reset"
  resultStatus: string; // status this action transitions the sensor to
  requiresNote?: boolean; // e.g. fire alarm reset requires a reason
  allowedRoles: UserRole[];
}

export interface SensorTypeDef {
  id: string; // e.g. "fire-alarm", "door-lock"
  label: string;
  statuses: string[]; // this type's own valid states
  actions: SensorAction[];
}

// Confirmed registry entries so far (more may be added later without
// changing this shape):
//   fire-alarm  -> statuses: Normal / Triggered / Offline
//                  actions: Reset (requiresNote, admin-manager + ceo-super-admin)
//   door-lock   -> statuses: Locked / Unlocked / Forced Open / Offline
//                  actions: Lock, Unlock (roles TBC)

export interface EnvironmentalSensor {
  id: string;
  buildingId: string;
  roomId: string;
  typeId: string; // references SensorTypeDef.id
  status: string; // must be one of typeId's SensorTypeDef.statuses
  /**
   * Set when this sensor is the "live status" half of a physically unified
   * device — e.g. the Fire Alarm sensor record links back to its Fire
   * Sensor equipment record. Two records, one physical device.
   */
  linkedEquipmentId?: string;
  updatedAt: string;
}

// ---- Maintenance Requests ---------------------------------------------------

export type RequestPriority = "normal" | "high";

// Confirmed workflow: Office Staff submits -> Admin Manager/CEO notified ->
// action the request -> Office Staff sees status (read-only).
export type RequestStatus =
  "pending" | "in-progress" | "resolved" | "completed";

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
  // NOTE: "escalated" (high-priority + aging past threshold) is computed
  // client-side from submittedAt/priority/status — not stored, so the
  // threshold can change without a data migration.
}

// Historical Records = a filtered view of MaintenanceRequest (status in
// resolved/completed), not a separate collection. Filter by month/building,
// export the filtered set to CSV/PDF.

// ---- Log Book (audit trail) -------------------------------------------------

// Scoped to Admin Manager & CEO only — Office Staff already have their own
// request history via Historical Records.
export type LogActionType =
  | "equipment-status-changed"
  | "request-created"
  | "request-status-changed"
  | "sensor-status-changed"
  | "building-added"
  | "building-edited"
  | "user-added"
  | "user-role-changed";

export interface LogBookEntry {
  id: string;
  timestamp: string; // ISO timestamp
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  actionType: LogActionType;
  targetType: "building" | "room" | "equipment" | "sensor" | "request" | "user";
  targetId: string;
  buildingId?: string; // for filtering; absent for user/building-level actions
  before?: string; // human-readable "before" value, where relevant
  after?: string; // human-readable "after" value, where relevant
}
