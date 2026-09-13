"use client";

import { Link2, Lock } from "lucide-react";
import type * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The 412px right drawer — wider than the form drawer because it carries a
 * record's history and actions rather than a handful of fields. Equipment
 * units and sensors both open here.
 */
export function DetailDrawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="border-border max-w-none data-[side=right]:w-(--drawer-detail-w) gap-0 overflow-y-auto border-l p-0 shadow-[-8px_0_24px_rgba(17,19,24,0.12)] data-[side=right]:sm:max-w-none"
      >
        {children}
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
          className="text-muted-foreground hover:text-foreground cursor-pointer px-0.5 text-[17px] leading-none"
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
      className="border-divider bg-surface-subtle hover:bg-surface-hover block w-full cursor-pointer border-b px-4.5 py-3.25 text-left"
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
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      title={lockedReason ?? caption}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-1.25 rounded border px-2.5 py-2.25 text-left transition-colors",
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
  );
}

export function DrawerActionGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.75">{children}</div>;
}
