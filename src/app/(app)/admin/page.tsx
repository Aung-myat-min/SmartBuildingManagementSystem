"use client";

import {
  Building2,
  Camera,
  Lock,
  Search,
  Users as UsersIcon,
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
import { useAppState } from "@/lib/app-state";
import { countOpenRequests } from "@/lib/derive";
import { formatRelative } from "@/lib/format";
import {
  BUILDING_META,
  BUILDINGS,
  EQUIPMENT_UNITS,
  MANAGED_USERS,
  ROOMS,
} from "@/lib/mock-data";
import {
  canEditUser,
  canManageAccounts,
  canManageEstate,
  ESTATE_LOCK_REASON,
  roleLabel,
  userEditLockReason,
} from "@/lib/permissions";
import type { ManagedUser, Room, RoomType, UserRole } from "@/lib/types";
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

const ROLE_TONE: Record<UserRole, Tone> = {
  "office-staff": "neutral",
  "admin-manager": "info",
  "ceo-super-admin": "warning",
};

interface LocalBuilding {
  id: string;
  name: string;
  code: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdministrationPage() {
  const { role, setRole, requests } = useAppState();
  const confirm = useConfirm();

  const mayEstate = canManageEstate(role);
  const mayAccounts = canManageAccounts(role);

  // An Admin Manager lands on User Accounts with Buildings padlocked.
  const [tab, setTab] = React.useState<"buildings" | "users">(
    mayEstate ? "buildings" : "users",
  );
  React.useEffect(() => {
    if (!mayEstate) setTab("users");
  }, [mayEstate]);

  const [buildings, setBuildings] = React.useState<LocalBuilding[]>(() =>
    BUILDINGS.map((b) => ({
      id: b.id,
      name: b.name,
      code: BUILDING_META[b.id]?.code ?? "",
    })),
  );
  const [rooms, setRooms] = React.useState<Room[]>(ROOMS);
  const [users, setUsers] = React.useState<ManagedUser[]>(MANAGED_USERS);
  const [selectedBuildingId, setSelectedBuildingId] = React.useState(
    BUILDINGS[0]?.id ?? "",
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
        actionLabel="Switch to CEO for this demo"
        onAction={() => setRole("ceo-super-admin")}
      />
    );
  }

  const tabNote = mayEstate
    ? "Buildings and rooms shape everything the other pages count."
    : "Admin Managers manage accounts; the estate itself is the CEO's.";
  const tabCount =
    tab === "buildings"
      ? `${buildings.length} SITES · ${rooms.length} ROOMS`
      : `${users.length} ACCOUNTS`;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex items-center gap-2 rounded-[5px] border px-3 py-2.25">
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
          setBuildings={setBuildings}
          rooms={rooms}
          setRooms={setRooms}
          users={users}
          selectedId={selectedBuildingId}
          onSelect={setSelectedBuildingId}
          openRequestsFor={(id) => countOpenRequests(requests, id)}
          confirm={confirm}
        />
      ) : (
        <UsersTab
          actorRole={role}
          users={users}
          setUsers={setUsers}
          buildings={buildings}
          confirm={confirm}
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
  setBuildings,
  rooms,
  setRooms,
  users,
  selectedId,
  onSelect,
  openRequestsFor,
  confirm,
}: {
  buildings: LocalBuilding[];
  setBuildings: React.Dispatch<React.SetStateAction<LocalBuilding[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  users: ManagedUser[];
  selectedId: string;
  onSelect: (id: string) => void;
  openRequestsFor: (buildingId: string) => number;
  confirm: ConfirmFn;
}) {
  const [newOpen, setNewOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LocalBuilding | null>(null);
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

  const addRoom = () => {
    if (!selected || newRoomName.trim().length === 0) return;
    setRooms((prev) => [
      ...prev,
      {
        id: `r-${selected.id}-${newRoomName.trim().toLowerCase().replace(/\s+/g, "-")}`,
        buildingId: selected.id,
        roomNumber: newRoomName.trim(),
        type: newRoomType,
        floor: newRoomFloor,
      },
    ]);
    toast.success(`${newRoomName.trim()} added to ${selected.name}`);
    setNewRoomName("");
  };

  const removeRoom = async (room: Room) => {
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
    setRooms((prev) => prev.filter((r) => r.id !== room.id));
    toast.success(`${room.roomNumber} removed`);
  };

  const deleteBuilding = async () => {
    if (!selected) return;
    const roomCount = buildingRooms.length;
    const devices = devicesIn(selected.id);
    const result = await confirm({
      title: `Delete ${selected.name}?`,
      body: `${selected.name} and everything recorded under it is removed.`,
      note: `Its ${roomCount} room${roomCount === 1 ? "" : "s"} and ${devices} device${devices === 1 ? "" : "s"} stop reporting, and ${staffIn(selected.id)} account${staffIn(selected.id) === 1 ? "" : "s"} lose their building scope.`,
      tone: "danger",
      confirmLabel: "Delete building",
      requireReason: true,
    });
    if (!result.confirmed) return;
    setBuildings((prev) => prev.filter((b) => b.id !== selected.id));
    setRooms((prev) => prev.filter((r) => r.buildingId !== selected.id));
    onSelect(buildings.find((b) => b.id !== selected.id)?.id ?? "");
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
          className="bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground cursor-pointer rounded-[5px] border border-dashed border-[#b9bec8] py-2.75 text-[11.5px] leading-none font-medium"
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
                  onClick={deleteBuilding}
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

          <div className="bg-surface-subtle border-divider text-muted-foreground flex border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
            <span className="flex-1">Room</span>
            <span className="w-30">Type</span>
            <span className="w-17.5">Floor</span>
            <span className="w-22 text-right">Devices</span>
            <span className="w-30 text-right">Actions</span>
          </div>
          {buildingRooms.map((r) => (
            <div
              key={r.id}
              className="border-rule flex items-center border-b px-4 py-2.5"
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
                  onClick={() => removeRoom(r)}
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
              onClick={addRoom}
              className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded border px-3.25 py-2 text-[11.5px] leading-none font-medium"
            >
              Add room
            </button>
          </div>
        </div>
      )}

      <NewBuildingDrawer
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={(name, code) => {
          const id = `b-${Date.now()}`;
          setBuildings((prev) => [...prev, { id, name, code }]);
          onSelect(id);
          toast.success(`${name} added to the estate`);
        }}
      />
      <EditBuildingDrawer
        building={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          setBuildings((prev) =>
            prev.map((b) => (b.id === next.id ? next : b)),
          );
          toast.success(`${next.name} updated`);
        }}
      />
      <EditRoomDrawer
        room={editingRoom}
        onClose={() => setEditingRoom(null)}
        onSave={(next) => {
          setRooms((prev) => prev.map((r) => (r.id === next.id ? next : r)));
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
  building: LocalBuilding | null;
  onClose: () => void;
  onSave: (next: LocalBuilding) => void;
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
  users,
  setUsers,
  buildings,
  confirm,
}: {
  actorRole: UserRole;
  users: ManagedUser[];
  setUsers: React.Dispatch<React.SetStateAction<ManagedUser[]>>;
  buildings: LocalBuilding[];
  confirm: ConfirmFn;
}) {
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
    setUsers((prev) =>
      prev.map((x) =>
        x.uid === u.uid
          ? { ...x, status: suspending ? "suspended" : "active" }
          : x,
      ),
    );
    toast.success(`${u.name} ${suspending ? "suspended" : "restored"}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-card flex items-center gap-2 rounded-[5px] border px-3 py-2.25">
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

      <div className="border-border bg-card overflow-hidden rounded-[5px] border">
        <div className="bg-surface-subtle border-divider text-muted-foreground flex border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
          <span className="w-47.5">Name</span>
          <span className="flex-1">Email</span>
          <span className="w-37.5">Role</span>
          <span className="w-40">Assigned building</span>
          <span className="w-23">Status</span>
          <span className="w-26 text-right">Last active</span>
          <span className="w-35 text-right">Actions</span>
        </div>

        {filtered.map((u) => {
          const editable = canEditUser(actorRole, u.role, u.isSelf);
          const lockReason = u.isSelf
            ? "Every estate needs at least one Super Admin — this account cannot edit itself."
            : userEditLockReason(actorRole, u.role);
          return (
            <div
              key={u.uid}
              className={cn(
                "border-rule flex items-center border-b px-4 py-2.5",
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

        {filtered.length === 0 && (
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
        onSave={(u) => {
          setUsers((prev) => [...prev, u]);
          toast.success(`${u.name} can now sign in`);
        }}
      />
      <UserDrawer
        actorRole={actorRole}
        open={Boolean(editing)}
        editing={editing}
        buildings={buildings}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(u) => {
          setUsers((prev) => prev.map((x) => (x.uid === u.uid ? u : x)));
          toast.success(`${u.name} updated`);
        }}
      />
    </div>
  );
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
  buildings: LocalBuilding[];
  onOpenChange: (open: boolean) => void;
  onSave: (user: ManagedUser) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRoleValue] = React.useState<UserRole>("office-staff");
  const [buildingId, setBuildingId] = React.useState(buildings[0]?.id ?? "");
  const [error, setError] = React.useState<string | null>(null);

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
      submitLabel={editing ? "Save changes" : "Create account"}
      error={error}
      onSubmit={() => {
        if (name.trim().length === 0) {
          setError("An account needs a name.");
          return;
        }
        if (!email.includes("@")) {
          setError("Enter the university address for this account.");
          return;
        }
        onSave({
          uid: editing?.uid ?? `u-${Date.now()}`,
          name: name.trim(),
          email: email.trim(),
          role,
          buildingId: buildingLocked ? undefined : buildingId,
          status: editing?.status ?? "active",
          lastActiveAt: editing?.lastActiveAt ?? new Date().toISOString(),
          isSelf: editing?.isSelf,
        });
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
