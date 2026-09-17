"use client";

import * as React from "react";
import { countOpenRequests } from "@/lib/derive";
import {
  CURRENT_USERS,
  LIVE_ALARM_SENSOR_ID,
  MAINTENANCE_REQUESTS,
  REQUEST_NEXT_STATUS,
  REQUEST_PREV_STATUS,
  SENSOR_TYPES,
  SENSORS,
  setSensorRegistrySource,
} from "@/lib/mock-data";
import type {
  AppUser,
  EquipmentCondition,
  MaintenanceRequest,
  SensorAction,
  SensorStatusDef,
  SensorTypeDef,
  UserRole,
} from "@/lib/types";

/**
 * Every registry mutation answers the same way, because each one can be
 * refused for a reason the form has to show — a type still carrying sensors,
 * a status something is sitting in, an action pointing at nothing.
 */
export type RegistryResult = { ok: true } | { ok: false; error: string };

const OK: RegistryResult = { ok: true };

function fail(error: string): RegistryResult {
  return { ok: false, error };
}

/**
 * Ids are generated from the label once and then frozen, so a rename never
 * orphans the sensor records pointing at them. Uniqueness is settled here
 * rather than left to the caller.
 */
export function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** The rules a type must satisfy whichever door it came through. */
function validateType(type: SensorTypeDef): RegistryResult {
  if (type.label.trim().length === 0) {
    return fail("A sensor type needs a name.");
  }
  if (type.statuses.length === 0) {
    return fail("A sensor type needs at least one status.");
  }
  const ids = type.statuses.map((st) => st.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) {
    return fail(`Two statuses share the id "${duplicate}".`);
  }
  const empty = type.statuses.find((st) => st.label.trim().length === 0);
  if (empty) return fail("Every status needs a name.");
  const orphan = type.actions.find((a) => !ids.includes(a.resultStatus));
  if (orphan) {
    return fail(
      `"${orphan.label}" results in a status this type does not have.`,
    );
  }
  const actionless = type.actions.find((a) => a.label.trim().length === 0);
  if (actionless) return fail("Every action needs a name.");
  return OK;
}

export interface Notification {
  id: string;
  tone: "danger" | "warning" | "info" | "neutral";
  title: string;
  detail: string;
  time: string;
  read: boolean;
  pulse?: boolean;
}

const BASE_NOTIFICATIONS: Notification[] = [
  {
    id: "n-req-4192",
    tone: "warning",
    title: "High-priority request opened",
    detail: "216 / Room 302 — projector won't power on.",
    time: "13m",
    read: false,
  },
  {
    id: "n-req-4181",
    tone: "warning",
    title: "Request aging past 24h",
    detail: "Junction Sq / L2-14 — card reader fault, still pending.",
    time: "1h",
    read: false,
  },
  {
    id: "n-eq-216-08",
    tone: "neutral",
    title: "Equipment marked faulty",
    detail: "216 / Roof plant room — air handling unit.",
    time: "3h",
    read: true,
  },
];

export interface AppState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentUser: AppUser;
  activeBuildingId: string;
  setActiveBuildingId: (id: string) => void;
  elapsed: number;
  resetDemo: () => void;
  alarmActive: boolean;
  alarmSeconds: number;
  liveAlarmSensorId: string;
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // In-memory demo mutations — reset on reload/restart, shared across pages
  // so an action taken on one screen (e.g. Requests) is reflected wherever
  // else that record shows up (e.g. the Dashboard's mini list).

  /** Every request with this session's moves applied. The one list to read. */
  requests: MaintenanceRequest[];
  /** The same list narrowed to what the signed-in role may see. */
  scopedRequests: MaintenanceRequest[];
  /**
   * The open-request count. The sidebar badge, the toolbar chip, the building
   * cards and the dashboard tiles all read this, so they cannot disagree.
   */
  openRequestCount: number;
  addRequest: (request: MaintenanceRequest) => void;
  requestStatus: (req: MaintenanceRequest) => MaintenanceRequest["status"];
  /** Forward one step, or back one step — never more, and the age never resets. */
  moveRequest: (id: string, direction: "next" | "prev") => void;
  sensorStatus: (sensorId: string, fallback: string) => string;
  /**
   * When the sensor entered its current status — the override's own stamp
   * once it has been actioned here, the record's last report before that.
   * Statuses that change tone with age are measured from this, not updatedAt.
   */
  sensorChangedAt: (sensorId: string, fallback: string) => string;
  setSensorStatus: (sensorId: string, status: string) => void;
  /** The live sensor type registry, archived entries included. */
  sensorTypeRegistry: SensorTypeDef[];
  addSensorType: (
    draft: Omit<SensorTypeDef, "id">,
  ) => RegistryResult & { id?: string };
  /** Everything but the id, which is frozen at creation. */
  updateSensorType: (
    typeId: string,
    patch: Partial<Omit<SensorTypeDef, "id">>,
  ) => RegistryResult;
  archiveSensorType: (typeId: string) => RegistryResult;
  restoreSensorType: (typeId: string) => RegistryResult;
  addSensorStatus: (
    typeId: string,
    draft: Omit<SensorStatusDef, "id">,
  ) => RegistryResult;
  updateSensorStatus: (
    typeId: string,
    statusId: string,
    patch: Partial<Omit<SensorStatusDef, "id">>,
  ) => RegistryResult;
  removeSensorStatus: (typeId: string, statusId: string) => RegistryResult;
  addSensorAction: (
    typeId: string,
    draft: Omit<SensorAction, "id">,
  ) => RegistryResult;
  updateSensorAction: (
    typeId: string,
    actionId: string,
    patch: Partial<Omit<SensorAction, "id">>,
  ) => RegistryResult;
  removeSensorAction: (typeId: string, actionId: string) => RegistryResult;
  equipmentCondition: (
    unitId: string,
    fallback: EquipmentCondition,
  ) => EquipmentCondition;
  setEquipmentCondition: (
    unitId: string,
    condition: EquipmentCondition,
  ) => void;
}

