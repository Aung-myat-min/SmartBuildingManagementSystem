"use client";

import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusScreen } from "@/components/shared/status-screen";
import { Button } from "@/components/ui/button";

/**
 * A 404 that keeps the shell.
 *
 * Next resolves an unmatched URL to the *root* `not-found.tsx`, which renders
 * outside the app layout — so a signed-in person who mistypes `/equipmnt`
 * would lose their sidebar to be told a page is missing. A catch-all inside
 * the group keeps it: every real route is a static segment, and a static
 * segment always beats a catch-all.
 *
 * It sits behind the auth gate like every other page here, so a signed-out
 * visitor is sent to sign in rather than being told what does not exist.
 */
export default function MissingPage() {
  const pathname = usePathname();
  return (
    <StatusScreen
      icon={MapPinOff}
      code="404"
      title="There is no page here"
      body={
        <>
          Nothing in this application answers to{" "}
          <span className="text-foreground font-mono text-[11.5px]">
            {pathname}
          </span>
          . Check the address, or pick a page from the sidebar.
        </>
      }
    >
      <Button render={<Link href="/dashboard" />}>Go to the dashboard</Button>
    </StatusScreen>
  );
}
