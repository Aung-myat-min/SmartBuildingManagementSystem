"use client";

import { ThemeProvider } from "next-themes";
import type * as React from "react";
import { ConfirmProvider } from "@/components/shared/confirm-dialog";
import { AppStateProvider } from "@/lib/app-state";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // `class` rather than a data attribute, because globals.css defines the
    // dark palette under `.dark` and the dark: variant matches its subtree.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AppStateProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AppStateProvider>
    </ThemeProvider>
  );
}
