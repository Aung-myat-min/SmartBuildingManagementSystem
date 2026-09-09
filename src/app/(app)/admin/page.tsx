"use client";

import { Building2, Lock, Search, Users as UsersIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AccessDenied } from "@/components/shared/access-denied";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState } from "@/lib/app-state";
import { formatRelative } from "@/lib/format";
import {
  BUILDING_META,
  BUILDINGS,
  MANAGED_USERS,
  ROOMS,
} from "@/lib/mock-data";
import { canAccessAdministration, roleLabel } from "@/lib/permissions";
import type { ManagedUser, Room, RoomType, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LocalBuilding {
  id: string;
  name: string;
  code: string;
}

const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  lecture: "Lecture",
  lab: "Lab",
  office: "Office",
  plant: "Plant",
  common: "Common",
};
const ROLE_OPTIONS: UserRole[] = ["office-staff", "admin-manager"];
const ALL_ROLE_OPTIONS: UserRole[] = [
  "office-staff",
  "admin-manager",
  "ceo-super-admin",
];
const ROLE_TONE: Record<UserRole, Tone> = {
  "office-staff": "neutral",
  "admin-manager": "info",
  "ceo-super-admin": "success",
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
  const { role, setRole } = useAppState();

  const [buildings, setBuildings] = React.useState<LocalBuilding[]>(
    BUILDINGS.map((b) => ({
      id: b.id,
      name: b.name,
      code: BUILDING_META[b.id]?.code ?? b.id.toUpperCase(),
    })),
  );
  const [rooms, setRooms] = React.useState<Room[]>(ROOMS);
  const [users, setUsers] = React.useState<ManagedUser[]>(MANAGED_USERS);
  const [selectedBuildingId, setSelectedBuildingId] = React.useState(
    buildings[0]?.id ?? "",
  );
  const [buildingSheet, setBuildingSheet] = React.useState<
    { mode: "create" } | { mode: "edit"; building: LocalBuilding } | null
  >(null);
  const [roomSheet, setRoomSheet] = React.useState<
    { mode: "create" } | { mode: "edit"; room: Room } | null
  >(null);
  const [userSheet, setUserSheet] = React.useState<
    { mode: "create" } | { mode: "edit"; user: ManagedUser } | null
  >(null);
  const confirm = useConfirm();

  if (!canAccessAdministration(role)) {
    return (
      <AccessDenied
        title="Administration is restricted"
        body={
          <>
            Buildings, rooms and user accounts are managed by the CEO / Super
            Admin. Your role is <strong>{roleLabel[role]}</strong>.
          </>
        }
        actionLabel="Switch to CEO for this demo"
        onAction={() => setRole("ceo-super-admin")}
      />
    );
  }

  const selectedBuilding =
    buildings.find((b) => b.id === selectedBuildingId) ?? buildings[0];
  const buildingRooms = rooms.filter(
    (r) => r.buildingId === selectedBuilding?.id,
  );
  const canDeleteBuilding = buildingRooms.length === 0;

  const deleteBuilding = async (b: LocalBuilding) => {
    const result = await confirm({
      title: "Delete this building?",
      body: (
        <>
          This removes <strong>{b.name}</strong> and everything under it. This
          cannot be undone.
        </>
      ),
      tone: "danger",
      confirmLabel: "Delete building",
      requireReason: true,
    });
    if (!result.confirmed) return;
    setBuildings((prev) => prev.filter((x) => x.id !== b.id));
    if (selectedBuildingId === b.id)
      setSelectedBuildingId(buildings.find((x) => x.id !== b.id)?.id ?? "");
    toast.success(`${b.name} deleted`);
  };

  const removeRoom = async (r: Room) => {
    const result = await confirm({
      title: "Remove this room?",
      body: <>{r.roomNumber} will be removed from the estate.</>,
      tone: "warning",
      confirmLabel: "Remove room",
    });
    if (!result.confirmed) return;
    setRooms((prev) => prev.filter((x) => x.id !== r.id));
    toast.success(`${r.roomNumber} removed`);
  };

  const toggleUserStatus = async (u: ManagedUser) => {
    const next = u.status === "active" ? "suspended" : "active";
    const result = await confirm({
      title:
        next === "suspended"
          ? "Suspend this account?"
          : "Reactivate this account?",
      body: (
        <>
          {u.name} ({u.email})
        </>
      ),
      tone: next === "suspended" ? "warning" : "info",
      confirmLabel: next === "suspended" ? "Suspend" : "Reactivate",
    });
    if (!result.confirmed) return;
    setUsers((prev) =>
      prev.map((x) => (x.uid === u.uid ? { ...x, status: next } : x)),
    );
    toast.success(
      `${u.name} ${next === "suspended" ? "suspended" : "reactivated"}`,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="buildings">
        <div className="flex items-center gap-3">
          <TabsList>
            <TabsTrigger value="buildings" className="gap-1.5">
              <Building2 className="size-3.5" /> Buildings
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <UsersIcon className="size-3.5" /> User Accounts
            </TabsTrigger>
          </TabsList>
          <span className="text-muted-foreground text-[11px]">
            Full control — you are signed in as CEO / Super Admin.
          </span>
        </div>

        <TabsContent value="buildings">
          <TabsPanelBuildings
            buildings={buildings}
            selectedBuilding={selectedBuilding}
            buildingRooms={buildingRooms}
            canDeleteBuilding={canDeleteBuilding}
            onSelect={setSelectedBuildingId}
            onAddBuilding={() => setBuildingSheet({ mode: "create" })}
            onEditBuilding={(b) =>
              setBuildingSheet({ mode: "edit", building: b })
            }
            onDeleteBuilding={deleteBuilding}
            onAddRoom={() => setRoomSheet({ mode: "create" })}
            onEditRoom={(r) => setRoomSheet({ mode: "edit", room: r })}
            onRemoveRoom={removeRoom}
          />
        </TabsContent>

        <TabsContent value="users">
          <TabsPanelUsers
            users={users}
            buildings={buildings}
            onNew={() => setUserSheet({ mode: "create" })}
            onEdit={(u) => setUserSheet({ mode: "edit", user: u })}
            onToggleStatus={toggleUserStatus}
          />
        </TabsContent>
      </Tabs>

      <BuildingSheet
        state={buildingSheet}
        onClose={() => setBuildingSheet(null)}
        onSave={(b) => {
          if (buildingSheet?.mode === "edit") {
            setBuildings((prev) => prev.map((x) => (x.id === b.id ? b : x)));
          } else {
            setBuildings((prev) => [...prev, b]);
            setSelectedBuildingId(b.id);
          }
          toast.success(`${b.name} saved`);
        }}
      />

      <RoomSheet
        state={roomSheet}
        buildingId={selectedBuilding?.id ?? ""}
        onClose={() => setRoomSheet(null)}
        onSave={(r) => {
          if (roomSheet?.mode === "edit") {
            setRooms((prev) => prev.map((x) => (x.id === r.id ? r : x)));
          } else {
            setRooms((prev) => [...prev, r]);
          }
          toast.success(`${r.roomNumber} saved`);
        }}
      />

      <UserSheet
        state={userSheet}
        buildings={buildings}
        onClose={() => setUserSheet(null)}
        onSave={(u) => {
          if (userSheet?.mode === "edit") {
            setUsers((prev) => prev.map((x) => (x.uid === u.uid ? u : x)));
          } else {
            setUsers((prev) => [...prev, u]);
          }
          toast.success(`${u.name} saved`);
        }}
      />
    </div>
  );
}

function TabsPanelBuildings({
  buildings,
  selectedBuilding,
  buildingRooms,
  canDeleteBuilding,
  onSelect,
  onAddBuilding,
  onEditBuilding,
  onDeleteBuilding,
  onAddRoom,
  onEditRoom,
  onRemoveRoom,
}: {
  buildings: LocalBuilding[];
  selectedBuilding?: LocalBuilding;
  buildingRooms: Room[];
  canDeleteBuilding: boolean;
  onSelect: (id: string) => void;
  onAddBuilding: () => void;
  onEditBuilding: (b: LocalBuilding) => void;
  onDeleteBuilding: (b: LocalBuilding) => void;
  onAddRoom: () => void;
  onEditRoom: (r: Room) => void;
  onRemoveRoom: (r: Room) => void;
}) {
  return (
    <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[308px_1fr]">
      <div className="flex flex-col gap-2">
        {buildings.map((b) => {
          const count = buildingRoomCount(b.id);
          const active = selectedBuilding?.id === b.id;
          return (
            <button
              type="button"
              key={b.id}
              onClick={() => onSelect(b.id)}
              className={cn(
                "border-border hover:border-primary rounded-md border border-l-[3px] p-3 text-left transition-colors",
                active && "border-primary bg-accent/40",
              )}
              style={{
                borderLeftColor: active
                  ? "var(--color-primary)"
                  : "var(--color-border)",
              }}
            >
              <div className="text-[12.5px] font-semibold">{b.name}</div>
              <div className="text-muted-foreground mt-0.5 font-mono text-[10px] tracking-wider">
                {b.code}
              </div>
              <div className="text-muted-foreground mt-1.5 font-mono text-[10.5px]">
                {count} rooms
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAddBuilding}
          className="hover:border-primary hover:text-info-foreground rounded-md border border-dashed border-[#b9bec8] p-2.5 text-[12px] font-medium dark:border-border"
        >
          + Add building
        </button>
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        {selectedBuilding ? (
          <>
            <div className="border-border flex items-center gap-2 border-b px-4 py-3">
              <div>
                <div className="text-[13px] font-semibold">
                  {selectedBuilding.name}
                </div>
                <div className="text-muted-foreground font-mono text-[10.5px]">
                  {selectedBuilding.code} · {buildingRooms.length} rooms
                </div>
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEditBuilding(selectedBuilding)}
              >
                Edit building
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canDeleteBuilding}
                title={
                  canDeleteBuilding
                    ? "Delete this building and everything under it"
                    : "Remove all rooms before deleting"
                }
                onClick={() => onDeleteBuilding(selectedBuilding)}
                className="border-danger/40 text-danger-foreground"
              >
                Delete
              </Button>
            </div>
            <div className="bg-surface-subtle border-border text-muted-foreground flex border-b px-4 py-2 font-mono text-[10px] tracking-wider">
              <span className="flex-1">ROOM</span>
              <span className="w-24">TYPE</span>
              <span className="w-14">FLOOR</span>
              <span className="w-20 text-right">DEVICES</span>
              <span className="w-28 text-right">ACTIONS</span>
            </div>
            {buildingRooms.length === 0 && (
              <EmptyState className="m-4">No rooms yet.</EmptyState>
            )}
            {buildingRooms.map((r) => (
              <div
                key={r.id}
                className="border-border flex items-center border-b px-4 py-2.5 text-[12px] last:border-b-0"
              >
                <span className="flex-1 truncate">{r.roomNumber}</span>
                <span className="text-foreground/70 w-24">
                  {ROOM_TYPE_LABEL[r.type]}
                </span>
                <span className="text-muted-foreground w-14 font-mono">
                  {r.floor}
                </span>
                <span className="text-muted-foreground w-20 text-right font-mono">
                  —
                </span>
                <span className="flex w-28 justify-end gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onEditRoom(r)}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveRoom(r)}
                    className="text-danger-foreground hover:underline"
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddRoom}
              className="text-primary bg-surface-subtle hover:bg-surface-hover px-4 py-2.5 text-left text-[12px] font-medium"
            >
              + Add room
            </button>
          </>
        ) : (
          <EmptyState className="m-4">Select a building.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function buildingRoomCount(buildingId: string) {
  return ROOMS.filter((r) => r.buildingId === buildingId).length;
}

function TabsPanelUsers({
  users,
  buildings,
  onNew,
  onEdit,
  onToggleStatus,
}: {
  users: ManagedUser[];
  buildings: LocalBuilding[];
  onNew: () => void;
  onEdit: (u: ManagedUser) => void;
  onToggleStatus: (u: ManagedUser) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | UserRole>("all");

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${u.name} ${u.email} ${u.buildingId ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="mt-3.5 flex flex-col gap-3.5">
      <Card className="flex-row flex-wrap items-center gap-2 p-2.5">
        <div className="border-input focus-within:border-primary relative min-w-32 flex-1 rounded-md border">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or building"
            className="w-full bg-transparent py-1.5 pr-3 pl-8 text-[12px] outline-none"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) =>
            setRoleFilter((v as typeof roleFilter) ?? "all")
          }
        >
          <SelectTrigger size="sm" className="text-[12px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ALL_ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {roleLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="bg-border h-5.5 w-px" />
        <ToneBadge tone="neutral">{filtered.length} accounts shown</ToneBadge>
        <div className="flex-1" />
        <Button size="sm" onClick={onNew}>
          + New account
        </Button>
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="bg-surface-subtle border-border text-muted-foreground flex border-b px-4 py-2 font-mono text-[10px] tracking-wider">
          <span className="w-44">NAME</span>
          <span className="flex-1">EMAIL</span>
          <span className="w-32">ROLE</span>
          <span className="w-32">ASSIGNED BUILDING</span>
          <span className="w-20">STATUS</span>
          <span className="w-22 text-right">LAST ACTIVE</span>
          <span className="w-32 text-right">ACTIONS</span>
        </div>
        {filtered.length === 0 && (
          <EmptyState className="m-4">
            No accounts match this search.
          </EmptyState>
        )}
        {filtered.map((u) => (
          <div
            key={u.uid}
            className="border-border flex items-center border-b px-4 py-2.5 text-[12px] last:border-b-0"
          >
            <span className="flex w-44 items-center gap-2 truncate">
              <Avatar className="size-6.5">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                  {initials(u.name)}
                </AvatarFallback>
              </Avatar>
              {u.name}
            </span>
            <span className="text-muted-foreground flex-1 truncate font-mono text-[11px]">
              {u.email}
            </span>
            <span className="w-32">
              <ToneBadge tone={ROLE_TONE[u.role]}>
                {roleLabel[u.role]}
              </ToneBadge>
            </span>
            <span className="text-foreground/70 w-32 truncate">
              {u.buildingId
                ? buildings.find((b) => b.id === u.buildingId)?.name
                : "All"}
            </span>
            <span className="w-20">
              <ToneBadge tone={u.status === "active" ? "success" : "neutral"}>
                {u.status === "active" ? "ACTIVE" : "SUSPENDED"}
              </ToneBadge>
            </span>
            <span className="text-muted-foreground w-22 text-right text-[11px]">
              {formatRelative(u.lastActiveAt)}
            </span>
            <span className="flex w-32 justify-end gap-2.5 text-[11px]">
              <button
                type="button"
                onClick={() => onEdit(u)}
                disabled={u.isSelf}
                className={cn(
                  "flex items-center gap-1",
                  u.isSelf
                    ? "text-muted-foreground cursor-not-allowed"
                    : "text-primary hover:underline",
                )}
              >
                {u.isSelf && <Lock className="size-2.5" />} Edit
              </button>
              <button
                type="button"
                onClick={() => onToggleStatus(u)}
                disabled={u.isSelf}
                className={cn(
                  u.isSelf
                    ? "text-muted-foreground cursor-not-allowed"
                    : u.status === "active"
                      ? "text-warning-foreground hover:underline"
                      : "text-primary hover:underline",
                )}
              >
                {u.status === "active" ? "Suspend" : "Activate"}
              </button>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function BuildingSheet({
  state,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; building: LocalBuilding } | null;
  onClose: () => void;
  onSave: (b: LocalBuilding) => void;
}) {
  const editing = state?.mode === "edit" ? state.building : undefined;
  const [name, setName] = React.useState(editing?.name ?? "");
  const [code, setCode] = React.useState(editing?.code ?? "");

  React.useEffect(() => {
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
  }, [editing]);

  return (
    <Sheet open={!!state} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-98">
        <SheetHeader>
          <SheetTitle className="font-mono text-[11px] tracking-wider uppercase">
            {state?.mode === "edit" ? "Edit building" : "New building"}
          </SheetTitle>
        </SheetHeader>
        {state?.mode === "create" && (
          <p className="text-muted-foreground px-4 text-[11.5px] leading-relaxed">
            A new site starts empty. Add its rooms next, then move or install
            equipment into them.
          </p>
        )}
        <div className="flex flex-col gap-3.5 px-4">
          <FieldLabel label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Building name"
            />
          </FieldLabel>
          <FieldLabel label="Site code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SITE D"
              className="font-mono"
            />
          </FieldLabel>
        </div>
        <div className="mt-2 flex gap-2 px-4">
          <Button
            className="flex-1"
            disabled={!name.trim()}
            onClick={() => {
              onSave({
                id: editing?.id ?? `b-${Date.now()}`,
                name: name.trim(),
                code: code.trim() || "SITE",
              });
              onClose();
            }}
          >
            {state?.mode === "edit" ? "Save changes" : "Create"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoomSheet({
  state,
  buildingId,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; room: Room } | null;
  buildingId: string;
  onClose: () => void;
  onSave: (r: Room) => void;
}) {
  const editing = state?.mode === "edit" ? state.room : undefined;
  const [name, setName] = React.useState(editing?.roomNumber ?? "");
  const [type, setType] = React.useState<RoomType>(editing?.type ?? "lecture");
  const [floor, setFloor] = React.useState(editing?.floor ?? "G");

  React.useEffect(() => {
    setName(editing?.roomNumber ?? "");
    setType(editing?.type ?? "lecture");
    setFloor(editing?.floor ?? "G");
  }, [editing]);

  return (
    <Sheet open={!!state} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-98">
        <SheetHeader>
          <SheetTitle className="font-mono text-[11px] tracking-wider uppercase">
            {state?.mode === "edit" ? "Edit room" : "Add room"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3.5 px-4">
          <FieldLabel label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room name or number"
            />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Type">
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as RoomType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROOM_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
            <FieldLabel label="Floor">
              <Select value={floor} onValueChange={(v) => v && setFloor(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["G", "1", "2", "3"].map((f) => (
                    <SelectItem key={f} value={f}>
                      Floor {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
          </div>
        </div>
        <div className="mt-2 flex gap-2 px-4">
          <Button
            className="flex-1"
            disabled={!name.trim()}
            onClick={() => {
              onSave({
                id: editing?.id ?? `r-${Date.now()}`,
                buildingId,
                roomNumber: name.trim(),
                type,
                floor,
              });
              onClose();
            }}
          >
            {state?.mode === "edit" ? "Save changes" : "Add room"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function UserSheet({
  state,
  buildings,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; user: ManagedUser } | null;
  buildings: LocalBuilding[];
  onClose: () => void;
  onSave: (u: ManagedUser) => void;
}) {
  const editing = state?.mode === "edit" ? state.user : undefined;
  const [name, setName] = React.useState(editing?.name ?? "");
  const [email, setEmail] = React.useState(editing?.email ?? "");
  const [role, setRole] = React.useState<UserRole>(
    editing?.role ?? "office-staff",
  );
  const [buildingId, setBuildingId] = React.useState(
    editing?.buildingId ?? buildings[0]?.id ?? "",
  );

  React.useEffect(() => {
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setRole(editing?.role ?? "office-staff");
    setBuildingId(editing?.buildingId ?? buildings[0]?.id ?? "");
  }, [editing, buildings]);

  return (
    <Sheet open={!!state} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-98">
        <SheetHeader>
          <SheetTitle className="font-mono text-[11px] tracking-wider uppercase">
            {state?.mode === "edit" ? "Edit account" : "New account"}
          </SheetTitle>
        </SheetHeader>
        {state?.mode === "create" && (
          <p className="text-muted-foreground px-4 text-[11.5px]">
            Creates an Office Staff or Admin Manager account.
          </p>
        )}
        <div className="flex flex-col gap-3.5 px-4">
          <FieldLabel label="Full name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aye Chan"
            />
          </FieldLabel>
          <FieldLabel label="Email">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@university.edu"
              className="font-mono"
            />
          </FieldLabel>
          <FieldLabel label="Role">
            <Select
              value={role}
              onValueChange={(v) => v && setRole(v as UserRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(state?.mode === "edit" ? ALL_ROLE_OPTIONS : ROLE_OPTIONS).map(
                  (r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel[r]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </FieldLabel>
          {role !== "ceo-super-admin" && (
            <FieldLabel label="Assigned building">
              <Select
                value={buildingId}
                onValueChange={(v) => v && setBuildingId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
          )}
        </div>
        <div className="mt-2 flex gap-2 px-4">
          <Button
            className="flex-1"
            disabled={!name.trim() || !email.trim()}
            onClick={() => {
              onSave({
                uid: editing?.uid ?? `u-${Date.now()}`,
                name: name.trim(),
                email: email.trim(),
                role,
                buildingId: role === "ceo-super-admin" ? undefined : buildingId,
                status: editing?.status ?? "active",
                lastActiveAt: editing?.lastActiveAt ?? new Date().toISOString(),
              });
              onClose();
            }}
          >
            {state?.mode === "edit" ? "Save changes" : "Create account"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
