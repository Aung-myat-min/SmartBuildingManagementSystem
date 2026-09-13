"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state";
import { NAV_ITEMS } from "@/lib/nav";
import { roleRank } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-primary relative shrink-0 rounded-[3px] border-2",
        className,
      )}
    >
      <span className="bg-primary absolute inset-1 opacity-55" />
    </span>
  );
}

/**
 * Three widths, three shapes: the full 196px sidebar on desktop, a 60px icon
 * rail on a tablet, and nothing at phone width — where MobileTabBar takes
 * over along the bottom.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { role, openRequestCount } = useAppState();
  const rank = roleRank(role);

  const items = NAV_ITEMS.filter((item) => rank <= item.minRank);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Tablet: icon rail */}
      <aside className="border-border bg-sidebar hidden w-15 shrink-0 flex-col items-center gap-1 border-r py-3.5 md:flex lg:hidden">
        <Link href="/dashboard" className="mb-2.5">
          <BrandMark className="size-6" />
        </Link>
        {items.map((item) => {
          const active = isActive(item.href);
          const badge = item.badgeKey === "openRequests" ? openRequestCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-[5px]",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/70 hover:bg-surface-hover",
              )}
            >
              <item.icon className="size-4.25" />
              {badge > 0 && (
                <span className="bg-warning absolute top-1 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.75 font-mono text-[8.5px] leading-none font-semibold text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </aside>

      {/* Desktop: full sidebar */}
      <aside className="border-border bg-sidebar hidden w-(--sidebar-w) shrink-0 flex-col border-r lg:flex">
        <div className="border-border border-b px-4 py-3.5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandMark className="size-6" />
            <span className="leading-tight">
              <span className="block text-[12px] font-semibold">
                Smart Building
              </span>
              <span className="text-muted-foreground block font-mono text-[9.5px] tracking-wider">
                MONITORING
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex flex-col gap-px px-2 py-2.5">
          {items.map((item) => {
            const active = isActive(item.href);
            const badge =
              item.badgeKey === "openRequests" ? openRequestCount : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.25 rounded px-2.5 py-2 text-[12.5px] font-[450]",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/80 hover:bg-surface-hover",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {/* "Maintenance Requests" is the one label 196px cannot hold
                    beside a badge, so it truncates and keeps its tooltip. */}
                <span className="min-w-0 flex-1 truncate" title={item.label}>
                  {item.label}
                </span>
                {badge > 0 && (
                  <span className="text-warning-foreground shrink-0 font-mono text-[11px] font-semibold">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
