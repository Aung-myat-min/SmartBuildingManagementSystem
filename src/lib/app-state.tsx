"use client";

import * as React from "react";
import { countOpenRequests } from "@/lib/derive";
import {
  BUILDINGS,
  buildingName,
  EQUIPMENT_UNITS,
  equipmentUnitLabel,
  LOG_BOOK,
  MAINTENANCE_REQUESTS,
  REQUEST_NEXT_STATUS,
  REQUEST_PREV_STATUS,
  ROOMS,
  roomLabel,
  SENSOR_TYPES,
  SENSORS,
  sensorType,
  setEstateSource,
  setSensorRegistrySource,
} from "@/lib/mock-data";
import type {
  AppUser,
  Building,
  EnvironmentalSensor,
  EquipmentCondition,
  LogBookEntry,
  MaintenanceRequest,
  Room,
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

/**
 * What a caller supplies when something happens. Who did it, when, and the
 * entry's id are the book's business, not the caller's — every action in the
 * app goes through here so no screen can write a half-formed entry, or
 * forget to write one at all.
 */
export type LogDraft = Omit<
  LogBookEntry,
  "id" | "timestamp" | "actorUid" | "actorName" | "actorRole"
> & {
  /** For the entries the system writes for itself, e.g. the scripted alarm. */
  actorName?: string;
};

/** What an in-session action can change about a request. */
interface RequestPatch {
  status?: MaintenanceRequest["status"];
  declineNote?: string;
  verificationRequested?: boolean;
  withdrawn?: boolean;
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
    id: "n-alarm-fd-216-14",
    tone: "danger",
    title: "Fire alarm triggered",
    detail: "Building 216 / Room 302 detector — FD-216-14.",
    time: "now",
    read: false,
    pulse: true,
  },
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
  currentUser: AppUser;
  activeBuildingId: string;
  setActiveBuildingId: (id: string) => void;
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
  /** Attaches the reason an approver sent a request back. The status holds. */
  declineRequest: (id: string, reason: string) => void;
  /** Its submitter pulls it back before approval; it leaves every list. */
  withdrawRequest: (id: string) => void;
  /** Its submitter says the resolved work looks done. A flag, not a status. */
  requestVerification: (id: string) => void;
  /** Forward one step, or back one step — never more, and the age never resets. */
  moveRequest: (id: string, direction: "next" | "prev") => void;
  /** The estate as it stands, not as it was seeded. */
  buildings: Building[];
  rooms: Room[];
  addBuilding: (building: Building) => void;
  updateBuilding: (building: Building) => void;
  /** Deletes the building and every room in it. */
  deleteBuilding: (buildingId: string) => void;
  addRoom: (room: Room) => void;
  updateRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  /** Every device still on the network — removed ones are already gone. */
  sensors: EnvironmentalSensor[];
  /** Takes a device off the network for this session. */
  removeSensor: (sensorId: string) => void;
  sensorStatus: (sensorId: string, fallback: string) => string;
  /**
   * When the sensor entered its current status — the override's own stamp
   * once it has been actioned here, the record's last report before that.
   * Statuses that change tone with age are measured from this, not updatedAt.
   */
  sensorChangedAt: (sensorId: string, fallback: string) => string;
  setSensorStatus: (sensorId: string, status: string) => void;
  /**
   * The Log Book: what this session wrote, newest first, in front of the seed
   * entries. Every action in the app lands here.
   */
  logBook: LogBookEntry[];
  /** Writes one entry. Screens holding their own state call it directly. */
  log: (draft: LogDraft) => void;
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

/**
 * Mounted inside the auth gate, below a resolved identity — which is why
 * `user` is required rather than nullable, and why signing out unmounts this
 * whole tree and takes every override map and the session log with it. That
 * unmount is what stops one person's work leaking into the next person's
 * session in the same tab.
 */
export function AppStateProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const role = user.role;
  // Lazily initialised, not set in an effect: an effect would give Office
  // Staff one render scoped to the wrong building.
  const [activeBuildingId, setActiveBuildingIdState] = React.useState(
    () => user.buildingId ?? "b216",
  );
  const [notifications, setNotifications] =
    React.useState<Notification[]>(BASE_NOTIFICATIONS);
  // A request now carries more in-session change than a status: the reason an
  // approver sent it back, its submitter's "this looks done", and whether it
  // was withdrawn before approval. One patch per request keeps them together.
  const [requestPatches, setRequestPatches] = React.useState<
    Record<string, RequestPatch>
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
  const [sessionLog, setSessionLog] = React.useState<LogBookEntry[]>([]);
  const [removedSensorIds, setRemovedSensorIds] = React.useState<string[]>([]);
  // The estate is editable from Administration. Held here rather than on that
  // page so a renamed building reaches every building filter in the app, not
  // just the tab that renamed it.
  const [estateBuildings, setEstateBuildings] =
    React.useState<Building[]>(BUILDINGS);
  const [estateRooms, setEstateRooms] = React.useState<Room[]>(ROOMS);

  // mock-data's sensorType/statusDef accessors read through this, so the page
  // sees an edit on the same render that made it. Assigning the current list
  // is idempotent, which is why it can sit in the render body.
  setSensorRegistrySource(sensorTypeRegistry);
  // Same shim, same reason: roomLabel/buildingName/roomsForBuilding resolve
  // through this, so no consumer has to know the estate can change.
  setEstateSource({ buildings: estateBuildings, rooms: estateRooms });

  const setActiveBuildingId = React.useCallback(
    (id: string) => {
      if (role === "office-staff") return;
      setActiveBuildingIdState(id);
    },
    [role],
  );

  const markNotificationRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllNotificationsRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const log = React.useCallback(
    (draft: LogDraft) => {
      const actor = user;
      setSessionLog((prev) => [
        {
          ...draft,
          id: `lb-${Date.now()}-${prev.length}`,
          timestamp: new Date().toISOString(),
          actorUid: draft.actorName ? undefined : actor.uid,
          actorName: draft.actorName ?? actor.name,
          actorRole: draft.actorName ? undefined : user.role,
        },
        ...prev,
      ]);
    },
    [user],
  );

  // What this session wrote sits in front of the seed book, newest first —
  // the same list the Log Book page and the dashboard rail both read.
  const logBook = React.useMemo(
    () => [...sessionLog, ...LOG_BOOK],
    [sessionLog],
  );

  const requestStatus = React.useCallback(
    (req: MaintenanceRequest) => requestPatches[req.id]?.status ?? req.status,
    [requestPatches],
  );

  // The one resolved list. A withdrawn request drops out here rather than
  // being filtered again on every screen, so no count can disagree.
  const requests = React.useMemo(
    () =>
      [...createdRequests, ...MAINTENANCE_REQUESTS]
        .map((r) => ({ ...r, ...requestPatches[r.id] }))
        .filter((r) => !r.withdrawn),
    [createdRequests, requestPatches],
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

  const addRequest = React.useCallback(
    (request: MaintenanceRequest) => {
      setCreatedRequests((prev) => [request, ...prev]);
      log({
        source: "request",
        actionType: "request-created",
        title: "Request raised",
        detail: `${request.issue} — ${roomLabel(request.roomId)}, ${buildingName(request.buildingId)}.`,
        targetType: "request",
        targetId: request.id,
        buildingId: request.buildingId,
        refId: request.id,
      });
    },
    [log],
  );

  const patchRequest = React.useCallback((id: string, patch: RequestPatch) => {
    setRequestPatches((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }, []);

  const moveRequest = React.useCallback(
    (id: string, direction: "next" | "prev") => {
      const base = [...createdRequests, ...MAINTENANCE_REQUESTS].find(
        (r) => r.id === id,
      );
      const current = requestPatches[id]?.status ?? base?.status ?? "requested";
      const table =
        direction === "next" ? REQUEST_NEXT_STATUS : REQUEST_PREV_STATUS;
      const target = table[current];
      if (!target) return;
      setRequestPatches((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          status: target,
          // Approving answers the note that sent it back, so the note goes.
          ...(current === "requested" ? { declineNote: undefined } : {}),
        },
      }));
      log({
        source: "request",
        actionType: "request-status-changed",
        title:
          target === "approved" && current === "requested"
            ? "Request approved"
            : `Request moved to ${target}`,
        detail: `${id} — ${current} → ${target}.${base ? ` ${base.issue}.` : ""}`,
        targetType: "request",
        targetId: id,
        buildingId: base?.buildingId,
        refId: id,
      });
    },
    [createdRequests, requestPatches, log],
  );

  const findRequest = React.useCallback(
    (id: string) =>
      [...createdRequests, ...MAINTENANCE_REQUESTS].find((r) => r.id === id),
    [createdRequests],
  );

  /** Sends a request back without moving it: the status holds, the reason lands. */
  const declineRequest = React.useCallback(
    (id: string, reason: string) => {
      patchRequest(id, { declineNote: reason });
      const base = findRequest(id);
      log({
        source: "request",
        actionType: "request-declined",
        title: "Request sent back",
        detail: `${id} stays in requested. Reason: ${reason}`,
        targetType: "request",
        targetId: id,
        buildingId: base?.buildingId,
        refId: id,
      });
    },
    [patchRequest, findRequest, log],
  );

  /** Pulled back by its submitter before approval — it leaves every list. */
  const withdrawRequest = React.useCallback(
    (id: string) => {
      patchRequest(id, { withdrawn: true });
      const base = findRequest(id);
      log({
        source: "request",
        actionType: "request-withdrawn",
        title: "Request withdrawn",
        detail: `${id} was withdrawn by its submitter before approval.${base ? ` ${base.issue}.` : ""}`,
        targetType: "request",
        targetId: id,
        buildingId: base?.buildingId,
        refId: id,
      });
    },
    [patchRequest, findRequest, log],
  );

  /** The submitter asks for a close-out; an approver still presses it. */
  const requestVerification = React.useCallback(
    (id: string) => {
      patchRequest(id, { verificationRequested: true });
      const base = findRequest(id);
      log({
        source: "request",
        actionType: "request-verification-requested",
        title: "Close-out requested",
        detail: `${id} — the submitter says the resolved work looks done.`,
        targetType: "request",
        targetId: id,
        buildingId: base?.buildingId,
        refId: id,
      });
    },
    [patchRequest, findRequest, log],
  );

  /**
   * The one resolved device list. A removed sensor drops out here rather than
   * being filtered again on every screen, so the Sensors page and the sensor
   * type registry's "N sensors use this type" guard cannot disagree about what
   * still exists.
   */
  const sensors = React.useMemo(
    () => SENSORS.filter((s) => !removedSensorIds.includes(s.id)),
    [removedSensorIds],
  );

  const sensorStatus = React.useCallback(
    (sensorId: string, fallback: string) => {
      const override = sensorOverrides[sensorId];
      if (override) return override.status;
      return fallback;
    },
    [sensorOverrides],
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
      const sensor = SENSORS.find((s) => s.id === sensorId);
      const type = sensor ? sensorType(sensor.typeId) : undefined;
      const def = type?.statuses.find((st) => st.id === status);
      log({
        source: def?.isAlarm ? "alert" : "sensor",
        actionType: "sensor-status-changed",
        title: `${type?.label ?? "Sensor"} → ${def?.label ?? status}`,
        detail: sensor
          ? `${sensorId} — ${roomLabel(sensor.roomId)}, ${buildingName(sensor.buildingId)}.`
          : sensorId,
        targetType: "sensor",
        targetId: sensorId,
        buildingId: sensor?.buildingId,
        refId: sensorId,
      });
    },
    [log],
  );

  // ---- Sensor type registry ------------------------------------------------
  //
  // Every guard below is about records that already point at what is being
  // changed. The registry is free to grow; it is not free to strand a sensor.

  /** Sensors currently sitting in a status, overrides counted. */
  const sensorsInStatus = React.useCallback(
    (typeId: string, statusId: string) =>
      sensors.filter(
        (s) =>
          s.typeId === typeId &&
          (sensorOverrides[s.id]?.status ?? s.status) === statusId,
      ).length,
    [sensorOverrides, sensors],
  );

  // Validation has to answer the caller now, not on the next render, so the
  // next list is built from the current one here rather than in an updater.
  const patchType = React.useCallback(
    (
      typeId: string,
      change: (type: SensorTypeDef) => SensorTypeDef,
      entry?: Pick<LogDraft, "actionType" | "title" | "detail">,
    ) => {
      const current = sensorTypeRegistry.find((t) => t.id === typeId);
      if (!current) return fail("No sensor type with that id.");
      const next = change(current);
      const check = validateType(next);
      if (!check.ok) return check;
      setSensorTypeRegistry((prev) =>
        prev.map((t) => (t.id === typeId ? next : t)),
      );
      // Every accepted change writes one entry — a refused one writes none,
      // which is why this sits after the validation rather than before it.
      log({
        source: "admin",
        actionType: entry?.actionType ?? "sensor-type-edited",
        title: entry?.title ?? "Sensor type edited",
        detail:
          entry?.detail ??
          `${next.label} — ${next.statuses.length} statuses, ${next.actions.length} actions.`,
        targetType: "sensor",
        targetId: typeId,
      });
      return OK;
    },
    [sensorTypeRegistry, log],
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
      log({
        source: "admin",
        actionType: "sensor-type-added",
        title: "Sensor type added",
        detail: `${next.label} (${id}) — ${next.statuses.length} statuses, ${next.actions.length} actions.`,
        targetType: "sensor",
        targetId: id,
      });
      return { ok: true as const, id };
    },
    [sensorTypeRegistry, log],
  );

  const updateSensorType = React.useCallback(
    (typeId: string, patch: Partial<Omit<SensorTypeDef, "id">>) =>
      patchType(typeId, (type) => ({ ...type, ...patch })),
    [patchType],
  );

  const archiveSensorType = React.useCallback(
    (typeId: string) => {
      const inUse = sensors.filter((s) => s.typeId === typeId).length;
      if (inUse > 0) {
        const type = sensorTypeRegistry.find((t) => t.id === typeId);
        return fail(
          `${inUse} sensor${inUse === 1 ? " is" : "s are"} registered as ${type?.label ?? typeId}. Move or remove ${inUse === 1 ? "it" : "them"} before archiving the type.`,
        );
      }
      const type = sensorTypeRegistry.find((t) => t.id === typeId);
      return patchType(typeId, (t) => ({ ...t, archived: true }), {
        actionType: "sensor-type-archived",
        title: "Sensor type archived",
        detail: `${type?.label ?? typeId} no longer appears on the Sensors page. Existing records still resolve it.`,
      });
    },
    [patchType, sensorTypeRegistry, sensors],
  );

  const restoreSensorType = React.useCallback(
    (typeId: string) =>
      patchType(typeId, (type) => ({ ...type, archived: false }), {
        actionType: "sensor-type-edited",
        title: "Sensor type restored",
        detail: "It is back in the registry and on the Sensors page.",
      }),
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

  // ---- Estate ---------------------------------------------------------------

  const addBuilding = React.useCallback((building: Building) => {
    setEstateBuildings((prev) => [...prev, building]);
  }, []);

  const updateBuilding = React.useCallback((next: Building) => {
    setEstateBuildings((prev) =>
      prev.map((b) => (b.id === next.id ? next : b)),
    );
  }, []);

  /** Takes its rooms with it — a room cannot outlive the building it is in. */
  const deleteBuilding = React.useCallback((buildingId: string) => {
    setEstateBuildings((prev) => prev.filter((b) => b.id !== buildingId));
    setEstateRooms((prev) => prev.filter((r) => r.buildingId !== buildingId));
  }, []);

  const addRoom = React.useCallback((room: Room) => {
    setEstateRooms((prev) => [...prev, room]);
  }, []);

  const updateRoom = React.useCallback((next: Room) => {
    setEstateRooms((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }, []);

  const removeRoom = React.useCallback((roomId: string) => {
    setEstateRooms((prev) => prev.filter((r) => r.id !== roomId));
  }, []);

  const removeSensor = React.useCallback(
    (sensorId: string) => {
      const sensor = SENSORS.find((s) => s.id === sensorId);
      setRemovedSensorIds((prev) => [...prev, sensorId]);
      log({
        source: "sensor",
        actionType: "sensor-status-changed",
        title: "Sensor removed",
        detail: sensor
          ? `${sensorId} taken off the network — ${roomLabel(sensor.roomId)}, ${buildingName(sensor.buildingId)}.`
          : sensorId,
        targetType: "sensor",
        targetId: sensorId,
        buildingId: sensor?.buildingId,
        refId: sensorId,
      });
    },
    [log],
  );

  const equipmentCondition = React.useCallback(
    (unitId: string, fallback: EquipmentCondition) =>
      equipmentOverrides[unitId] ?? fallback,
    [equipmentOverrides],
  );

  const setEquipmentCondition = React.useCallback(
    (unitId: string, condition: EquipmentCondition) => {
      setEquipmentOverrides((prev) => ({ ...prev, [unitId]: condition }));
      const unit = EQUIPMENT_UNITS.find((u) => u.id === unitId);
      log({
        source: "equipment",
        actionType: "equipment-status-changed",
        title: `Equipment marked ${condition.replace("-", " ")}`,
        detail: unit
          ? `${equipmentUnitLabel(unit)} — ${roomLabel(unit.roomId)}, ${buildingName(unit.buildingId)}.`
          : unitId,
        targetType: "equipment",
        targetId: unitId,
        buildingId: unit?.buildingId,
        refId: unit?.tag ?? unitId,
      });
    },
    [log],
  );

  const value = React.useMemo<AppState>(
    () => ({
      role,
      currentUser: user,
      activeBuildingId,
      setActiveBuildingId,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markNotificationRead,
      markAllNotificationsRead,
      requests,
      scopedRequests,
      openRequestCount,
      addRequest,
      requestStatus,
      declineRequest,
      withdrawRequest,
      requestVerification,
      moveRequest,
      buildings: estateBuildings,
      rooms: estateRooms,
      addBuilding,
      updateBuilding,
      deleteBuilding,
      addRoom,
      updateRoom,
      removeRoom,
      sensors,
      removeSensor,
      sensorStatus,
      sensorChangedAt,
      setSensorStatus,
      logBook,
      log,
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
      user,
      activeBuildingId,
      setActiveBuildingId,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      requests,
      scopedRequests,
      openRequestCount,
      addRequest,
      requestStatus,
      declineRequest,
      withdrawRequest,
      requestVerification,
      moveRequest,
      estateBuildings,
      estateRooms,
      addBuilding,
      updateBuilding,
      deleteBuilding,
      addRoom,
      updateRoom,
      removeRoom,
      sensors,
      removeSensor,
      sensorStatus,
      sensorChangedAt,
      setSensorStatus,
      logBook,
      log,
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
