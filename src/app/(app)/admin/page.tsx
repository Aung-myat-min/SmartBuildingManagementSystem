"use client";

import {
  Building2,
  Camera,
  Lock,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon,
  Waves,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AccessDenied } from "@/components/shared/access-denied";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  FormDrawer,
  FormField,
  FormFieldLocked,
} from "@/components/shared/form-drawer";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { type RegistryResult, slugify, useAppState } from "@/lib/app-state";
import { countOpenRequests } from "@/lib/derive";
import { formatRelative } from "@/lib/format";
import { SENSOR_ICON_KEYS, sensorIcon } from "@/lib/icons";
import { BUILDING_META, EQUIPMENT_UNITS } from "@/lib/mock-data";
import {
  canEditUser,
  canManageAccounts,
  canManageEstate,
  canManageSensorTypes,
  ESTATE_LOCK_REASON,
  roleLabel,
  SENSOR_TYPE_LOCK_REASON,
  userEditLockReason,
} from "@/lib/permissions";
import type {
  Building,
  ManagedUser,
  Room,
  RoomType,
  SensorAction,
  SensorIconKey,
  SensorStatusDef,
  SensorTypeDef,
  UserRole,
} from "@/lib/types";
import {
  createUser,
  setUserStatus,
  updateUser,
  useUsers,
} from "@/lib/users-store";
import { cn } from "@/lib/utils";

const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  lecture: "Lecture",
  lab: "Lab",
  office: "Office",
  plant: "Plant",
  common: "Common",
};
const ROOM_TYPES = Object.keys(ROOM_TYPE_LABEL) as RoomType[];
const FLOORS = ["G", "1", "2", "3"];

const TONES: Tone[] = ["success", "warning", "danger", "info", "neutral"];
const ROLES: UserRole[] = ["office-staff", "admin-manager", "ceo-super-admin"];

const ROLE_TONE: Record<UserRole, Tone> = {
  "office-staff": "neutral",
  "admin-manager": "info",
  "ceo-super-admin": "warning",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdministrationPage() {
  const { role, currentUser, requests, buildings, rooms, sensorTypeRegistry } =
    useAppState();
  const confirm = useConfirm();

  const mayEstate = canManageEstate(role);
  const mayAccounts = canManageAccounts(role);
  const maySensorTypes = canManageSensorTypes(role);

  // An Admin Manager lands on User Accounts with Buildings padlocked.
  const [tab, setTab] = usePersistedState<
    "buildings" | "users" | "sensor-types"
  >("admin.tab", mayEstate ? "buildings" : "users");
  // A stored preference must not put a role on a tab it cannot open. The two
  // gates differ — the estate is the CEO's, sensor types are shared.
  React.useEffect(() => {
    if (tab === "buildings" && !mayEstate) setTab("users");
    if (tab === "sensor-types" && !maySensorTypes) setTab("users");
  }, [mayEstate, maySensorTypes, tab, setTab]);

  // Live, not a copy: a role change here reaches that person's own session
  // through the subscription in lib/auth.tsx, without a reload.
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const [selectedBuildingId, setSelectedBuildingId] = React.useState(
    buildings[0]?.id ?? "",
  );

  if (!mayAccounts) {
    return (
      <AccessDenied
        title="Administration is restricted"
        body={
          <>
            Buildings, rooms and user accounts are managed by the CEO / Super
            Admin. Your role is{" "}
            <span className="font-mono">{roleLabel[role]}</span>.
          </>
        }
      />
    );
  }

  const tabNote =
    tab === "sensor-types"
      ? "Sensor types decide what the Sensors page can show and who may act."
      : mayEstate
        ? "Buildings and rooms shape everything the other pages count."
        : "Admin Managers manage accounts and sensor types; the estate itself is the CEO's.";
  const tabCount =
    tab === "buildings"
      ? `${buildings.length} SITES · ${rooms.length} ROOMS`
      : tab === "users"
        ? `${users.length} ACCOUNTS`
        : `${sensorTypeRegistry.length} TYPES`;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
        <div className="bg-secondary border-border flex items-center gap-1 rounded-[5px] border p-[3px]">
          <TabButton
            icon={mayEstate ? Building2 : Lock}
            label="Buildings"
            active={tab === "buildings"}
            disabled={!mayEstate}
            title={mayEstate ? undefined : ESTATE_LOCK_REASON}
            onClick={() => setTab("buildings")}
          />
          <TabButton
            icon={UsersIcon}
            label="User Accounts"
            active={tab === "users"}
            onClick={() => setTab("users")}
          />
          <TabButton
            icon={maySensorTypes ? Waves : Lock}
            label="Sensor Types"
            active={tab === "sensor-types"}
            disabled={!maySensorTypes}
            title={maySensorTypes ? undefined : SENSOR_TYPE_LOCK_REASON}
            onClick={() => setTab("sensor-types")}
          />
        </div>
        <span className="bg-divider h-5.5 w-px shrink-0" />
        <span className="text-muted-foreground text-[11.5px] leading-snug">
          {tabNote}
        </span>
        <div className="flex-1" />
        <span className="bg-primary text-primary-foreground shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium">
          {tabCount}
        </span>
      </div>

      {tab === "buildings" ? (
        <BuildingsTab
          buildings={buildings}
          rooms={rooms}
          users={users}
          selectedId={selectedBuildingId}
          onSelect={setSelectedBuildingId}
          openRequestsFor={(id) => countOpenRequests(requests, id)}
          confirm={confirm}
        />
      ) : tab === "users" ? (
        <UsersTab
          actorRole={role}
          selfUid={currentUser.uid}
          users={users}
          loading={usersLoading}
          loadError={usersError}
          buildings={buildings}
          confirm={confirm}
        />
      ) : maySensorTypes ? (
        <SensorTypesTab confirm={confirm} />
      ) : (
        <AccessDenied
          title="Sensor types are restricted"
          body={
            <>
              The sensor type registry is managed by Admin Managers and the CEO
              / Super Admin. Your role is{" "}
              <span className="font-mono">{roleLabel[role]}</span>.
            </>
          }
        />
      )}
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  disabled,
  title,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-[3px] px-3 py-1.75 text-[11.5px] leading-none font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground/70 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <Icon className="size-3.25" />
      {label}
    </button>
  );
}

