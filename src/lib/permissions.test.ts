import { describe, expect, it } from "vitest";
import {
  canEditUser,
  canManageAccounts,
  canManageEstate,
  canManageSensorTypes,
  canRequestVerification,
  canWithdrawRequest,
  isActor,
  isBuildingLocked,
  roleRank,
} from "./permissions";
import type { MaintenanceRequest, UserRole } from "./types";

const CEO: UserRole = "ceo-super-admin";
const ADMIN: UserRole = "admin-manager";
const STAFF: UserRole = "office-staff";

describe("the role ladder", () => {
  it("ranks the CEO above the Admin Manager above Office Staff", () => {
    expect(roleRank(CEO)).toBeLessThan(roleRank(ADMIN));
    expect(roleRank(ADMIN)).toBeLessThan(roleRank(STAFF));
  });

  it("keeps the estate with the CEO alone", () => {
    expect(canManageEstate(CEO)).toBe(true);
    expect(canManageEstate(ADMIN)).toBe(false);
  });

  it("shares accounts and sensor types down to the Admin Manager", () => {
    for (const can of [canManageAccounts, canManageSensorTypes]) {
      expect(can(CEO)).toBe(true);
      expect(can(ADMIN)).toBe(true);
      expect(can(STAFF)).toBe(false);
    }
  });

  it("scopes only Office Staff to one building", () => {
    expect(isBuildingLocked(STAFF)).toBe(true);
    expect(isBuildingLocked(ADMIN)).toBe(false);
  });
});

describe("canEditUser", () => {
  it("never lets an account edit itself, whatever its role", () => {
    expect(canEditUser(CEO, CEO, true)).toBe(false);
    expect(canEditUser(ADMIN, ADMIN, true)).toBe(false);
  });

  it("lets the CEO edit anyone else", () => {
    expect(canEditUser(CEO, ADMIN)).toBe(true);
    expect(canEditUser(CEO, STAFF)).toBe(true);
  });

  it("limits an Admin Manager to Office Staff rows", () => {
    expect(canEditUser(ADMIN, STAFF)).toBe(true);
    expect(canEditUser(ADMIN, ADMIN)).toBe(false);
    expect(canEditUser(ADMIN, CEO)).toBe(false);
  });

  it("gives Office Staff no account management at all", () => {
    expect(canEditUser(STAFF, STAFF)).toBe(false);
  });
});

describe("isActor", () => {
  // Seeded records were written against the mock corpus's ids, so a real
  // account has to match either. Without this the whole withdraw and
  // close-out path silently disappears for every seeded request.
  const user = { uid: "rQKXzUU7NtMSLz0kOoJVlCcCzfV2", legacyUid: "u-hnin" };

  it("matches the real Firebase uid", () => {
    expect(isActor(user, "rQKXzUU7NtMSLz0kOoJVlCcCzfV2")).toBe(true);
  });

  it("matches the legacy id the seed data carries", () => {
    expect(isActor(user, "u-hnin")).toBe(true);
  });

  it("does not match somebody else", () => {
    expect(isActor(user, "u-zaw")).toBe(false);
  });

  it("does not match on a missing legacy id", () => {
    expect(isActor({ uid: "abc" }, "u-hnin")).toBe(false);
    expect(isActor({ uid: "abc", legacyUid: undefined }, "")).toBe(false);
  });
});

const request = (over: Partial<MaintenanceRequest> = {}): MaintenanceRequest =>
  ({
    id: "REQ-1",
    buildingId: "b216",
    roomId: "r-216-302",
    equipmentId: "EQ-216-01",
    issue: "x",
    priority: "normal",
    status: "requested",
    submittedBy: "u-hnin",
    submittedByName: "Hnin Nwe",
    submittedAt: "2026-09-09T08:00:00Z",
    updatedAt: "2026-09-09T08:00:00Z",
    ...over,
  }) as MaintenanceRequest;

describe("request ownership", () => {
  const me = { uid: "real-uid", legacyUid: "u-hnin" };
  const someoneElse = { uid: "other-uid", legacyUid: "u-zaw" };

  it("lets the submitter withdraw their own unapproved request", () => {
    expect(canWithdrawRequest(request(), "requested", me)).toBe(true);
  });

  it("stops anyone else withdrawing it", () => {
    expect(canWithdrawRequest(request(), "requested", someoneElse)).toBe(false);
  });

  it("stops the submitter once it has been approved", () => {
    for (const status of [
      "approved",
      "in-progress",
      "resolved",
      "completed",
    ] as const) {
      expect(canWithdrawRequest(request(), status, me)).toBe(false);
    }
  });

  it("offers verification only on resolved work, to its submitter", () => {
    expect(canRequestVerification(request(), "resolved", me)).toBe(true);
    expect(canRequestVerification(request(), "in-progress", me)).toBe(false);
    expect(canRequestVerification(request(), "resolved", someoneElse)).toBe(
      false,
    );
  });

  it("does not offer verification twice", () => {
    const flagged = request({ verificationRequested: true });
    expect(canRequestVerification(flagged, "resolved", me)).toBe(false);
  });
});
