"use client";

import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/shell/account-menu";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AuthGate } from "@/components/shell/auth-gate";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { useAppState } from "@/lib/app-state";
import { MOBILE_TABS, MORE_ITEMS, NAV_ITEMS } from "@/lib/nav";

const TITLES = [...NAV_ITEMS, ...MORE_ITEMS, ...MOBILE_TABS];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Everything below needs a resolved identity, so the gate wraps the shell
  // rather than each page.
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { buildings, role, activeBuildingId } = useAppState();

  const current = TITLES.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const buildingName =
    buildings.find((b) => b.id === activeBuildingId)?.name ?? "";
  const scopeNote =
    role === "office-staff"
      ? `Scoped to ${buildingName}`
      : "All buildings in scope";

  return (
    <div className="flex min-h-screen">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-card sticky top-0 z-40 flex h-(--header-h) shrink-0 items-center gap-3 border-b px-4 lg:px-5">
          {/* The phone has no sidebar, so the mark rides in the header. */}
          <span className="border-primary relative size-5.5 shrink-0 rounded-[3px] border-2 md:hidden">
            <span className="bg-primary absolute inset-0.75 opacity-55" />
          </span>

          <div className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-3">
            <h1 className="truncate text-[12.5px] font-semibold md:text-[13px]">
              {current?.label ?? "Smart Building Monitoring"}
            </h1>
            <span className="text-muted-foreground truncate font-mono text-[10px] md:font-sans md:text-[11.5px]">
              {scopeNote}
            </span>
          </div>

          <div className="flex-1" />
          <NotificationsMenu />
          <AccountMenu />
        </header>

        {/* Bottom padding clears the tab bar, which floats over the page. */}
        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-4 lg:p-5 lg:pb-5">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
