"use client";

import { Bell } from "lucide-react";
import { PulseDot } from "@/components/shared/pulse-dot";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppState();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "relative size-8",
              unreadCount > 0 && "border-danger/40",
            )}
          />
        }
      >
        <Bell className="size-3.5" />
        {unreadCount > 0 && (
          <span className="bg-danger absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9.5px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-98 p-0" sideOffset={10}>
        <div className="border-border flex items-center gap-2.5 border-b px-3.5 py-3">
          <span className="text-muted-foreground flex-1 font-mono text-[10px] tracking-wider uppercase">
            Notifications &middot; {unreadCount} unread
          </span>
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="text-primary cursor-pointer text-[11px] font-medium hover:underline"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-[330px] overflow-auto">
          {notifications.length === 0 && (
            <div className="text-muted-foreground p-6 text-center text-xs">
              Nothing needs your attention.
            </div>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markNotificationRead(n.id)}
              className={cn(
                "hover:bg-surface-hover border-border/60 flex w-full items-start gap-2.5 border-b px-3.5 py-2.5 text-left last:border-b-0",
                !n.read && "bg-accent/40",
              )}
            >
              <PulseDot
                tone={n.tone}
                pulse={n.pulse && !n.read}
                className="mt-1.5"
              />
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-[12px]",
                    !n.read ? "font-semibold" : "font-normal",
                  )}
                >
                  {n.title}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                  {n.detail}
                </div>
              </div>
              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                {n.time}
              </span>
            </button>
          ))}
        </div>
        <div className="bg-surface-subtle border-border text-muted-foreground border-t px-3.5 py-2.5 text-[11px]">
          Every notification is also written to the Log Book.
        </div>
      </PopoverContent>
    </Popover>
  );
}
