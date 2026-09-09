import type { UserRole } from "./types";

// Lower rank = more privileged. Mirrors the design's own rank scheme
// (ceo=1, admin-manager=2, office-staff=3) so "roles:N" gates read as
// "visible to rank <= N".
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

export function canActOnSensor(role: UserRole): boolean {
  return canAct(role);
}

// Equipment is the one place Office Staff acts on assets — everything
// except decommissioning them.
export function canDecommissionEquipment(role: UserRole): boolean {
  return canAct(role);
}

export function canAccessReports(role: UserRole): boolean {
  return canAct(role);
}

export function canAccessLogBook(role: UserRole): boolean {
  return canAct(role);
}

// Administration locks for everyone below CEO — Admin Manager included.
export function canAccessAdministration(role: UserRole): boolean {
  return role === "ceo-super-admin";
}

export function isBuildingLocked(role: UserRole): boolean {
  return role === "office-staff";
}
