"use client";

import { Link2, Lock } from "lucide-react";
import * as React from "react";
import { Hint } from "@/components/shared/hint";
import { Loader } from "@/components/shared/loader";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { withMinDuration } from "@/lib/pending";
import { cn } from "@/lib/utils";

/**
 * The right drawer for a record with its history and actions. Equipment
 * carries a photo and six actions and takes the wider 412px; a sensor is
 * narrower at 392px, the same width as a form drawer.
 */
export function DetailDrawer({
  open,
  onOpenChange,
  size = "wide",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: "wide" | "narrow";
  children: React.ReactNode;
}) {
  // On a phone the drawer is re-drawn as a bottom sheet — the same content,
  // reachable with a thumb.
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        className={cn(
          "border-border max-w-none gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-none",
          "data-[side=bottom]:max-h-[86vh] data-[side=bottom]:rounded-t-xl",
          "data-[side=right]:border-l data-[side=right]:shadow-[-8px_0_24px_rgba(17,19,24,0.12)]",
          size === "wide"
            ? "data-[side=right]:w-(--drawer-detail-w)"
            : "data-[side=right]:w-(--drawer-form-w)",
        )}
      >
        {isMobile && (
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="bg-input h-1 w-9 rounded-full" />
          </div>
        )}
        {/* The panel slid in and its contents were simply already there. The
            sections now arrive behind it, in the order you read them. */}
        <div key={String(open)} className="stagger-in contents">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Identity block: tag, status chip, an optional action, and the close control. */
export function DetailDrawerHeader({
  tag,
  chip,
  action,
  onClose,
  children,
}: {
  tag: string;
  chip?: React.ReactNode;
  action?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-divider border-b px-4.5 py-4">
      <div className="flex items-center gap-2.5">
        <SheetTitle className="text-accent-foreground font-mono text-[11px] font-medium">
          {tag}
        </SheetTitle>
        {chip}
        <div className="flex-1" />
        {action}
        <button
          type="button"
          title="Close"
          onClick={onClose}
          className="interactive focus-ring text-muted-foreground hover:text-foreground cursor-pointer px-0.5 text-[17px] leading-none"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

export function DetailDrawerSection({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border-divider border-b px-4.5 py-3.5", className)}>
      {label && (
        <div className="text-muted-foreground mb-2.5 font-mono text-[9.5px] tracking-[0.07em] uppercase">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

/** Two-column label/value grid used for a record's fixed fields. */
export function DetailMetaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-divider grid grid-cols-2 gap-3 border-b px-4.5 py-3.5">
      {children}
    </div>
  );
}

export function DetailMeta({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground font-mono text-[9.5px] tracking-[0.07em] uppercase">
        {label}
      </div>
      <div className={cn("mt-1.25 text-[12px] font-medium", tone)}>{value}</div>
    </div>
  );
}

/**
 * The cross-link between the two records that describe one physical device.
 * A fire detector is an EquipmentUnit (the asset) and an EnvironmentalSensor
 * (the live state); neither drawer duplicates the other's fields, it points
 * at it.
 */
export function SameDevicePanel({
  id,
  note,
  linkLabel,
  onOpen,
}: {
  id: string;
  note: string;
  /** e.g. "Sensors →" from equipment, "Equipment →" from a sensor. */
  linkLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="interactive focus-ring pressable border-divider bg-surface-subtle hover:bg-surface-hover block w-full cursor-pointer border-b px-4.5 py-3.25 text-left"
    >
      <div className="text-muted-foreground font-mono text-[9.5px] tracking-[0.07em] uppercase">
        Same physical device
      </div>
      <div className="mt-2.25 flex items-center gap-2.25">
        <Link2 className="text-muted-foreground size-3 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-accent-foreground font-mono text-[11.5px] leading-tight font-medium">
            {id}
          </div>
          <div className="text-muted-foreground mt-0.75 text-[10.5px] leading-snug">
            {note}
          </div>
        </div>
        <span className="text-accent-foreground shrink-0 text-[10.5px] leading-none font-medium">
          {linkLabel}
        </span>
      </div>
    </button>
  );
}

/**
 * One action in a drawer's action grid. A locked action stays on screen with
 * a padlock and the reason in its tooltip, rather than disappearing — the
 * design shows people what exists and why they can't reach it.
 */
export function DrawerAction({
  icon: Icon,
  label,
  caption,
  lockedReason,
  tone = "default",
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  caption?: string;
  lockedReason?: string;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  const locked = Boolean(lockedReason);
  return (
    // aria-disabled, not disabled: a disabled button takes no pointer events
    // and leaves the tab order, so the reason it is locked could be reached by
    // neither a mouse nor a keyboard — which is the padlock's whole job.
    <Hint text={lockedReason ?? caption}>
      <button
        type="button"
        aria-disabled={locked}
        onClick={() => !locked && onClick()}
        className={cn(
          "focus-ring interactive flex min-h-11 cursor-pointer flex-col items-start justify-center gap-1.25 rounded border px-2.5 py-2.25 text-left transition-colors md:min-h-0",
          locked
            ? "border-border cursor-not-allowed opacity-45"
            : tone === "danger"
              ? "border-danger/40 text-danger-foreground hover:bg-danger-muted"
              : "border-border hover:border-primary hover:bg-accent/40",
        )}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium">
          {locked ? <Lock className="size-3" /> : <Icon className="size-3" />}
          {label}
        </span>
        {caption && (
          <span className="text-muted-foreground text-[10px] leading-snug">
            {caption}
          </span>
        )}
      </button>
    </Hint>
  );
}

export function DrawerActionGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.75">{children}</div>;
}

/**
 * A form that stays inside the drawer it was opened from. The design puts
 * editing, recording a service and moving a unit in the record's own drawer —
 * stacking a second drawer on top would bury the record you are editing.
 */
export function DrawerInlineForm({
  title,
  description,
  submitLabel,
  onSubmit,
  onCancel,
  error,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  error?: string | null;
  children: React.ReactNode;
}) {
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const result = onSubmit();
    if (!(result instanceof Promise)) return;
    setSaving(true);
    try {
      await withMinDuration(result);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Rises in rather than appearing at the bottom of the drawer fully formed.
    //
    // CSS, not the library, even though an unfolding height would read better:
    // this is *entry*, which is the stylesheet's job here, and a motion
    // `initial` of `height: 0` is an inline style that persists until the
    // frame clock runs. On a form — functional content, not decoration — a
    // collapsed height is a worse failure than a missed animation.
    <form
      onSubmit={handleSubmit}
      className="animate-sb-rise bg-surface-subtle border-divider -mx-4.5 -mb-3.5 flex flex-col gap-2.25 border-t px-4.5 py-3.5"
    >
      <div className="text-muted-foreground font-mono text-[10px] font-medium tracking-[0.07em] uppercase">
        {title}
      </div>
      {description && (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {description}
        </p>
      )}
      {children}
      {error && (
        <p className="text-warning-foreground text-[11px] leading-relaxed">
          {error}
        </p>
      )}
      <div className="mt-0.5 flex gap-1.75">
        <button
          type="submit"
          disabled={saving}
          className="interactive focus-ring pressable border-primary bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border px-2 text-[11.5px] leading-none font-medium disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving && <Loader size="xs" />}
          {saving ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="interactive focus-ring pressable border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground min-h-9 cursor-pointer rounded border px-3 text-[11.5px] leading-none font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Small-caps field label used by the inline forms. */
export function DrawerField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the children, rendered inside this label
    <label className={cn("flex flex-col gap-1.25", className)}>
      <span className="text-muted-foreground font-mono text-[9.5px] font-medium tracking-[0.06em] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
