"use client";

import { ThemeProvider } from "next-themes";
import type * as React from "react";
import { ConfirmProvider } from "@/components/shared/confirm-dialog";
import { AuthProvider } from "@/lib/auth";

// AppStateProvider is deliberately NOT here. It needs a resolved identity, so
// it is mounted inside the auth gate in (app)/layout.tsx — which also means
// signing out unmounts it and discards the session's work, and that the
// /login screens cannot reach useAppState() at all.
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
      <AuthProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