const AppStateContext = React.createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<UserRole>("admin-manager");
  const [activeBuildingId, setActiveBuildingIdState] = React.useState("b216");
  const [elapsed, setElapsed] = React.useState(0);
  const [notifications, setNotifications] =
    React.useState<Notification[]>(BASE_NOTIFICATIONS);
  const [requestOverrides, setRequestOverrides] = React.useState<
    Record<string, MaintenanceRequest["status"]>
  >({});
  const [createdRequests, setCreatedRequests] = React.useState<
    MaintenanceRequest[]
  >([]);
  // An override carries the moment it was made, so a door unlocked here
  // starts its own clock rather than inheriting the record's last report.
  const [sensorOverrides, setSensorOverrides] = React.useState<
    Record<string, { status: string; at: string }>
  >({});
  const [equipmentOverrides, setEquipmentOverrides] = React.useState<
    Record<string, EquipmentCondition>
  >({});
  const [sensorTypeRegistry, setSensorTypeRegistry] =
    React.useState<SensorTypeDef[]>(SENSOR_TYPES);
  const alarmNotifAdded = React.useRef(false);

  // mock-data's sensorType/statusDef accessors read through this, so the page
  // sees an edit on the same render that made it. Assigning the current list
  // is idempotent, which is why it can sit in the render body.
  setSensorRegistrySource(sensorTypeRegistry);

  React.useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const alarmActive = elapsed >= 20;

  React.useEffect(() => {
    if (alarmActive && !alarmNotifAdded.current) {
      alarmNotifAdded.current = true;
      setNotifications((prev) => [
        {
          id: `n-alarm-${Date.now()}`,
          tone: "danger",
          title: "Fire alarm triggered",
          detail: "Building 216 / Room 302 detector — FD-216-14.",
          time: "now",
          read: false,
          pulse: true,
        },
        ...prev,
      ]);
    }
    if (!alarmActive) {
      alarmNotifAdded.current = false;
    }
  }, [alarmActive]);

  const setRole = React.useCallback((next: UserRole) => {
    setRoleState(next);
    if (next === "office-staff") {
      setActiveBuildingIdState(
        CURRENT_USERS["office-staff"].buildingId ?? "b216",
      );
    }
  }, []);

  const setActiveBuildingId = React.useCallback(
    (id: string) => {
      if (role === "office-staff") return;
      setActiveBuildingIdState(id);
    },
    [role],
  );

  const resetDemo = React.useCallback(() => {
    setElapsed(0);
    alarmNotifAdded.current = false;
    setNotifications(BASE_NOTIFICATIONS);
    setRequestOverrides({});
    setCreatedRequests([]);
    setSensorOverrides({});
    setEquipmentOverrides({});
    setSensorTypeRegistry(SENSOR_TYPES);
  }, []);

  const markNotificationRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllNotificationsRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const requestStatus = React.useCallback(
    (req: MaintenanceRequest) => requestOverrides[req.id] ?? req.status,
    [requestOverrides],
  );

  const requests = React.useMemo(
    () =>
      [...createdRequests, ...MAINTENANCE_REQUESTS].map((r) => ({
        ...r,
        status: requestOverrides[r.id] ?? r.status,
      })),
    [createdRequests, requestOverrides],
  );

  const scopedRequests = React.useMemo(
    () =>
      role === "office-staff"
        ? requests.filter((r) => r.buildingId === activeBuildingId)
        : requests,
    [requests, role, activeBuildingId],
  );

  const openRequestCount = React.useMemo(
    () => countOpenRequests(scopedRequests),
    [scopedRequests],
  );

  const addRequest = React.useCallback((request: MaintenanceRequest) => {
    setCreatedRequests((prev) => [request, ...prev]);
  }, []);

  const moveRequest = React.useCallback(
    (id: string, direction: "next" | "prev") => {
      setRequestOverrides((prev) => {
        const base = [...createdRequests, ...MAINTENANCE_REQUESTS].find(
          (r) => r.id === id,
        );
        const current = prev[id] ?? base?.status ?? "pending";
        const table =
          direction === "next" ? REQUEST_NEXT_STATUS : REQUEST_PREV_STATUS;
        const target = table[current];
        if (!target) return prev;
        return { ...prev, [id]: target };
      });
    },
    [createdRequests],
  );

  const sensorStatus = React.useCallback(
    (sensorId: string, fallback: string) => {
      const override = sensorOverrides[sensorId];
      if (override) return override.status;
      // The scripted alarm trips one detector 20 seconds in. An override wins
      // over it, which is what makes resetting the alarm stick.
      if (alarmActive && sensorId === LIVE_ALARM_SENSOR_ID) return "triggered";
      return fallback;
    },
    [sensorOverrides, alarmActive],
  );

  const sensorChangedAt = React.useCallback(
    (sensorId: string, fallback: string) =>
      sensorOverrides[sensorId]?.at ?? fallback,
    [sensorOverrides],
  );

  const setSensorStatus = React.useCallback(
    (sensorId: string, status: string) => {
      setSensorOverrides((prev) => ({
        ...prev,
        [sensorId]: { status, at: new Date().toISOString() },
      }));
    },
    [],
  );

  // ---- Sensor type registry ------------------------------------------------
  //
  // Every guard below is about records that already point at what is being
  // changed. The registry is free to grow; it is not free to strand a sensor.

  /** Sensors currently sitting in a status, overrides counted. */
  const sensorsInStatus = React.useCallback(
    (typeId: string, statusId: string) =>
      SENSORS.filter(
        (s) =>
          s.typeId === typeId &&
          (sensorOverrides[s.id]?.status ?? s.status) === statusId,
      ).length,
    [sensorOverrides],
  );

  // Validation has to answer the caller now, not on the next render, so the
  // next list is built from the current one here rather than in an updater.
  const patchType = React.useCallback(
    (typeId: string, change: (type: SensorTypeDef) => SensorTypeDef) => {
      const current = sensorTypeRegistry.find((t) => t.id === typeId);
      if (!current) return fail("No sensor type with that id.");
      const next = change(current);
      const check = validateType(next);
      if (!check.ok) return check;
      setSensorTypeRegistry((prev) =>
        prev.map((t) => (t.id === typeId ? next : t)),
      );
      return OK;
    },
    [sensorTypeRegistry],
  );

  const addSensorType = React.useCallback(
    (draft: Omit<SensorTypeDef, "id">) => {
      const id = uniqueId(
        slugify(draft.label),
        sensorTypeRegistry.map((t) => t.id),
      );
      const next = { ...draft, id };
      const check = validateType(next);
      if (!check.ok) return check;
      setSensorTypeRegistry((prev) => [...prev, next]);
      return { ok: true as const, id };
    },
    [sensorTypeRegistry],
  );

  const updateSensorType = React.useCallback(
    (typeId: string, patch: Partial<Omit<SensorTypeDef, "id">>) =>
      patchType(typeId, (type) => ({ ...type, ...patch })),
    [patchType],
  );

  const archiveSensorType = React.useCallback(
    (typeId: string) => {
      const inUse = SENSORS.filter((s) => s.typeId === typeId).length;
      if (inUse > 0) {
        const type = sensorTypeRegistry.find((t) => t.id === typeId);
        return fail(
          `${inUse} sensor${inUse === 1 ? " is" : "s are"} registered as ${type?.label ?? typeId}. Move or remove ${inUse === 1 ? "it" : "them"} before archiving the type.`,
        );
      }
      return patchType(typeId, (type) => ({ ...type, archived: true }));
    },
    [patchType, sensorTypeRegistry],
  );

  const restoreSensorType = React.useCallback(
    (typeId: string) =>
      patchType(typeId, (type) => ({ ...type, archived: false })),
    [patchType],
  );

  const addSensorStatus = React.useCallback(
    (typeId: string, draft: Omit<SensorStatusDef, "id">) =>
      patchType(typeId, (type) => ({
        ...type,
        statuses: [
          ...type.statuses,
          {
            ...draft,
            id: uniqueId(
              slugify(draft.label),
              type.statuses.map((st) => st.id),
            ),
          },
        ],
      })),
    [patchType],
  );

  const updateSensorStatus = React.useCallback(
    (
      typeId: string,
      statusId: string,
      patch: Partial<Omit<SensorStatusDef, "id">>,
    ) =>
      patchType(typeId, (type) => ({
        ...type,
        statuses: type.statuses.map((st) =>
          st.id === statusId ? { ...st, ...patch } : st,
        ),
      })),
    [patchType],
  );

  const removeSensorStatus = React.useCallback(
    (typeId: string, statusId: string) => {
      const occupied = sensorsInStatus(typeId, statusId);
      if (occupied > 0) {
        const label =
          sensorTypeRegistry
            .find((t) => t.id === typeId)
            ?.statuses.find((st) => st.id === statusId)?.label ?? statusId;
        return fail(
          `${occupied} sensor${occupied === 1 ? " is" : "s are"} reporting ${label} right now. That status cannot be removed while anything sits in it.`,
        );
      }
      return patchType(typeId, (type) => ({
        ...type,
        statuses: type.statuses.filter((st) => st.id !== statusId),
      }));
    },
    [patchType, sensorsInStatus, sensorTypeRegistry],
  );

  const addSensorAction = React.useCallback(
    (typeId: string, draft: Omit<SensorAction, "id">) =>
      patchType(typeId, (type) => ({
        ...type,
        actions: [
          ...type.actions,
          {
            ...draft,
            id: uniqueId(
              slugify(draft.label),
              type.actions.map((a) => a.id),
            ),
          },
        ],
      })),
    [patchType],
  );

  const updateSensorAction = React.useCallback(
    (
      typeId: string,
      actionId: string,
      patch: Partial<Omit<SensorAction, "id">>,
    ) =>
      patchType(typeId, (type) => ({
        ...type,
        actions: type.actions.map((a) =>
          a.id === actionId ? { ...a, ...patch } : a,
        ),
      })),
    [patchType],
  );

  const removeSensorAction = React.useCallback(
    (typeId: string, actionId: string) =>
      patchType(typeId, (type) => ({
        ...type,
        actions: type.actions.filter((a) => a.id !== actionId),
      })),
    [patchType],
  );

  const equipmentCondition = React.useCallback(
    (unitId: string, fallback: EquipmentCondition) =>
      equipmentOverrides[unitId] ?? fallback,
    [equipmentOverrides],
  );

  const setEquipmentCondition = React.useCallback(
    (unitId: string, condition: EquipmentCondition) => {
      setEquipmentOverrides((prev) => ({ ...prev, [unitId]: condition }));
    },
    [],
  );

  const value = React.useMemo<AppState>(
    () => ({
      role,
      setRole,
      currentUser: {
        ...CURRENT_USERS[role],
        buildingId: role === "office-staff" ? activeBuildingId : undefined,
      },
      activeBuildingId,
      setActiveBuildingId,
      elapsed,
      resetDemo,
      alarmActive,
      alarmSeconds: Math.max(0, elapsed - 20),
      liveAlarmSensorId: LIVE_ALARM_SENSOR_ID,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markNotificationRead,
      markAllNotificationsRead,
      requests,
      scopedRequests,
      openRequestCount,
      addRequest,
      requestStatus,
      moveRequest,
      sensorStatus,
      sensorChangedAt,
      setSensorStatus,
      sensorTypeRegistry,
      addSensorType,
      updateSensorType,
      archiveSensorType,
      restoreSensorType,
      addSensorStatus,
      updateSensorStatus,
      removeSensorStatus,
      addSensorAction,
      updateSensorAction,
      removeSensorAction,
      equipmentCondition,
      setEquipmentCondition,
    }),
    [
      role,
      setRole,
      activeBuildingId,
      setActiveBuildingId,
      elapsed,
      resetDemo,
      alarmActive,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      requests,
      scopedRequests,
      openRequestCount,
      addRequest,
      requestStatus,
      moveRequest,
      sensorStatus,
      sensorChangedAt,
      setSensorStatus,
      sensorTypeRegistry,
      addSensorType,
      updateSensorType,
      archiveSensorType,
      restoreSensorType,
      addSensorStatus,
      updateSensorStatus,
      removeSensorStatus,
      addSensorAction,
      updateSensorAction,
      removeSensorAction,
      equipmentCondition,
      setEquipmentCondition,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
