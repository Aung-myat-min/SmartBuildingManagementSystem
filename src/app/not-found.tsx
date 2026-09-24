"use client";

import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { StatusScreen } from "@/components/shared/status-screen";
import { Button } from "@/components/ui/button";

/**
 * The framework's fallback, for a `notFound()` raised where the shell cannot
 * render it.
 *
 * Almost every wrong URL lands on `(app)/[...missing]` instead — the URLs here
 * are flat, so a root catch-all matches anything a static route does not,
 * including a mistyped `/login/...`, and it keeps the sidebar. Behind the auth
 * gate, so a signed-out visitor is sent to sign in rather than shown a 404
 * for a page they could not have opened anyway.
 *
 * This one renders with no identity and no shell, so it says the one thing it
 * knows and points at the door.
 */
export default function NotFound() {
  return (
    <div className="bg-auth flex min-h-screen flex-col">
      <StatusScreen
        icon={MapPinOff}
        code="404"
        title="There is no page here"
        body="The address does not match anything in this application. It may have been mistyped, or the link that brought you here may be out of date."
      >
        <Button render={<Link href="/dashboard" />}>Go to the dashboard</Button>
        <Button variant="outline" render={<Link href="/login" />}>
          Sign in
        </Button>
      </StatusScreen>
    </div>
  );
}
