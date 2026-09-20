import type {
  AppUser,
  MaintenanceRequest,
  RequestStatus,
  UserRole,
} from "./types";

// Lower rank = more privileged. Gate on rank, never on role equality, so a
// new role slots into the ladder without rewriting every check:
// visible when rank is at or below the item's minimum.
export function roleRank(role: UserRole): 1 | 2 | 3 {
  if (role === "ceo-super-admin") return 1;
  if (role === "admin-manager") return 2;
  return 3;
}

export const roleLabel: Record<UserRole, string> = {
  "office-staff": "Office Staff",
  "admin-manager": "Admin Manager",
  "ceo-super-admin": "CEO / Super Admin",
};

// Office Staff submits and watches; Admin Manager/CEO act on the estate.
export function canAct(role: UserRole): boolean {
  return role !== "office-staff";
}

export function canAdvanceRequest(role: UserRole): boolean {
  return canAct(role);
}

// Approving is the same gate as advancing: whoever moves a request along the
// board is who decides it belongs there in the first place.
export function canApproveRequest(role: UserRole): boolean {
  return canAdvanceRequest(role);
}

/**
 * Whether a stored uid refers to the signed-in person. Seeded records were
 * written against the mock corpus's ids, so a real account matches either its
 * own Firebase uid or the legacy one it carries.
 */
export function isActor(
  user: Pick<AppUser, "uid" | "legacyUid">,
  uid: string,
): boolean {
  return (
    uid === user.uid || (user.legacyUid !== undefined && uid === user.legacyUid)
  );
}

/**
 * A request is its submitter's only up to the moment it is approved. After
 * that it is committed work and they can no longer pull it back.
 */
export function canWithdrawRequest(
  request: Pick<MaintenanceRequest, "submittedBy">,
  status: RequestStatus,
  actor: Pick<AppUser, "uid" | "legacyUid">,
): boolean {
  return status === "requested" && isActor(actor, request.submittedBy);
}

/**
 * The submitter is the one who can say resolved work actually looks done.
 * It asks for a close-out; it does not perform one. Requests raised by an
 * admin have no Office Staff behind them, so nobody is asked.
 */
export function canRequestVerification(
  request: Pick<MaintenanceRequest, "submittedBy" | "verificationRequested">,
  status: RequestStatus,
  actor: Pick<AppUser, "uid" | "legacyUid">,
): boolean {
  return (
    status === "resolved" &&
    isActor(actor, request.submittedBy) &&
    !request.verificationRequested
  );
}

export const REQUEST_ADVANCE_LOCK_REASON =
  "Office Staff raise requests and follow them — moving one along is the Admin Manager's or CEO's.";

// Sensors are read-only for Office Staff: they see every state, but every
// action carries a padlock and the reason sits in its tooltip.
export function canActOnSensor(role: UserRole): boolean {
  return canAct(role);
}

export const SENSOR_LOCK_REASON =
  "Sensors are read-only for Office Staff — raise a maintenance request instead.";

// Equipment is the one place Office Staff act on assets: raise requests, mark
// faulty, take a unit under maintenance, record a service and move it.
// Only decommission is closed to them.
export function canDecommissionEquipment(role: UserRole): boolean {
  return canAct(role);
}

export const DECOMMISSION_LOCK_REASON =
  "Decommissioning is limited to Admin Managers and the CEO.";

export function canAccessReports(role: UserRole): boolean {
  return canAct(role);
}

export function canAccessLogBook(role: UserRole): boolean {
  return canAct(role);
}

// Administration
//
// One page, two tabs, two different gates. The estate is the CEO's; accounts
// are shared with the Admin Manager, who lands on User Accounts with the
// Buildings tab padlocked.

export function canAccessAdministration(role: UserRole): boolean {
  return canManageEstate(role) || canManageAccounts(role);
}

export function canManageEstate(role: UserRole): boolean {
  return role === "ceo-super-admin";
}

export function canManageAccounts(role: UserRole): boolean {
  return roleRank(role) <= 2;
}

export const ESTATE_LOCK_REASON =
  "Buildings and rooms are managed by the CEO / Super Admin.";

// The sensor type registry is shared with the Admin Manager rather than kept
// with the estate: a new kind of device arriving on the network is the thing
// they deal with day to day, and it changes no buildings or accounts.
export function canManageSensorTypes(role: UserRole): boolean {
  return roleRank(role) <= 2;
}

// The equipment type registry sits with the sensor one: both are "what kinds
// of thing exist on this estate", and neither changes a building or an account.
export function canManageEquipmentTypes(role: UserRole): boolean {
  return roleRank(role) <= 2;
}

export const EQUIPMENT_TYPE_LOCK_REASON =
  "Equipment types are managed by Admin Managers and the CEO / Super Admin.";

export const SENSOR_TYPE_LOCK_REASON =
  "Sensor types are managed by Admin Managers and the CEO / Super Admin.";

/** An Admin Manager may only edit Office Staff rows; the CEO may edit anyone but itself. */
export function canEditUser(
  actor: UserRole,
  target: UserRole,
  isSelf = false,
): boolean {
  if (isSelf) return false;
  if (actor === "ceo-super-admin") return true;
  if (actor === "admin-manager") return target === "office-staff";
  return false;
}

export function userEditLockReason(actor: UserRole, target: UserRole): string {
  if (actor === "admin-manager") {
    return `Admin Managers can edit Office Staff accounts only — this one is ${roleLabel[target]}.`;
  }
  return "Account management is limited to Admin Managers and the CEO.";
}

// Office Staff are scoped to one building everywhere. The building filter is
// disabled rather than absent, so the scope is visible rather than hidden.
export function isBuildingLocked(role: UserRole): boolean {
  return role === "office-staff";
}
