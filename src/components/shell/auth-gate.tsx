"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";
import { AppStateProvider } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";

/**
 * The app shell's guard. One file covers all ten routes.
 *
 * **UX, not security.** A client-only SDK has no server-side route gate; this
 * just stops anyone landing on a chrome-full dashboard while signed out.
 * Authorisation is firestore.rules, which run on Google's servers.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, user, endedReason } = useAuth();
  const router = useRouter();

  const signedOut =
    status === "signed-out" ||
    status === "no-profile" ||
    status === "suspended";

  React.useEffect(() => {
    if (!signedOut) return;
    // A session that was working and stopped gets the explanation screen; a
    // cold signed-out load and a deliberate sign-out both just get the form.
    // replace, not push — otherwise Back bounces between the two screens.
    router.replace(
      endedReason ? `/login/session-expired?reason=${endedReason}` : "/login",
    );
  }, [signedOut, endedReason, router]);

  // Children must not render without an identity: every page calls
  // useAppState(), which throws outside the provider below.
  if (status !== "signed-in" || !user)
    return <ShellSkeleton note="Signing in…" />;

  return <AppStateProvider user={user}>{children}</AppStateProvider>;
}
