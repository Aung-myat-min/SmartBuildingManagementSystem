import {
  BarChart3,
  Box,
  ClipboardList,
  Ellipsis,
  History,
  LayoutGrid,
  Settings as SettingsIcon,
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

// At phone width the sidebar is replaced by five bottom tabs. The four
// pages people reach standing in a corridor, plus everything else behind
// More — which is where Settings lives on every width.
export const MOBILE_TABS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutGrid, minRank: 3 },
  {
    label: "Requests",
    href: "/requests",
    icon: Wrench,
    minRank: 3,
    badgeKey: "openRequests",
  },
  { label: "Sensors", href: "/sensors", icon: Waves, minRank: 3 },
  { label: "Equipment", href: "/equipment", icon: Box, minRank: 3 },
  { label: "More", href: "/more", icon: Ellipsis, minRank: 3 },
];

export interface MoreItem extends NavItem {
  detail: string;
}

/** The pages the tab bar has no room for, listed on /more. */
export const MORE_ITEMS: MoreItem[] = [
  {
    label: "Historical Records",
    href: "/records",
    icon: History,
    minRank: 3,
    detail: "The long-range ledger of everything the system did",
  },
  {
    label: "Log Book",
    href: "/logbook",
    icon: ClipboardList,
    minRank: 2,
    detail: "Today's running record, written by the system",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    minRank: 2,
    detail: "Generated performance, reliability and cost documents",
  },
  {
    label: "Administration",
    href: "/admin",
    icon: ShieldCheck,
    minRank: 2,
    detail: "Buildings, rooms and the accounts that can see them",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: SettingsIcon,
    minRank: 3,
    detail: "Your account, appearance, password and sessions",
  },
];
