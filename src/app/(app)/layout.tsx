"use client";

import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/shell/account-menu";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { DemoBanner } from "@/components/shell/demo-banner";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { RoleSwitcher } from "@/components/shell/role-switcher";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAppState } from "@/lib/app-state";
import { BUILDINGS } from "@/lib/mock-data";
import { NAV_ITEMS } from "@/lib/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, activeBuildingId } = useAppState();

  const current = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const buildingName =
    BUILDINGS.find((b) => b.id === activeBuildingId)?.name ?? "";
  const scopeNote =
    role === "office-staff"
      ? `Scoped to ${buildingName}`
      : "All buildings in scope";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="border-border bg-card sticky top-0 z-40 flex h-[54px] shrink-0 items-center gap-3.5 border-b px-4 lg:px-5">
          <SidebarTrigger className="-ml-1.5" />
          <Separator orientation="vertical" className="h-5!" />
          <h1 className="text-[13px] font-semibold whitespace-nowrap">
            {current?.label ?? "Smart Building Monitoring"}
          </h1>
          <span className="text-muted-foreground hidden text-[11.5px] sm:inline">
            {scopeNote}
          </span>
          <div className="flex-1" />
          <RoleSwitcher />
          <Separator orientation="vertical" className="h-5!" />
          <NotificationsMenu />
          <AccountMenu />
        </header>
        <DemoBanner />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:p-5">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
