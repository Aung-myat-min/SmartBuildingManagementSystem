"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAppState } from "@/lib/app-state";
import { NAV_ITEMS } from "@/lib/nav";
import { roleRank } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const { role, openRequestCount } = useAppState();
  const rank = roleRank(role);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-0 border-b px-4 py-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="border-primary relative size-6 shrink-0 rounded-[3px] border-2">
            <span className="bg-primary absolute inset-1 opacity-55" />
          </span>
          <span className="leading-tight">
            <span className="block text-[12px] font-semibold">
              Smart Building
            </span>
            <span className="text-muted-foreground block font-mono text-[9.5px] tracking-wider">
              MONITORING
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0.5 px-2 py-2.5">
        <SidebarMenu>
          {NAV_ITEMS.filter((item) => rank <= item.minRank).map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={active}
                  className={cn(
                    "text-[12.5px] font-[450]",
                    // The badge is positioned over the button, so the label
                    // has to stop short of it rather than run underneath.
                    item.badgeKey && "pr-6",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {/* "Maintenance Requests" is ~10px longer than 196px leaves
                      beside a badge, so it truncates and keeps its tooltip. */}
                  <span className="min-w-0 flex-1 truncate" title={item.label}>
                    {item.label}
                  </span>
                </SidebarMenuButton>
                {item.badgeKey === "openRequests" && openRequestCount > 0 && (
                  <SidebarMenuBadge className="text-warning-foreground font-mono">
                    {openRequestCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
