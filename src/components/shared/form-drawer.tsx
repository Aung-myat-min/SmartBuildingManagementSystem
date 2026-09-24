"use client";

import * as React from "react";
import { Spinner } from "@/components/shared/spinner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { withMinDuration } from "@/lib/pending";
import { cn } from "@/lib/utils";

/**
 * The 392px right drawer. Anything with fields opens here, so a form never
 * changes shape between pages. Decisions go to the centred confirm modal
 * instead — the only field that belongs there is the required reason.
 */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel = "Cancel",
  onSubmit,
  error,
  submitDisabled,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown as the drawer's small-caps kicker, e.g. "NEW BUILDING". */
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  cancelLabel?: string;
  /**
   * May be async. While it is in flight the drawer holds itself open, disables
   * its own controls and labels the submit button — so no screen has to
   * reinvent a pending state once these writes reach a database.
   */
  onSubmit: () => void | Promise<void>;
  error?: string | null;
  submitDisabled?: boolean;
  children: React.ReactNode;
}) {
  // On a phone the drawer is re-drawn as a bottom sheet — same fields,
  // reachable with a thumb.
  const isMobile = useIsMobile();
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const result = onSubmit();
    if (!(result instanceof Promise)) return;
    setSaving(true);
    try {
      // Held to the floor, so "Saving…" is something you see rather than
      // something that happened. See lib/pending.ts.
      await withMinDuration(result);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        className={cn(
          "border-border max-w-none gap-0 p-0 data-[side=right]:sm:max-w-none",
          "data-[side=bottom]:max-h-[86vh] data-[side=bottom]:rounded-t-xl",
          "data-[side=right]:border-l data-[side=right]:shadow-[-8px_0_24px_rgba(17,19,24,0.12)]",
          "data-[side=right]:w-(--drawer-form-w)",
        )}
      >
        {/* The fields arrive in the order they are filled in, behind the
            panel, rather than the whole form being there before it lands. */}
        <form
          key={String(open)}
          onSubmit={handleSubmit}
          className="stagger-in flex h-full flex-col gap-2.75 overflow-y-auto px-5 py-4.5"
        >
          <div className="flex items-center gap-2.5">
            <SheetTitle className="text-muted-foreground flex-1 font-mono text-[10px] font-medium tracking-[0.07em] uppercase">
              {title}
            </SheetTitle>
            <button
              type="button"
              title="Close"
              onClick={() => onOpenChange(false)}
              className="interactive focus-ring text-muted-foreground hover:text-foreground cursor-pointer px-0.5 text-[17px] leading-none"
            >
              ×
            </button>
          </div>

          {description && (
            <p className="text-muted-foreground text-[11.5px] leading-relaxed">
              {description}
            </p>
          )}

          {children}

          {error && (
            <p className="text-warning-foreground text-[11.5px] leading-relaxed">
              {error}
            </p>
          )}

          <div className="flex gap-1.75 pt-0.5">
            <button
              type="submit"
              disabled={submitDisabled || saving}
              className="interactive focus-ring pressable border-primary bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border px-2 py-2 text-[11.5px] leading-none font-medium disabled:cursor-not-allowed disabled:opacity-45 md:min-h-0"
            >
              {saving && <Spinner />}
              {saving ? "Saving…" : submitLabel}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="interactive focus-ring pressable border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground min-h-11 cursor-pointer rounded border px-3 py-2 text-[11.5px] leading-none font-medium md:min-h-0"
            >
              {cancelLabel}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Label + control, with the design's small-caps mono field label. */
export function FormField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the children, rendered inside this label
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground text-[10.5px] leading-relaxed">
          {hint}
        </span>
      )}
    </label>
  );
}

/** A read-only field — the design pads these with a lock rather than hiding them. */
export function FormFieldLocked({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
        {label}
      </span>
      <div className="border-divider bg-surface-subtle text-neutral-foreground flex items-center gap-2 rounded border px-2.5 py-2.25 text-[12px]">
        {icon}
        {value}
      </div>
    </div>
  );
}

/**
 * A number with its unit beside it — "180 days", "3 floors".
 *
 * The unit belongs in the field, not only in the label: a bare box reading
 * 180 is ambiguous between days, weeks and months, and both places this is
 * used replaced a dropdown whose options carried the unit in their text.
 */
export function NumberInput({
  value,
  onChange,
  suffix,
  min = 1,
  max = 3650,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  suffix: string;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <span className="interactive focus-within:ring-3 focus-within:ring-primary/15 border-input focus-within:border-primary bg-card flex items-center gap-2 rounded border pr-2.5">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-[12px] outline-none"
      />
      <span className="text-muted-foreground shrink-0 font-mono text-[10.5px]">
        {suffix}
      </span>
    </span>
  );
}

/**
 * A wide right sheet, for the one thing that is a table rather than a form:
 * the type registries.
 *
 * The three fixed widths exist so a form never changes shape between pages,
 * and a six-column table does not fit any of them. Rather than cram it into a
 * 392px drawer, this is a fourth width used only for a registry.
 */
export function WideSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        className={cn(
          "border-border max-w-none gap-0 p-0 data-[side=right]:sm:max-w-none",
          "data-[side=bottom]:max-h-[86vh] data-[side=bottom]:rounded-t-xl",
          "data-[side=right]:border-l data-[side=right]:shadow-[-8px_0_24px_rgba(17,19,24,0.12)]",
          "data-[side=right]:w-(--sheet-w)",
        )}
      >
        <div className="flex h-full flex-col gap-3 overflow-y-auto px-5 py-4.5">
          <div className="flex items-center gap-2.5">
            <SheetTitle className="text-muted-foreground flex-1 font-mono text-[10px] font-medium tracking-[0.07em] uppercase">
              {title}
            </SheetTitle>
            <button
              type="button"
              title="Close"
              onClick={() => onOpenChange(false)}
              className="interactive focus-ring text-muted-foreground hover:text-foreground cursor-pointer px-0.5 text-[17px] leading-none"
            >
              ×
            </button>
          </div>
          {description && (
            <p className="text-muted-foreground text-[11.5px] leading-relaxed">
              {description}
            </p>
          )}
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
