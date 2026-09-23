"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state";
import { MOBILE_TABS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The phone's navigation. Five tabs along the bottom replace the sidebar,
 * each a 48px target so it can be hit one-handed in a corridor; everything
 * the bar has no room for sits behind More.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { openRequestCount } = useAppState();

  return (
    <nav className="border-border bg-card fixed inset-x-0 bottom-0 z-40 flex border-t px-1 pt-1.5 pb-2.5 md:hidden">
      {MOBILE_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const badge = tab.badgeKey === "openRequests" ? openRequestCount : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "focus-ring interactive pressable flex min-h-12 flex-1 flex-col items-center gap-1.25 px-0.5 py-2",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className="relative flex">
              <tab.icon className="size-4.75" />
              {badge > 0 && (
                <span className="bg-warning absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.75 font-mono text-[8.5px] leading-none font-semibold text-white">
                  {badge}
                </span>
              )}
            </span>
            <span className="text-[9.5px] leading-none font-medium">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
