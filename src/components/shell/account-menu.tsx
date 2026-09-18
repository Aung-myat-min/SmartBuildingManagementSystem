"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/lib/permissions";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AccountMenu() {
  const { currentUser } = useAppState();
  const { signOutNow } = useAuth();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-md p-0.5">
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
            {initials(currentUser.name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-left sm:block">
          <span className="block text-[12px] leading-tight font-medium">
            {currentUser.name}
          </span>
          <span className="text-muted-foreground block text-[10.5px] leading-tight">
            {roleLabel[currentUser.role]}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-59">
        <DropdownMenuLabel>
          <div className="text-[12px] font-medium">{currentUser.name}</div>
          <div className="text-muted-foreground mt-0.5 font-mono text-[10.5px] font-normal">
            {currentUser.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Settings is reached from here rather than the sidebar, so these
            have to actually go somewhere. */}
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <UserRound className="size-3.5" /> My profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-3.5" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void signOutNow()}
        >
          <LogOut className="size-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
