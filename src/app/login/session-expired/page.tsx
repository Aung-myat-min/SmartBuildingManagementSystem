"use client";

import { Clock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/**
 * Firebase sessions do not time out on idle — a refresh token lives until it
 * is revoked — so this screen is no longer about thirty quiet minutes. It is
 * reached when a session that was working stopped working: the account was
 * suspended, its profile went, or the token was revoked elsewhere (a password
 * change on another device does exactly that).
 */
const REASONS: Record<string, string> = {
  suspended:
    "This account has been suspended, so you were signed out. An Admin Manager can restore it.",
  "no-profile":
    "This account no longer has a profile, so it cannot be used. Ask an Admin Manager to set it up again.",
  revoked:
    "Your session was ended somewhere else — usually a password change on another device.",
};

const GHOST_ROWS = [64, 84, 52, 90, 70];

export default function SessionExpiredPage() {
  return (
    <React.Suspense fallback={null}>
      <SessionExpiredView />
    </React.Suspense>
  );
}

function SessionExpiredView() {
  const router = useRouter();
  const params = useSearchParams();
  const { lastEmail } = useAuth();
  const detail =
    REASONS[params.get("reason") ?? ""] ??
    "You were signed out. Nothing you had open has been lost.";

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none max-w-150 flex-1 opacity-50 blur-[2.5px] select-none"
      >
        <div className="border-border bg-card flex h-11 items-center gap-2.5 rounded-t-md border-x border-t px-3.5">
          <span className="border-primary relative size-5 shrink-0 rounded-[3px] border-2">
            <span className="bg-primary absolute inset-0.75 opacity-55" />
          </span>
          <span className="text-[11px] font-semibold">
            Maintenance Requests
          </span>
        </div>
        <div className="border-border bg-card flex flex-col gap-2.5 rounded-b-md border-x border-b p-3.5">
          {GHOST_ROWS.map((w, i) => (
            <div key={`ghost-${i + 1}`} className="flex items-center gap-2.5">
              <span className="bg-border h-2 w-15.5 shrink-0 rounded-sm" />
              <span
                className="bg-muted h-2 rounded-sm"
                style={{ width: `${w}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 bg-[#111318]/28" />

      <div className="border-border border-t-warning bg-card relative z-10 w-full max-w-97.5 rounded-md border border-t-[3px] p-5 shadow-[0_14px_34px_rgba(17,19,24,0.2)]">
        <div className="flex items-center gap-2.25">
          <Clock className="text-warning-foreground size-4 shrink-0" />
          <span className="text-[13px] font-semibold">
            Your session has ended
          </span>
        </div>
        <p className="text-foreground/80 mt-2.25 text-[12px] leading-relaxed">
          {detail}
        </p>
        {lastEmail && (
          <p className="text-muted-foreground mt-2.25 font-mono text-[11px]">
            {lastEmail}
          </p>
        )}
        <div className="mt-3.75 flex gap-2">
          <Button className="flex-1" onClick={() => router.push("/login")}>
            Sign in again
          </Button>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