// ---- Buildings -------------------------------------------------------------

type ConfirmFn = ReturnType<typeof useConfirm>;

function BuildingsTab({
  buildings,
  rooms,
  users,
  selectedId,
  onSelect,
  openRequestsFor,
  confirm,
}: {
  buildings: Building[];
  rooms: Room[];
  users: ManagedUser[];
  selectedId: string;
  onSelect: (id: string) => void;
  openRequestsFor: (buildingId: string) => number;
  confirm: ConfirmFn;
}) {
  const {
    log,
    addBuilding,
    updateBuilding,
    deleteBuilding,
    addRoom,
    updateRoom,
    removeRoom,
  } = useAppState();
  const [newOpen, setNewOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Building | null>(null);
  const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);
  const [newRoomName, setNewRoomName] = React.useState("");
  const [newRoomType, setNewRoomType] = React.useState<RoomType>("lecture");
  const [newRoomFloor, setNewRoomFloor] = React.useState("G");

  const selected =
    buildings.find((b) => b.id === selectedId) ?? buildings[0] ?? null;
  const meta = selected ? BUILDING_META[selected.id] : undefined;
  const buildingRooms = selected
    ? rooms.filter((r) => r.buildingId === selected.id)
    : [];

  const devicesIn = (buildingId: string) =>
    EQUIPMENT_UNITS.filter((u) => u.buildingId === buildingId).length;
  const staffIn = (buildingId: string) =>
    users.filter((u) => u.buildingId === buildingId).length;

  const handleAddRoom = () => {
    if (!selected || newRoomName.trim().length === 0) return;
    void addRoom({
      id: `r-${selected.id}-${newRoomName.trim().toLowerCase().replace(/\s+/g, "-")}`,
      buildingId: selected.id,
      roomNumber: newRoomName.trim(),
      type: newRoomType,
      floor: newRoomFloor,
    });
    log({
      source: "admin",
      actionType: "room-added",
      title: "Room added",
      detail: `${newRoomName.trim()} (${newRoomType}, floor ${newRoomFloor}) added to ${selected.name}.`,
      targetType: "room",
      targetId: newRoomName.trim(),
      buildingId: selected.id,
    });
    toast.success(`${newRoomName.trim()} added to ${selected.name}`);
    setNewRoomName("");
  };

  const handleRemoveRoom = async (room: Room) => {
    const devices = EQUIPMENT_UNITS.filter((u) => u.roomId === room.id).length;
    const result = await confirm({
      title: `Remove ${room.roomNumber}?`,
      body: `${room.roomNumber} is removed from ${selected?.name}.`,
      note:
        devices > 0
          ? `Its ${devices} device${devices === 1 ? "" : "s"} stop reporting and drop out of every count on the estate.`
          : "It holds no devices, so no counts change.",
      tone: "danger",
      confirmLabel: "Remove room",
    });
    if (!result.confirmed) return;
    const written = await removeRoom(room.id);
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    log({
      source: "admin",
      actionType: "room-removed",
      title: "Room removed",
      detail: `${room.roomNumber} removed from ${selected?.name ?? "the estate"}${devices > 0 ? `, taking ${devices} device${devices === 1 ? "" : "s"} out of every count` : ""}.`,
      targetType: "room",
      targetId: room.id,
      buildingId: room.buildingId,
    });
    toast.success(`${room.roomNumber} removed`);
  };

  const handleDeleteBuilding = async () => {
    if (!selected) return;
    const roomCount = buildingRooms.length;
    const devices = devicesIn(selected.id);
    const result = await confirm({
      title: `Delete ${selected.name}?`,
      body: `${selected.name} and its ${roomCount} room${roomCount === 1 ? "" : "s"} are removed.`,
      note:
        devices > 0
          ? `${devices} device${devices === 1 ? " is" : "s are"} still registered here, so this will be refused.`
          : `${staffIn(selected.id)} account${staffIn(selected.id) === 1 ? "" : "s"} lose their building scope.`,
      tone: "danger",
      confirmLabel: "Delete building",
      requireReason: true,
    });
    if (!result.confirmed) return;
    // The store refuses while equipment, sensors or open requests still point
    // at the building, rather than leaving them pointing at nothing.
    const written = await deleteBuilding(selected.id);
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    onSelect(buildings.find((b) => b.id !== selected.id)?.id ?? "");
    log({
      source: "admin",
      actionType: "building-deleted",
      title: "Building deleted",
      detail: `${selected.name} removed with its ${roomCount} room${roomCount === 1 ? "" : "s"}. Reason: ${result.reason ?? "—"}`,
      targetType: "building",
      targetId: selected.id,
    });
    toast.success(`${selected.name} deleted`);
  };

  return (
    <div className="grid grid-cols-[308px_minmax(0,1fr)] items-start gap-4 max-lg:grid-cols-1">
      <div className="flex flex-col gap-2.5">
        {buildings.map((b) => {
          const active = b.id === selected?.id;
          return (
            <button
              type="button"
              key={b.id}
              onClick={() => onSelect(b.id)}
              className={cn(
                "bg-card cursor-pointer rounded-[5px] border border-l-[3px] px-3.5 py-3 text-left",
                active
                  ? "border-border border-l-primary"
                  : "border-border hover:border-primary border-l-transparent",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[12.5px] leading-tight font-semibold">
                  {b.name}
                </span>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {b.code}
                </span>
              </div>
              <div className="text-muted-foreground mt-2.25 flex gap-3.5 font-mono text-[10.5px] leading-none">
                <span>
                  {rooms.filter((r) => r.buildingId === b.id).length} rooms
                </span>
                <span>{devicesIn(b.id)} devices</span>
                <span>{staffIn(b.id)} staff</span>
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground border-input cursor-pointer rounded-[5px] border border-dashed py-2.75 text-[11.5px] leading-none font-medium"
        >
          + Add building
        </button>
      </div>

      {selected && (
        <div className="border-border bg-card overflow-hidden rounded-[5px] border">
          <div className="border-divider flex items-stretch gap-4 border-b p-4 max-md:flex-col">
            <div className="border-divider bg-background flex min-h-49 flex-1 items-center justify-center overflow-hidden rounded border">
              <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 text-center">
                <Camera className="size-6" />
                <span className="text-[10.5px]">{meta?.photoHint}</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] leading-tight font-semibold">
                    {selected.name}
                  </div>
                  <div className="text-muted-foreground mt-1.25 font-mono text-[10.5px] leading-snug">
                    {selected.code} · {meta?.address}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(selected)}
                  className="border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground shrink-0 cursor-pointer rounded border px-2.75 py-1.75 text-[11px] leading-none font-medium"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBuilding}
                  title="Delete this building and everything under it"
                  className="border-danger/40 text-danger-foreground bg-card hover:bg-danger-muted shrink-0 cursor-pointer rounded border px-2.75 py-1.75 text-[11px] leading-none font-medium"
                >
                  Delete
                </button>
              </div>
              <p className="text-foreground/80 mt-2.75 text-[12px] leading-relaxed text-pretty">
                {meta?.description}
              </p>
              <div className="min-h-2.5 flex-1" />
              <div className="border-rule mt-3 flex flex-wrap gap-5 border-t pt-3.25">
                <Stat label="ROOMS" value={buildingRooms.length} />
                <Stat label="DEVICES" value={devicesIn(selected.id)} />
                <Stat
                  label="FAULTY"
                  value={
                    EQUIPMENT_UNITS.filter(
                      (u) =>
                        u.buildingId === selected.id &&
                        u.condition === "faulty",
                    ).length
                  }
                  tone="text-danger-foreground"
                />
                <Stat
                  label="OPEN REQ"
                  value={openRequestsFor(selected.id)}
                  tone="text-warning-foreground"
                />
                <Stat label="STAFF" value={staffIn(selected.id)} />
              </div>
            </div>
          </div>

          {/* Below a tablet the room table keeps its column widths and
              scrolls inside the card, rather than pushing the page sideways. */}
          <div className="overflow-x-auto">
            <div className="bg-surface-subtle border-divider text-muted-foreground flex min-w-140 border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
              <span className="flex-1">Room</span>
              <span className="w-30">Type</span>
              <span className="w-17.5">Floor</span>
              <span className="w-22 text-right">Devices</span>
              <span className="w-30 text-right">Actions</span>
            </div>
            {buildingRooms.map((r) => (
              <div
                key={r.id}
                className="border-rule flex min-w-140 items-center border-b px-4 py-2.5"
              >
                <span className="flex-1 truncate text-[12.5px] leading-snug font-[450]">
                  {r.roomNumber}
                </span>
                <span className="text-neutral-foreground w-30 text-[11.5px]">
                  {ROOM_TYPE_LABEL[r.type]}
                </span>
                <span className="text-muted-foreground w-17.5 font-mono text-[11px]">
                  {r.floor}
                </span>
                <span className="text-neutral-foreground w-22 text-right font-mono text-[11px] font-medium">
                  {EQUIPMENT_UNITS.filter((u) => u.roomId === r.id).length}
                </span>
                <span className="flex w-30 justify-end gap-1.5">
                  <RowButton
                    onClick={() => setEditingRoom(r)}
                    title="Edit this room"
                  >
                    Edit
                  </RowButton>
                  <RowButton
                    danger
                    onClick={() => handleRemoveRoom(r)}
                    title="Remove room"
                  >
                    Remove
                  </RowButton>
                </span>
              </div>
            ))}

            <div className="bg-surface-subtle flex items-center gap-2 px-4 py-3">
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name or number"
                className="border-input focus:border-primary min-w-0 flex-1 rounded border px-2.25 py-2 text-[12px] outline-none"
              />
              <select
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value as RoomType)}
                className="border-input bg-card text-neutral-foreground w-32.5 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ROOM_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <select
                value={newRoomFloor}
                onChange={(e) => setNewRoomFloor(e.target.value)}
                className="border-input bg-card text-neutral-foreground w-24 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
              >
                {FLOORS.map((f) => (
                  <option key={f} value={f}>
                    Floor {f}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddRoom}
                className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded border px-3.25 py-2 text-[11.5px] leading-none font-medium"
              >
                Add room
              </button>
            </div>
          </div>
        </div>
      )}

      <NewBuildingDrawer
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={(name, code) => {
          const id = `b-${Date.now()}`;
          void addBuilding({ id, name, code });
          onSelect(id);
          log({
            source: "admin",
            actionType: "building-added",
            title: "Building added",
            detail: `${name} (${code}) added to the estate. It starts with no rooms.`,
            targetType: "building",
            targetId: name,
          });
          toast.success(`${name} added to the estate`);
        }}
      />
      <EditBuildingDrawer
        building={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          void updateBuilding(next);
          log({
            source: "admin",
            actionType: "building-edited",
            title: "Building edited",
            detail: `${next.name} — name and site code saved.`,
            targetType: "building",
            targetId: next.id,
            buildingId: next.id,
          });
          toast.success(`${next.name} updated`);
        }}
      />
      <EditRoomDrawer
        room={editingRoom}
        onClose={() => setEditingRoom(null)}
        onSave={(next) => {
          void updateRoom(next);
          log({
            source: "admin",
            actionType: "room-edited",
            title: "Room edited",
            detail: `${next.roomNumber} — ${next.type}, floor ${next.floor}.`,
            targetType: "room",
            targetId: next.id,
            buildingId: next.buildingId,
          });
          toast.success(`${next.roomNumber} updated`);
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-mono text-[15px] leading-none font-semibold",
          value > 0 ? tone : undefined,
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground mt-1.25 font-mono text-[9px] leading-none tracking-[0.06em]">
        {label}
      </div>
    </div>
  );
}

function RowButton({
  children,
  danger,
  title,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "bg-card flex cursor-pointer items-center gap-1 rounded border px-2.25 py-1.25 text-[10.5px] leading-none font-medium",
        danger
          ? "border-danger/40 text-danger-foreground hover:bg-danger-muted"
          : "border-input text-neutral-foreground hover:border-primary hover:text-accent-foreground",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      {children}
    </button>
  );
}

function TextInput(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className="border-input focus:border-primary w-full rounded border px-2.25 py-2 text-[12px] outline-none"
    />
  );
}

function SelectInput(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
    />
  );
}

function NewBuildingDrawer({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, code: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setError(null);
    }
  }, [open]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New building"
      description="A new site starts empty. Add its rooms next, then move or install equipment into them."
      submitLabel="Create"
      error={error}
      onSubmit={() => {
        if (name.trim().length === 0) {
          setError("A building needs a name.");
          return;
        }
        onCreate(name.trim(), code.trim() || "SITE —");
        onOpenChange(false);
      }}
    >
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Building name"
      />
      <TextInput
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Site code, e.g. SITE D"
      />
    </FormDrawer>
  );
}

