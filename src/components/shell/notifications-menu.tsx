"use client";

import { Bell, Clock } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { PulseDot } from "@/components/shared/pulse-dot";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppState } from "@/lib/app-state";
import { formatAge } from "@/lib/format";
import { canAdvanceRequest } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * The bell means one thing: a request is waiting for your decision.
 *
 * Office Staff cannot approve or close out anything, so they get no bell at
 * all rather than one that is empty forever — an empty control invites
 * checking it. Same predicate the Requests page gates its buttons on, so the
 * two cannot disagree.
 */
/** A row or the badge arriving and leaving. */
const ROW_MOVE = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const;

export function NotificationsMenu() {
  const {
    role,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppState();
  const router = useRouter();

  if (!canAdvanceRequest(role)) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            title={
              unreadCount > 0
                ? `${unreadCount} request${unreadCount === 1 ? "" : "s"} waiting for you`
                : "Nothing waiting for a decision"
            }
            className={cn(
              "relative size-8",
              unreadCount > 0 && "border-danger/40",
            )}
          />
        }
      >
        <Bell className="size-3.5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <m.span
              key="badge"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={ROW_MOVE}
              className="bg-danger absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9.5px] font-semibold text-white"
            >
              {unreadCount}
            </m.span>
          )}
        </AnimatePresence>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-102 p-0" sideOffset={10}>
        <div className="border-border flex items-center gap-2.5 border-b px-3.5 py-3">
          <span className="text-muted-foreground flex-1 font-mono text-[10px] tracking-wider uppercase">
            Waiting for you &middot; {notifications.length}
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="interactive focus-ring text-primary cursor-pointer text-[11px] font-medium hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[330px] overflow-auto">
          {notifications.length === 0 && (
            <div className="text-muted-foreground p-6 text-center text-xs">
              No requests are waiting for a decision.
            </div>
          )}
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <m.button
                key={n.id}
                layout
                type="button"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={ROW_MOVE}
                onClick={() => {
                  markNotificationRead(n.id);
                  router.push("/requests");
                }}
                className={cn(
                  "focus-ring interactive hover:bg-surface-hover border-border/60 flex w-full items-start gap-2.5 border-b px-3.5 py-2.5 text-left last:border-b-0",
                  !n.read && "bg-accent/40",
                )}
              >
                <PulseDot
                  tone={n.tone}
                  pulse={n.escalated && !n.read}
                  className="mt-1.5"
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-[12px]",
                      n.read ? "font-normal" : "font-semibold",
                    )}
                  >
                    {n.title}
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate text-[11px] leading-snug">
                    {n.detail}
                  </div>
                </div>
                {n.escalated ? (
                  <span className="bg-danger-muted text-danger-foreground flex shrink-0 items-center gap-1 rounded-[3px] px-1.5 py-1 font-mono text-[9.5px] leading-none font-semibold">
                    <Clock className="size-2.5" />
                    {formatAge(n.at)}
                  </span>
                ) : (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {formatAge(n.at)}
                  </span>
                )}
              </m.button>
            ))}
          </AnimatePresence>
        </div>
        <div className="bg-surface-subtle border-border text-muted-foreground border-t px-3.5 py-2.5 text-[11px]">
          Approving or closing a request clears it from here.
        </div>
      </PopoverContent>
    </Popover>
  );
}
