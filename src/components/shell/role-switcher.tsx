"use client";

import { useAppState } from "@/lib/app-state";
import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: UserRole[] = ["office-staff", "admin-manager", "ceo-super-admin"];

export function RoleSwitcher() {
  const { role, setRole } = useAppState();

  return (
    <div className="bg-secondary border-border flex items-center gap-1.5 rounded-md border p-[3px]">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRole(r)}
          className={cn(
            "cursor-pointer rounded px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap transition-colors",
            r === role
              ? "bg-primary text-primary-foreground"
              : "text-foreground/70 hover:text-foreground",
          )}
        >
          {roleLabel[r]}
        </button>
      ))}
    </div>
  );
}
