import {
  BarChart3,
  Box,
  ClipboardList,
  History,
  LayoutGrid,
  ShieldCheck,
  Waves,
  Wrench,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  /** Visible when the signed-in role's rank is <= minRank (1 = CEO only, 3 = everyone). */
  minRank: 1 | 2 | 3;
  badgeKey?: "openRequests";
}

// Eight items. The estate lives inside Administration rather than in its own
// entry, and Settings is reached from the account menu, not the sidebar.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid, minRank: 3 },
  { label: "Equipment", href: "/equipment", icon: Box, minRank: 3 },
  { label: "Sensors", href: "/sensors", icon: Waves, minRank: 3 },
  {
    label: "Maintenance Requests",
    href: "/requests",
    icon: Wrench,
    minRank: 3,
    badgeKey: "openRequests",
  },
  { label: "Historical Records", href: "/records", icon: History, minRank: 3 },
  { label: "Log Book", href: "/logbook", icon: ClipboardList, minRank: 2 },
  { label: "Reports", href: "/reports", icon: BarChart3, minRank: 2 },
  { label: "Administration", href: "/admin", icon: ShieldCheck, minRank: 2 },
];