function EditBuildingDrawer({
  building,
  onClose,
  onSave,
}: {
  building: Building | null;
  onClose: () => void;
  onSave: (next: Building) => void;
}) {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");

  React.useEffect(() => {
    if (building) {
      setName(building.name);
      setCode(building.code);
    }
  }, [building]);

  return (
    <FormDrawer
      open={Boolean(building)}
      onOpenChange={(o) => !o && onClose()}
      title="Edit building"
      description="Renaming a site updates it everywhere it is counted."
      submitLabel="Save changes"
      onSubmit={() => {
        if (!building || name.trim().length === 0) return;
        onSave({ ...building, name: name.trim(), code: code.trim() });
        onClose();
      }}
    >
      <FormField label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Site code">
        <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
      </FormField>
    </FormDrawer>
  );
}

function EditRoomDrawer({
  room,
  onClose,
  onSave,
}: {
  room: Room | null;
  onClose: () => void;
  onSave: (next: Room) => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<RoomType>("lecture");
  const [floor, setFloor] = React.useState("G");

  React.useEffect(() => {
    if (room) {
      setName(room.roomNumber);
      setType(room.type);
      setFloor(room.floor);
    }
  }, [room]);

  return (
    <FormDrawer
      open={Boolean(room)}
      onOpenChange={(o) => !o && onClose()}
      title="Edit room"
      description="Equipment installed here keeps its tag; only the room's own details change."
      submitLabel="Save changes"
      onSubmit={() => {
        if (!room || name.trim().length === 0) return;
        onSave({ ...room, roomNumber: name.trim(), type, floor });
        onClose();
      }}
    >
      <FormField label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <div className="grid grid-cols-2 gap-2.75">
        <FormField label="Type">
          <SelectInput
            value={type}
            onChange={(e) => setType(e.target.value as RoomType)}
          >
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {ROOM_TYPE_LABEL[t]}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Floor">
          <SelectInput value={floor} onChange={(e) => setFloor(e.target.value)}>
            {FLOORS.map((f) => (
              <option key={f} value={f}>
                Floor {f}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>
    </FormDrawer>
  );
}

// ---- User accounts ---------------------------------------------------------

function UsersTab({
  actorRole,
  selfUid,
  users,
  loading,
  loadError,
  buildings,
  confirm,
}: {
  actorRole: UserRole;
  /** The signed-in account, so "you cannot edit yourself" is a comparison. */
  selfUid: string;
  users: ManagedUser[];
  loading: boolean;
  loadError: string | null;
  buildings: Building[];
  confirm: ConfirmFn;
}) {
  const { log } = useAppState();
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | UserRole>("all");
  const [newOpen, setNewOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ManagedUser | null>(null);

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (query.trim().length === 0) return true;
    const q = query.toLowerCase();
    const building = buildings.find((b) => b.id === u.buildingId)?.name ?? "";
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      building.toLowerCase().includes(q)
    );
  });

  const toggleStatus = async (u: ManagedUser) => {
    const suspending = u.status === "active";
    const result = await confirm({
      title: suspending ? `Suspend ${u.name}?` : `Restore ${u.name}?`,
      body: suspending
        ? `${u.name} is signed out and cannot sign back in.`
        : `${u.name} can sign in again immediately.`,
      note: suspending
        ? "Their history stays in the Log Book and Historical Records — nothing they recorded is removed."
        : undefined,
      tone: suspending ? "warning" : "info",
      confirmLabel: suspending ? "Suspend account" : "Restore account",
    });
    if (!result.confirmed) return;
    const written = await setUserStatus(
      u.uid,
      suspending ? "suspended" : "active",
    );
    if (!written.ok) {
      toast.error(written.message);
      return;
    }
    log({
      source: "admin",
      actionType: "user-status-changed",
      title: suspending ? "Account suspended" : "Account restored",
      detail: `${u.name} (${roleLabel[u.role]}) ${suspending ? "can no longer sign in" : "can sign in again"}.`,
      targetType: "user",
      targetId: u.uid,
      buildingId: u.buildingId,
    });
    toast.success(`${u.name} ${suspending ? "suspended" : "restored"}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
        <div className="border-input focus-within:border-primary bg-card flex min-w-35 flex-1 items-center gap-1.5 rounded border px-2">
          <Search className="text-muted-foreground size-3.25 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or building"
            className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "all" | UserRole)}
          className="border-input bg-card text-neutral-foreground shrink-0 cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
        >
          <option value="all">All roles</option>
          <option value="office-staff">Office Staff</option>
          <option value="admin-manager">Admin Manager</option>
          <option value="ceo-super-admin">CEO / Super Admin</option>
        </select>
        <span className="bg-divider h-5.5 w-px shrink-0" />
        <span
          title="Accounts shown"
          className="bg-neutral-muted text-neutral-foreground shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium"
        >
          {filtered.length} OF {users.length}
        </span>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer rounded border px-3.5 py-2 text-[11.5px] leading-none font-medium"
        >
          + New account
        </button>
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-[5px] border">
        <div className="bg-surface-subtle border-divider text-muted-foreground flex min-w-260 border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
          <span className="w-47.5">Name</span>
          <span className="flex-1">Email</span>
          <span className="w-37.5">Role</span>
          <span className="w-40">Assigned building</span>
          <span className="w-23">Status</span>
          <span className="w-26 text-right">Last active</span>
          <span className="w-35 text-right">Actions</span>
        </div>

        {filtered.map((u) => {
          const isSelf = u.uid === selfUid;
          const editable = canEditUser(actorRole, u.role, isSelf);
          const lockReason = isSelf
            ? "Every estate needs at least one Super Admin — this account cannot edit itself."
            : userEditLockReason(actorRole, u.role);
          return (
            <div
              key={u.uid}
              className={cn(
                "border-rule flex min-w-260 items-center border-b px-4 py-2.5",
                u.status === "suspended" && "bg-surface-subtle",
              )}
            >
              <span className="flex w-47.5 min-w-0 items-center gap-2.25">
                <span className="bg-accent text-accent-foreground flex size-6.5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold">
                  {initials(u.name)}
                </span>
                <span className="truncate text-[12.5px] leading-snug font-[450]">
                  {u.name}
                </span>
              </span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[11.5px]">
                {u.email}
              </span>
              <span className="w-37.5">
                <ToneBadge tone={ROLE_TONE[u.role]}>
                  {roleLabel[u.role]}
                </ToneBadge>
              </span>
              <span className="text-neutral-foreground w-40 text-[12px]">
                {buildings.find((b) => b.id === u.buildingId)?.name ??
                  "All buildings"}
              </span>
              <span className="w-23">
                <ToneBadge tone={u.status === "active" ? "success" : "neutral"}>
                  {u.status}
                </ToneBadge>
              </span>
              <span className="text-muted-foreground w-26 text-right font-mono text-[11px]">
                {formatRelative(u.lastActiveAt)}
              </span>
              <span className="flex w-35 justify-end gap-1.5">
                <RowButton
                  disabled={!editable}
                  title={editable ? "Edit this account" : lockReason}
                  onClick={() => setEditing(u)}
                >
                  {!editable && <Lock className="size-2.5" />}
                  Edit
                </RowButton>
                <RowButton
                  disabled={!editable}
                  title={
                    editable
                      ? u.status === "active"
                        ? "Suspend this account"
                        : "Restore this account"
                      : lockReason
                  }
                  onClick={() => toggleStatus(u)}
                >
                  {u.status === "active" ? "Suspend" : "Restore"}
                </RowButton>
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="text-muted-foreground px-4 py-10 text-center text-[12px]">
            Loading accounts…
          </div>
        )}

        {!loading && loadError && (
          <div className="text-warning-foreground px-4 py-10 text-center text-[12px]">
            {loadError}
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="text-muted-foreground px-4 py-10 text-center text-[12px]">
            No accounts match this search.
          </div>
        )}
      </div>

      <UserDrawer
        actorRole={actorRole}
        open={newOpen}
        editing={null}
        buildings={buildings}
        onOpenChange={setNewOpen}
        onSave={async (draft) => {
          const written = await createUser(draft);
          if (!written.ok) return written;
          log({
            source: "admin",
            actionType: "user-added",
            title: "Account created",
            detail: `${draft.name} — ${roleLabel[draft.role]}${draft.buildingId ? `, scoped to ${buildings.find((b) => b.id === draft.buildingId)?.name ?? draft.buildingId}` : ", all buildings"}.`,
            targetType: "user",
            targetId: written.uid ?? draft.email,
            buildingId: draft.buildingId,
          });
          toast.success(`${draft.name} has been sent a first sign-in link`);
          return written;
        }}
      />
      <UserDrawer
        actorRole={actorRole}
        open={Boolean(editing)}
        editing={editing}
        buildings={buildings}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={async (draft) => {
          if (!editing)
            return { ok: false as const, message: "No account open." };
          const written = await updateUser(editing.uid, draft);
          if (!written.ok) return written;
          log({
            source: "admin",
            actionType:
              editing.role !== draft.role ? "user-role-changed" : "user-edited",
            title:
              editing.role !== draft.role
                ? "Account role changed"
                : "Account edited",
            detail:
              editing.role !== draft.role
                ? `${draft.name} — ${roleLabel[editing.role]} → ${roleLabel[draft.role]}.`
                : `${draft.name} — ${roleLabel[draft.role]}.`,
            targetType: "user",
            targetId: editing.uid,
            buildingId: draft.buildingId,
          });
          toast.success(`${draft.name} updated`);
          return written;
        }}
      />
    </div>
  );
}

/** What the account form collects. Everything else about a user is derived. */
interface UserDraft {
  name: string;
  email: string;
  role: UserRole;
  buildingId?: string;
}

function UserDrawer({
  actorRole,
  open,
  editing,
  buildings,
  onOpenChange,
  onSave,
}: {
  actorRole: UserRole;
  open: boolean;
  editing: ManagedUser | null;
  buildings: Building[];
  onOpenChange: (open: boolean) => void;
  /**
   * Resolves once the write has been attempted, so the drawer can hold the
   * error rather than closing over it.
   */
  onSave: (draft: UserDraft) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRoleValue] = React.useState<UserRole>("office-staff");
  const [buildingId, setBuildingId] = React.useState(buildings[0]?.id ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setRoleValue(editing?.role ?? "office-staff");
    setBuildingId(editing?.buildingId ?? buildings[0]?.id ?? "");
    setError(null);
  }, [open, editing, buildings]);

  // An Admin Manager can only create and edit Office Staff.
  const assignableRoles: UserRole[] =
    actorRole === "ceo-super-admin"
      ? ["office-staff", "admin-manager"]
      : ["office-staff"];

  // Only Office Staff are scoped to a building; everyone else sees the estate.
  const buildingLocked = role !== "office-staff";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit account" : "New account"}
      description={
        editing
          ? "Role and building scope take effect the next time they sign in."
          : "The account is created with a first sign-in link; they choose their own password."
      }
      submitLabel={
        saving ? "Saving…" : editing ? "Save changes" : "Create account"
      }
      submitDisabled={saving}
      error={error}
      onSubmit={async () => {
        if (saving) return;
        if (name.trim().length === 0) {
          setError("An account needs a name.");
          return;
        }
        if (!email.includes("@")) {
          setError("Enter the university address for this account.");
          return;
        }
        setSaving(true);
        const written = await onSave({
          name: name.trim(),
          email: email.trim(),
          role,
          buildingId: buildingLocked ? undefined : buildingId,
        });
        setSaving(false);
        // An email already in use, or a role the actor may not assign, has to
        // stay on screen rather than vanish with the drawer.
        if (!written.ok) {
          setError(written.message ?? "Could not save.");
          return;
        }
        onOpenChange(false);
      }}
    >
      <FormField label="Full name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Email">
        <TextInput
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@university.edu"
        />
      </FormField>
      <FormField label="Role">
        <SelectInput
          value={role}
          onChange={(e) => setRoleValue(e.target.value as UserRole)}
        >
          {assignableRoles.map((r) => (
            <option key={r} value={r}>
              {roleLabel[r]}
            </option>
          ))}
        </SelectInput>
      </FormField>
      {buildingLocked ? (
        <FormFieldLocked
          label="Assigned building"
          value="All buildings"
          icon={<Lock className="text-muted-foreground size-3 shrink-0" />}
        />
      ) : (
        <FormField
          label="Assigned building"
          hint="Office Staff see only their own building, everywhere."
        >
          <SelectInput
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectInput>
        </FormField>
      )}
    </FormDrawer>
  );
}

// ---- Sensor types ----------------------------------------------------------
//
// The registry the Sensors page renders from. Types are never deleted — a
// type still named by a sensor record has to keep resolving — so retiring one
// archives it, and the guards live in the provider rather than here.

function SensorTypesTab({ confirm }: { confirm: ConfirmFn }) {
  const {
    sensors,
    sensorTypeRegistry,
    addSensorType,
    updateSensorType,
    archiveSensorType,
    restoreSensorType,
    removeSensorStatus,
  } = useAppState();

  const [newOpen, setNewOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const editing = sensorTypeRegistry.find((t) => t.id === editingId) ?? null;
  const sensorsOf = (typeId: string) =>
    sensors.filter((s) => s.typeId === typeId).length;

  const archive = async (type: SensorTypeDef) => {
    const inUse = sensorsOf(type.id);
    const result = await confirm({
      title: `Archive ${type.label}?`,
      body: "Archived types drop out of the Sensors page and the new-sensor form. Nothing already recorded changes.",
      note:
        inUse > 0
          ? `${inUse} sensor${inUse === 1 ? " is" : "s are"} registered as ${type.label}, so this will be refused.`
          : "No sensors are registered as this type.",
      tone: "warning",
      confirmLabel: "Archive type",
    });
    if (!result.confirmed) return;
    const outcome = archiveSensorType(type.id);
    if (!outcome.ok) {
      toast.error(outcome.error);
      return;
    }
    toast.success(`${type.label} archived`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-[5px] border px-3 py-2.25">
        <span className="text-muted-foreground text-[11.5px] leading-snug">
          Each type carries its own statuses and actions. The Sensors page
          renders whatever is here — it holds no vocabulary of its own.
        </span>
        <div className="flex-1" />
        <span
          title="Types in the registry"
          className="bg-neutral-muted text-neutral-foreground shrink-0 rounded-[3px] px-2 py-1.75 font-mono text-[10.5px] leading-none font-medium"
        >
          {sensorTypeRegistry.filter((t) => !t.archived).length} ACTIVE
        </span>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer rounded border px-3.5 py-2 text-[11.5px] leading-none font-medium"
        >
          + New sensor type
        </button>
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-[5px] border">
        <div className="bg-surface-subtle border-divider text-muted-foreground flex min-w-230 border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
          <span className="w-55">Type</span>
          <span className="flex-1">Id</span>
          <span className="w-21 text-right">Statuses</span>
          <span className="w-21 text-right">Actions</span>
          <span className="w-21 text-right">Sensors</span>
          <span className="w-24 pl-6">State</span>
          <span className="w-38 text-right">Manage</span>
        </div>

        {sensorTypeRegistry.map((type) => {
          const Icon = sensorIcon(type.icon);
          const count = sensorsOf(type.id);
          return (
            <div
              key={type.id}
              className={cn(
                "border-rule flex min-w-230 items-center border-b px-4 py-2.5 last:border-b-0",
                type.archived && "bg-surface-subtle",
              )}
            >
              <span className="flex w-55 min-w-0 items-center gap-2.25">
                <span className="bg-accent text-accent-foreground flex size-6.5 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-3.25" />
                </span>
                <span className="truncate text-[12.5px] leading-snug font-[450]">
                  {type.label}
                </span>
              </span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[11.5px]">
                {type.id}
              </span>
              <span className="text-neutral-foreground w-21 text-right font-mono text-[11.5px]">
                {type.statuses.length}
              </span>
              <span className="text-neutral-foreground w-21 text-right font-mono text-[11.5px]">
                {type.actions.length}
              </span>
              <span
                title={
                  count > 0
                    ? `${count} sensor${count === 1 ? "" : "s"} use this type, so it cannot be archived`
                    : "No sensors use this type"
                }
                className={cn(
                  "w-21 text-right font-mono text-[11.5px]",
                  count > 0
                    ? "text-neutral-foreground"
                    : "text-muted-foreground",
                )}
              >
                {count}
              </span>
              <span className="w-24 pl-6">
                <ToneBadge tone={type.archived ? "neutral" : "success"}>
                  {type.archived ? "archived" : "active"}
                </ToneBadge>
              </span>
              <span className="flex w-38 justify-end gap-1.5">
                <RowButton
                  title="Edit this type's statuses and actions"
                  onClick={() => setEditingId(type.id)}
                >
                  Edit
                </RowButton>
                {type.archived ? (
                  <RowButton
                    title="Bring this type back into the registry"
                    onClick={() => {
                      restoreSensorType(type.id);
                      toast.success(`${type.label} restored`);
                    }}
                  >
                    Restore
                  </RowButton>
                ) : (
                  <RowButton
                    danger
                    title={
                      count > 0
                        ? `${count} sensor${count === 1 ? " is" : "s are"} registered as ${type.label}`
                        : "Retire this type"
                    }
                    onClick={() => archive(type)}
                  >
                    Archive
                  </RowButton>
                )}
              </span>
            </div>
          );
        })}

        {sensorTypeRegistry.length === 0 && (
          <div className="text-muted-foreground px-4 py-10 text-center text-[12px]">
            The registry is empty — the Sensors page has nothing to render.
          </div>
        )}
      </div>

      <SensorTypeDrawer
        open={newOpen}
        editing={null}
        onOpenChange={setNewOpen}
        onSubmit={(draft) => addSensorType(draft)}
      />
      <SensorTypeDrawer
        open={Boolean(editing)}
        editing={editing}
        onOpenChange={(o) => !o && setEditingId(null)}
        onRemoveStatus={(statusId) =>
          editing
            ? removeSensorStatus(editing.id, statusId)
            : { ok: false, error: "No type open." }
        }
        onSubmit={(draft) =>
          editing
            ? updateSensorType(editing.id, draft)
            : { ok: false, error: "No type open." }
        }
      />
    </div>
  );
}

/** A status being edited. New rows have no id until the type is saved. */
type StatusDraft = SensorStatusDef & { isNew?: boolean };
type ActionDraft = SensorAction & { isNew?: boolean };

function SensorTypeDrawer({
  open,
  editing,
  onOpenChange,
  onSubmit,
  onRemoveStatus,
}: {
  open: boolean;
  editing: SensorTypeDef | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: Omit<SensorTypeDef, "id">) => RegistryResult;
  onRemoveStatus?: (statusId: string) => RegistryResult;
}) {
  const [label, setLabel] = React.useState("");
  const [icon, setIcon] = React.useState<SensorIconKey>("activity");
  const [statuses, setStatuses] = React.useState<StatusDraft[]>([]);
  const [actions, setActions] = React.useState<ActionDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reseed when the drawer opens
  React.useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? "");
    setIcon(editing?.icon ?? "activity");
    setStatuses(editing?.statuses.map((st) => ({ ...st })) ?? []);
    setActions(editing?.actions.map((a) => ({ ...a })) ?? []);
    setError(null);
  }, [open, editing?.id]);

  const idsTaken = statuses.map((st) => st.id);

  const addStatus = () => {
    const base = `status-${statuses.length + 1}`;
    setStatuses((prev) => [
      ...prev,
      {
        id: uniqueDraftId(base, idsTaken),
        label: "",
        tone: "neutral",
        isAlarm: false,
        isNew: true,
      },
    ]);
  };

  const addAction = () => {
    setActions((prev) => [
      ...prev,
      {
        id: uniqueDraftId(
          `action-${actions.length + 1}`,
          actions.map((a) => a.id),
        ),
        label: "",
        caption: "",
        resultStatus: statuses[0]?.id ?? "",
        allowedRoles: ["admin-manager", "ceo-super-admin"],
        isNew: true,
      },
    ]);
  };

  const dropStatus = (status: StatusDraft) => {
    // An existing status is the provider's call, not this form's — something
    // may be sitting in it right now.
    if (!status.isNew && onRemoveStatus) {
      const outcome = onRemoveStatus(status.id);
      if (!outcome.ok) {
        setError(outcome.error);
        // The drawer's error line sits below a long list, so a refusal
        // triggered near the top would otherwise happen off-screen.
        toast.error(outcome.error);
        return;
      }
    }
    setError(null);
    setStatuses((prev) => prev.filter((st) => st.id !== status.id));
    setActions((prev) =>
      prev.map((a) =>
        a.resultStatus === status.id
          ? {
              ...a,
              resultStatus: statuses.find((s) => s.id !== status.id)?.id ?? "",
            }
          : a,
      ),
    );
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit sensor type" : "New sensor type"}
      description={
        editing
          ? "Labels are always editable; ids are frozen so existing sensor records keep resolving."
          : "The id is generated from the name and cannot be changed afterwards."
      }
      submitLabel={editing ? "Save changes" : "Create type"}
      error={error}
      onSubmit={() => {
        // A freshly named status gets its slug now, and anything pointing at
        // its placeholder id has to follow it across.
        const cleaned = dedupeStatusIds(
          statuses.map(({ isNew, ...st }) => ({
            ...st,
            id: isNew && st.label.trim().length > 0 ? slugify(st.label) : st.id,
            label: st.label.trim(),
          })),
        );
        const remap = new Map(
          statuses.map((st, i) => [st.id, cleaned[i]?.id ?? st.id]),
        );
        const outcome = onSubmit({
          label: label.trim(),
          icon,
          statuses: cleaned,
          actions: actions.map(({ isNew, ...a }) => ({
            ...a,
            label: a.label.trim(),
            caption: a.caption.trim(),
            resultStatus: remap.get(a.resultStatus) ?? a.resultStatus,
          })),
          archived: editing?.archived,
        });
        if (!outcome.ok) {
          setError(outcome.error);
          return;
        }
        toast.success(
          editing
            ? `${label.trim()} updated`
            : `${label.trim()} added to the registry`,
        );
        onOpenChange(false);
      }}
    >
      <FormField label="Name">
        <TextInput
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Water leak detector"
        />
      </FormField>

      {editing && (
        <FormFieldLocked
          label="Id"
          value={<span className="font-mono">{editing.id}</span>}
          icon={<Lock className="text-muted-foreground size-3 shrink-0" />}
        />
      )}

      <FormField label="Icon">
        <div className="flex flex-wrap gap-1.5">
          {SENSOR_ICON_KEYS.map((key) => {
            const Icon = sensorIcon(key);
            const active = key === icon;
            return (
              <button
                key={key}
                type="button"
                title={key}
                onClick={() => setIcon(key)}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded border",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-neutral-foreground hover:border-primary",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            );
          })}
        </div>
      </FormField>

      <EditorSection
        label="Statuses"
        hint="The states a sensor of this type can report. One of them has to be the resting state."
        onAdd={addStatus}
        addLabel="Add status"
      >
        {statuses.map((st, i) => (
          <div
            key={st.id}
            className="border-divider bg-surface-subtle flex flex-col gap-1.5 rounded border px-2.25 py-2"
          >
            <div className="flex items-center gap-1.5">
              <TextInput
                value={st.label}
                placeholder="Status name"
                onChange={(e) =>
                  setStatuses((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <span className="w-26 shrink-0">
                <SelectInput
                  value={st.tone}
                  onChange={(e) =>
                    setStatuses((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, tone: e.target.value as Tone } : x,
                      ),
                    )
                  }
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </SelectInput>
              </span>
              <IconButton
                title="Remove this status"
                onClick={() => dropStatus(st)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CheckField
                label="Raises an alarm"
                checked={st.isAlarm}
                onChange={(v) =>
                  setStatuses((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, isAlarm: v } : x)),
                  )
                }
              />
              <CheckField
                label="Pulses"
                checked={Boolean(st.pulse)}
                onChange={(v) =>
                  setStatuses((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, pulse: v } : x)),
                  )
                }
              />
              {!st.isNew && (
                <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                  {st.id}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-30 shrink-0 text-[10.5px] leading-snug">
                Turns amber after
              </span>
              <input
                type="number"
                min={0}
                value={st.escalateAfterMinutes ?? ""}
                placeholder="—"
                onChange={(e) => {
                  const minutes = Number(e.target.value);
                  setStatuses((prev) =>
                    prev.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            escalateAfterMinutes:
                              e.target.value === "" || minutes <= 0
                                ? undefined
                                : minutes,
                            escalateTone:
                              e.target.value === "" || minutes <= 0
                                ? undefined
                                : (x.escalateTone ?? "warning"),
                          }
                        : x,
                    ),
                  );
                }}
                className="border-input focus:border-primary w-16 rounded border px-2 py-1.5 text-[11.5px] outline-none"
              />
              <span className="text-muted-foreground text-[10.5px]">
                minutes · optional
              </span>
            </div>
          </div>
        ))}
        {statuses.length === 0 && (
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            A type with no statuses cannot be saved.
          </p>
        )}
      </EditorSection>

      <EditorSection
        label="Actions"
        hint="What an operator can do to a sensor of this type, and who may do it."
        onAdd={addAction}
        addLabel="Add action"
        disabled={statuses.length === 0}
      >
        {actions.map((a, i) => (
          <div
            key={a.id}
            className="border-divider bg-surface-subtle flex flex-col gap-1.5 rounded border px-2.25 py-2"
          >
            <div className="flex items-center gap-1.5">
              <TextInput
                value={a.label}
                placeholder="Action name"
                onChange={(e) =>
                  setActions((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <IconButton
                title="Remove this action"
                onClick={() =>
                  setActions((prev) => prev.filter((_, j) => j !== i))
                }
              />
            </div>
            <TextInput
              value={a.caption}
              placeholder="What it does, shown under the label"
              onChange={(e) =>
                setActions((prev) =>
                  prev.map((x, j) =>
                    j === i ? { ...x, caption: e.target.value } : x,
                  ),
                )
              }
            />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-24 shrink-0 text-[10.5px] leading-snug">
                Moves it to
              </span>
              <SelectInput
                value={a.resultStatus}
                onChange={(e) =>
                  setActions((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, resultStatus: e.target.value } : x,
                    ),
                  )
                }
              >
                {statuses.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label || st.id}
                  </option>
                ))}
              </SelectInput>
            </div>
            <CheckField
              label="Requires a written reason"
              checked={Boolean(a.requiresNote)}
              onChange={(v) =>
                setActions((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, requiresNote: v } : x)),
                )
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground font-mono text-[10px] tracking-[0.06em] uppercase">
                Allowed
              </span>
              {ROLES.map((r) => (
                <CheckField
                  key={r}
                  label={roleLabel[r]}
                  checked={a.allowedRoles.includes(r)}
                  onChange={(v) =>
                    setActions((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              allowedRoles: v
                                ? [...x.allowedRoles, r]
                                : x.allowedRoles.filter((role) => role !== r),
                            }
                          : x,
                      ),
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {actions.length === 0 && (
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            No actions — sensors of this type report their state and nothing
            more.
          </p>
        )}
      </EditorSection>
    </FormDrawer>
  );
}

function EditorSection({
  label,
  hint,
  addLabel,
  disabled,
  onAdd,
  children,
}: {
  label: string;
  hint: string;
  addLabel: string;
  disabled?: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-divider flex flex-col gap-1.75 border-t pt-2.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground flex-1 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
          {label}
        </span>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? "Add a status first." : addLabel}
          onClick={onAdd}
          className={cn(
            "border-input bg-card text-neutral-foreground hover:border-primary flex cursor-pointer items-center gap-1 rounded border px-2 py-1.25 text-[10.5px] leading-none font-medium",
            disabled && "cursor-not-allowed opacity-45",
          )}
        >
          <Plus className="size-2.75" />
          {addLabel}
        </button>
      </div>
      <p className="text-muted-foreground text-[10.5px] leading-relaxed">
        {hint}
      </p>
      {children}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="text-neutral-foreground flex cursor-pointer items-center gap-1.25 text-[10.5px] leading-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary size-3 cursor-pointer"
      />
      {label}
    </label>
  );
}

function IconButton({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="border-input bg-card text-muted-foreground hover:border-danger/40 hover:text-danger-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded border"
    >
      <Trash2 className="size-3" />
    </button>
  );
}

function uniqueDraftId(base: string, taken: string[]): string {
  const slug = base.trim().length > 0 ? slugify(base) : "status";
  if (!taken.includes(slug)) return slug;
  let n = 2;
  while (taken.includes(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

/** Two rows named the same thing would collide; the provider refuses that. */
function dedupeStatusIds(list: SensorStatusDef[]): SensorStatusDef[] {
  const seen: string[] = [];
  return list.map((st) => {
    const id = uniqueDraftId(st.id, seen);
    seen.push(id);
    return { ...st, id };
  });
}
