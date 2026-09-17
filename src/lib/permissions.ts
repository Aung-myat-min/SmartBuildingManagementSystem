import type { UserRole } from "./types";

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

// ---- Administration --------------------------------------------------------
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
