"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { ToneBadge } from "@/components/shared/tone-badge";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { MORE_ITEMS } from "@/lib/nav";
import { roleLabel, roleRank } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The phone's overflow navigation. The tab bar holds the four pages used on
 * the move; everything else lives here, including the pages a role cannot
 * reach — which are named rather than hidden, so the gap is explained.
 */
export default function MorePage() {
  const { currentUser, role, openRequestCount } = useAppState();
  const { signOutNow } = useAuth();
  const rank = roleRank(role);

  const reachable = MORE_ITEMS.filter((item) => rank <= item.minRank);
  const locked = MORE_ITEMS.filter((item) => rank > item.minRank);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex items-center gap-3 rounded-[5px] border px-4 py-3.5">
        <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
          {initials(currentUser.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">
            {currentUser.name}
          </div>
          <div className="text-muted-foreground mt-0.5 truncate font-mono text-[10.5px]">
            {currentUser.email}
          </div>
        </div>
        <ToneBadge tone="info">{roleLabel[role]}</ToneBadge>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-[5px] border">
        <div className="bg-surface-subtle border-divider text-muted-foreground border-b px-4 py-2.25 font-mono text-[10px] font-medium tracking-[0.06em] uppercase">
          Pages
        </div>

        {reachable.map((item) => {
          const badge = item.badgeKey === "openRequests" ? openRequestCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring interactive border-rule hover:bg-surface-hover flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <item.icon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-[450]">{item.label}</div>
                <div className="text-muted-foreground mt-0.5 text-[10.5px] leading-snug">
                  {item.detail}
                </div>
              </div>
              {badge > 0 && (
                <span className="text-warning-foreground shrink-0 font-mono text-[11px] font-semibold">
                  {badge}
                </span>
              )}
              <span className="text-muted-foreground shrink-0 text-[15px] leading-none">
                ›
              </span>
            </Link>
          );
        })}

        {locked.length > 0 && (
          <div className="bg-surface-subtle border-divider flex items-start gap-2.5 border-t px-4 py-3">
            <Lock className="text-muted-foreground mt-0.5 size-3 shrink-0" />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {locked.map((l) => l.label).join(", ")}{" "}
              {locked.length === 1 ? "is" : "are"} limited to Admin Managers and
              the CEO. Your role is{" "}
              <span className="font-mono">{roleLabel[role]}</span>.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void signOutNow()}
        className={cn(
          "focus-ring interactive border-danger/40 text-danger-foreground bg-card hover:bg-danger-muted",
          "cursor-pointer rounded-[5px] border px-4 py-3 text-[12px] font-medium",
        )}
      >
        Sign out
      </button>
    </div>
  );
}
