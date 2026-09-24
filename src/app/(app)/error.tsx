"use client";

import { Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { StatusScreen } from "@/components/shared/status-screen";
import { Button } from "@/components/ui/button";

/**
 * When a page inside the shell throws.
 *
 * It tells two things apart, because they are not the same problem and do not
 * have the same answer:
 *
 * - **A refusal.** `firestore.rules` run on Google's servers and are the real
 *   authorisation layer; `lib/permissions.ts` only decides what to draw. When
 *   the two disagree — a stale tab after a role change, a hand-typed URL — the
 *   rules win and the SDK throws `permission-denied`. That is the app working,
 *   not breaking, and retrying will not help.
 * - **Anything else**, which is a bug, and where retrying often does help
 *   because the subscriptions re-run.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // No error service here, so the console is the record. Without this a
    // digest is all anyone gets and the stack is gone.
    console.error("[shell]", error);
  }, [error]);

  if (isRefusal(error)) {
    return (
      <StatusScreen
        icon={Lock}
        code="403"
        title="This is not yours to open"
        body="Your role does not reach this record. If it should, an Admin Manager can change what your account may see — a role change takes effect without signing in again."
        tone="warning"
      >
        <Button render={<Link href="/dashboard" />}>
          Back to the dashboard
        </Button>
      </StatusScreen>
    );
  }

  return (
    <StatusScreen
      icon={TriangleAlert}
      code={error.digest ? `Error · ${error.digest}` : "Error"}
      title="This page stopped working"
      body="Nothing you had saved is affected — every change in this app is written as it is made. Trying again reloads the data behind this page."
      tone="danger"
    >
      <Button onClick={reset}>Try again</Button>
      <Button variant="outline" render={<Link href="/dashboard" />}>
        Back to the dashboard
      </Button>
    </StatusScreen>
  );
}

/**
 * Whether the rules refused this, rather than something breaking. Firestore
 * puts the reason on `code`; the message is checked too because an error that
 * has been wrapped on the way up loses the field but keeps the text.
 */
function isRefusal(error: Error & { code?: string }): boolean {
  return (
    error.code === "permission-denied" ||
    /permission[-\s]denied|insufficient permissions/i.test(error.message ?? "")
  );
}
