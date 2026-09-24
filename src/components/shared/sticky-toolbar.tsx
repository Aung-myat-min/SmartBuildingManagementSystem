"use client";

import type * as React from "react";
import { useStuck } from "@/hooks/use-stuck";
import { cn } from "@/lib/utils";

/**
 * A page toolbar that stays put.
 *
 * Filtering a two-hundred-row Log Book used to mean scrolling back to the top
 * to change the filter. The toolbar now pins under the app header, and grows a
 * shadow once it does so it is clear what is floating and what is scrolling.
 *
 * The sentinel above it is what `useStuck` watches; it is a pixel tall and
 * pulled back out of the flow, so it changes no layout.
 */
export function StickyToolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [sentinel, stuck] = useStuck();
  return (
    <>
      <div ref={sentinel} aria-hidden className="-mb-px h-px" />
      <div
        className={cn(
          "sticky top-(--header-h) z-30 transition-shadow duration-(--dur-base) ease-(--ease-out-soft)",
          stuck && "stuck-shadow",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
