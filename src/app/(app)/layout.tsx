"use client";

import { AnimatePresence, m } from "motion/react";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/shell/account-menu";
import { AlarmBanner } from "@/components/shell/alarm-banner";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AuthGate } from "@/components/shell/auth-gate";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";
import { useAppState } from "@/lib/app-state";
import { MOBILE_TABS, MORE_ITEMS, NAV_ITEMS } from "@/lib/nav";

const TITLES = [...NAV_ITEMS, ...MORE_ITEMS, ...MOBILE_TABS];

/** The shell resolving over its skeleton. */
const SHELL_FADE = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const;

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
  const { buildings, role, activeBuildingId, dataError, dataLoading } =
    useAppState();

  const current = TITLES.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const buildingName =
    buildings.find((b) => b.id === activeBuildingId)?.name ?? "";
  const scopeNote =
    role === "office-staff"
      ? `Scoped to ${buildingName}`
      : "All buildings in scope";

  // The estate has to be there before any page renders — every building
  // filter, every room label and the header's own scope note read it.
  if (dataLoading) return <ShellSkeleton note="Loading your estate…" />;

  return (
    // The shell fades in over the skeleton it replaces, so the app arrives
    // rather than swapping. The skeleton already has the shell's geometry, so
    // nothing moves — only the content resolves.
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={SHELL_FADE}
      className="flex min-h-screen"
    >
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

        <AlarmBanner />

        {/* Bottom padding clears the tab bar, which floats over the page. */}
        <AnimatePresence>
          {dataError && (
            <m.div
              key="data-error"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={SHELL_FADE}
              className="bg-warning-muted text-warning-foreground border-divider overflow-hidden border-b px-4 py-2 text-[11.5px] lg:px-5"
            >
              {dataError}
            </m.div>
          )}
        </AnimatePresence>

        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-4 lg:p-5 lg:pb-5">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </m.div>
  );
}
