"use client";

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseMmk } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "warning" | "info";
type Tone = ConfirmTone;

export interface ConfirmOptions {
  title: string;
  body: React.ReactNode;
  tone?: Tone;
  /**
   * What the action costs, in its own numbers — "Its 6 devices stop
   * reporting", not "This cannot be undone".
   */
  note?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * A confirm may carry a written reason **or** a cost, and nothing else.
   * Fire-alarm reset and decommission set the reason, and refuse to proceed
   * without it.
   */
  requireReason?: boolean;
  reasonPlaceholder?: string;
  /**
   * Asks what the work cost. Marking a request resolved is the only moment
   * anyone knows, so it is asked there rather than left for later. Defaults
   * to "no cost", which records `0` — absent would mean nobody was asked.
   */
  requireCost?: boolean;
}

export interface ConfirmResult {
  confirmed: boolean;
  reason?: string;
  costMmk?: number;
}

type Resolver = (result: ConfirmResult) => void;

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<ConfirmResult>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

const TONE_META: Record<
  Tone,
  { icon: React.ElementType; text: string; border: string; button: string }
> = {
  danger: {
    icon: ShieldAlert,
    text: "text-danger",
    border: "border-t-danger",
    button: "interactive border-danger bg-danger hover:bg-danger/90",
  },
  warning: {
    icon: AlertTriangle,
    text: "text-warning",
    border: "border-t-warning",
    button: "interactive border-warning bg-warning hover:bg-warning/90",
  },
  info: {
    icon: Info,
    text: "text-primary",
    border: "border-t-primary",
    button: "interactive border-primary bg-primary hover:bg-primary/90",
  },
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [reason, setReason] = React.useState("");
  const [hasCost, setHasCost] = React.useState(false);
  const [cost, setCost] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const resolverRef = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setReason("");
    setHasCost(false);
    setCost("");
    setError(null);
    return new Promise<ConfirmResult>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result: ConfirmResult) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  const handleConfirm = () => {
    if (options?.requireReason && reason.trim().length === 0) {
      setError("A written reason is required before this can be confirmed.");
      return;
    }
    let costMmk: number | undefined;
    if (options?.requireCost) {
      if (!hasCost) {
        costMmk = 0;
      } else {
        const parsed = parseMmk(cost);
        if (parsed === null) {
          setError("Enter the amount in MMK, or choose No cost.");
          return;
        }
        costMmk = parsed;
      }
    }
    close({ confirmed: true, reason: reason.trim() || undefined, costMmk });
  };

  const tone = options?.tone ?? "info";
  const meta = TONE_META[tone];
  const Icon = meta.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={!!options}
        onOpenChange={(open) => !open && close({ confirmed: false })}
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            "border-border w-(--modal-w) max-w-none gap-3 rounded-[6px] border border-t-[3px] p-0 ring-0 shadow-[0_18px_44px_rgba(17,19,24,0.22)] sm:max-w-none",
            meta.border,
          )}
        >
          <div className="flex flex-col gap-3 px-5.5 py-5">
            <div className="flex items-center gap-2.5">
              <Icon className={cn("size-4 shrink-0", meta.text)} />
              <DialogTitle className="text-[14px] leading-tight font-semibold">
                {options?.title}
              </DialogTitle>
            </div>

            <DialogDescription className="text-foreground/80 text-[12.5px] leading-relaxed text-pretty">
              {options?.body}
            </DialogDescription>

            {options?.note && (
              <div className="border-rule bg-surface-hover text-muted-foreground rounded border px-2.75 py-2.25 text-[11.5px] leading-relaxed">
                {options.note}
              </div>
            )}

            {options?.requireReason && (
              <label className="flex flex-col gap-1.5">
                <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
                  Written reason
                </span>
                <textarea
                  autoFocus
                  rows={3}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={
                    options?.reasonPlaceholder ?? "Why is this being done?"
                  }
                  className="interactive focus:ring-3 focus:ring-primary/15 border-input focus:border-primary w-full resize-y rounded border px-2.5 py-2.25 text-[12px] leading-relaxed outline-none"
                />
              </label>
            )}

            {options?.requireCost && (
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
                  Cost of this work
                </span>
                <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="radio"
                    name="confirm-cost"
                    checked={!hasCost}
                    onChange={() => {
                      setHasCost(false);
                      if (error) setError(null);
                    }}
                    className="accent-primary size-3.5 cursor-pointer"
                  />
                  No cost
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="radio"
                    name="confirm-cost"
                    checked={hasCost}
                    onChange={() => setHasCost(true)}
                    className="accent-primary size-3.5 cursor-pointer"
                  />
                  Cost
                  <input
                    value={cost}
                    inputMode="numeric"
                    placeholder="145,000"
                    onChange={(e) => {
                      setCost(e.target.value);
                      setHasCost(true);
                      if (error) setError(null);
                    }}
                    className="interactive focus:ring-3 focus:ring-primary/15 border-input focus:border-primary w-32 rounded border px-2 py-1.5 text-right font-mono text-[11.5px] outline-none"
                  />
                  <span className="text-muted-foreground font-mono text-[10.5px]">
                    MMK
                  </span>
                </label>
              </div>
            )}

            {error && (
              <p className="text-warning-foreground text-[11.5px] leading-snug">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => close({ confirmed: false })}
                className="interactive focus-ring pressable border-input bg-card text-neutral-foreground hover:border-primary hover:text-accent-foreground cursor-pointer rounded border px-3.5 py-2.25 text-[11.5px] leading-none font-medium"
              >
                {options?.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={cn(
                  "interactive focus-ring cursor-pointer rounded border px-3.75 py-2.25 text-[11.5px] leading-none font-medium text-white",
                  meta.button,
                )}
              >
                {options?.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
