"use client";

// The sensor type registry.
//
// Lives beside the devices it describes rather than in Administration: a new
// kind of device arriving on the network is a Sensors-page concern, and it
// changes no buildings and no accounts.
//
// Types are never deleted — one still named by a sensor record has to keep
// resolving a label — so retiring one archives it, and the guards live in the
// provider rather than here.

import { Lock, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { useConfirm } from "@/components/shared/confirm-dialog";
import {
  FormDrawer,
  FormField,
  FormFieldLocked,
} from "@/components/shared/form-drawer";
import { RowButton, SelectInput, TextInput } from "@/components/shared/inputs";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { type RegistryResult, slugify, useAppState } from "@/lib/app-state";
import { SENSOR_ICON_KEYS, sensorIcon } from "@/lib/icons";
import { roleLabel } from "@/lib/permissions";
import type {
  SensorAction,
  SensorIconKey,
  SensorStatusDef,
  SensorTypeDef,
  UserRole,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ConfirmFn = ReturnType<typeof useConfirm>;

const TONES: Tone[] = ["success", "warning", "danger", "info", "neutral"];
const ROLES: UserRole[] = ["office-staff", "admin-manager", "ceo-super-admin"];

export function SensorTypeRegistry({ confirm }: { confirm: ConfirmFn }) {
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
    const outcome = await archiveSensorType(type.id);
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
          className="interactive focus-ring pressable border-primary bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer rounded border px-3.5 py-2 text-[11.5px] leading-none font-medium"
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
                    onClick={async () => {
                      const outcome = await restoreSensorType(type.id);
                      if (!outcome.ok) {
                        toast.error(outcome.error);
                        return;
                      }
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
        onRemoveStatus={async (statusId) =>
          editing
            ? await removeSensorStatus(editing.id, statusId)
            : { ok: false, error: "No type open." }
        }
        onSubmit={async (draft) =>
          editing
            ? await updateSensorType(editing.id, draft)
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
  onSubmit: (draft: Omit<SensorTypeDef, "id">) => Promise<RegistryResult>;
  onRemoveStatus?: (statusId: string) => Promise<RegistryResult>;
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

  const dropStatus = async (status: StatusDraft) => {
    // An existing status is the provider's call, not this form's — something
    // may be sitting in it right now.
    if (!status.isNew && onRemoveStatus) {
      const outcome = await onRemoveStatus(status.id);
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
      onSubmit={async () => {
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
        const outcome = await onSubmit({
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
                  "focus-ring interactive flex size-8 cursor-pointer items-center justify-center rounded border",
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
                className="interactive focus:ring-3 focus:ring-primary/15 border-input focus:border-primary w-16 rounded border px-2 py-1.5 text-[11.5px] outline-none"
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
            "interactive focus-ring pressable border-input bg-card text-neutral-foreground hover:border-primary flex cursor-pointer items-center gap-1 rounded border px-2 py-1.25 text-[10.5px] leading-none font-medium",
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
      className="interactive focus-ring pressable border-input bg-card text-muted-foreground hover:border-danger/40 hover:text-danger-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded border"
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
