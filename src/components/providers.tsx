"use client";

import type * as React from "react";
import { ConfirmProvider } from "@/components/shared/confirm-dialog";
import { AppStateProvider } from "@/lib/app-state";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </AppStateProvider>
  );
}
