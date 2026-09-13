"use client";

import * as React from "react";
import { countOpenRequests } from "@/lib/derive";
import {
  CURRENT_USERS,
  LIVE_ALARM_SENSOR_ID,
  MAINTENANCE_REQUESTS,
  REQUEST_NEXT_STATUS,
  REQUEST_PREV_STATUS,
} from "@/lib/mock-data";
import type {
  AppUser,
  EquipmentCondition,
  MaintenanceRequest,
  UserRole,
} from "@/lib/types";

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
  setSensorStatus: (sensorId: string, status: string) => void;
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
  const [sensorOverrides, setSensorOverrides] = React.useState<
    Record<string, string>
  >({});
  const [equipmentOverrides, setEquipmentOverrides] = React.useState<
    Record<string, EquipmentCondition>
  >({});
  const alarmNotifAdded = React.useRef(false);

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
    (sensorId: string, fallback: string) =>
      sensorOverrides[sensorId] ?? fallback,
    [sensorOverrides],
  );

  const setSensorStatus = React.useCallback(
    (sensorId: string, status: string) => {
      setSensorOverrides((prev) => ({ ...prev, [sensorId]: status }));
    },
    [],
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
      setSensorStatus,
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
      setSensorStatus,
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
