"use client";

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "warning" | "info";
type Tone = ConfirmTone;

export interface ConfirmOptions {
  title: string;
  body: React.ReactNode;
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  requireReason?: boolean;
  reasonPlaceholder?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  reason?: string;
}

type Resolver = (result: ConfirmResult) => void;

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<ConfirmResult>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

const TONE_META: Record<
  Tone,
  { icon: React.ElementType; className: string; buttonClass: string }
> = {
  danger: {
    icon: ShieldAlert,
    className: "text-danger border-t-danger",
    buttonClass: "bg-danger hover:bg-danger/90 text-white",
  },
  warning: {
    icon: AlertTriangle,
    className: "text-warning border-t-warning",
    buttonClass: "bg-warning hover:bg-warning/90 text-white",
  },
  info: {
    icon: Info,
    className: "text-primary border-t-primary",
    buttonClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
  },
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const resolverRef = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setReason("");
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
    close({ confirmed: true, reason: reason.trim() || undefined });
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
          className={cn("border-t-[3px] sm:max-w-[452px]", meta.className)}
        >
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <Icon className={cn("size-4 shrink-0", meta.className)} />
              <DialogTitle className="text-sm">{options?.title}</DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-[12.5px] leading-relaxed text-foreground/80">
              {options?.body}
            </DialogDescription>
          </DialogHeader>

          {options?.requireReason && (
            <div className="flex flex-col gap-1.5">
              <Label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Written reason
              </Label>
              <Textarea
                autoFocus
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  options?.reasonPlaceholder ?? "Why is this being done?"
                }
                className="min-h-20 text-sm focus-visible:ring-primary/30 focus-visible:border-primary"
              />
              {error && (
                <p className="text-warning-foreground text-xs">{error}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => close({ confirmed: false })}
            >
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button onClick={handleConfirm} className={meta.buttonClass}>
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
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
