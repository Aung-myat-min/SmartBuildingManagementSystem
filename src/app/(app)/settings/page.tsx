"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppState } from "@/lib/app-state";
import { roleLabel } from "@/lib/permissions";

export default function SettingsPage() {
  const { currentUser } = useAppState();

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="max-w-105 gap-3 p-7.5 text-center">
        <SettingsIcon className="text-muted-foreground mx-auto size-8.5" />
        <div className="text-[14px] font-semibold">Settings</div>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          Account and notification preferences for{" "}
          <strong>{currentUser.name}</strong> ({roleLabel[currentUser.role]})
          aren&apos;t part of this build yet — this page is a placeholder for a
          future iteration.
        </p>
      </Card>
    </div>
  );
}
