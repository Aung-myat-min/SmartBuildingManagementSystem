"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppStateProvider } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";

/**
 * The app shell's guard. One file covers all ten routes.
 *
 * **This is UX, not security.** A client-only Firebase SDK has no server-side
 * route gate: anything the browser could fetch, a determined visitor can fetch
 * from devtools. What this buys is that nobody lands on a chrome-full
 * dashboard rendering nothing while signed out. Authorisation is enforced by
 * firestore.rules, which run on Google's servers and are the only thing that
 * actually refuses anybody.
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
  if (status !== "signed-in" || !user) return <ShellSkeleton />;

  return <AppStateProvider user={user}>{children}</AppStateProvider>;
}

/** The shell's own shape, so there is no layout jump when the app arrives. */
function ShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="border-border bg-card hidden w-(--sidebar-w) shrink-0 border-r p-3 lg:block">
        <Skeleton className="h-7 w-32" />
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border bg-card flex h-(--header-h) shrink-0 items-center gap-3 border-b px-4 lg:px-5">
          <Skeleton className="h-4 w-44" />
          <div className="flex-1" />
          <Skeleton className="size-7 rounded-full" />
        </div>
        <div className="flex flex-1 items-center justify-center p-(--page-pad)">
          <span className="text-muted-foreground text-[12px]">Signing in…</span>
        </div>
      </div>
    </div>
  );
}
