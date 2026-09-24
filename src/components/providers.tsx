"use client";

import { domMax, LazyMotion, MotionConfig } from "motion/react";
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
      {/*
        The library is here for one thing CSS cannot do: move an element from
        one place in the DOM to another, and animate one that is leaving.
        Everything else — hover, press, focus, the overlays — is stylesheet
        work and stays that way.

        LazyMotion with `m` components means the feature set is bundled once
        rather than pulled in by every import site. `domMax` rather than
        `domAnimation` because layout animation needs it, and layout animation
        is the whole reason the dependency is here.

        reducedMotion="user" makes the library read the same preference the
        blanket rule in globals.css already honours, so the two cannot
        disagree.
      */}
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user">
          <AuthProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </AuthProvider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}
