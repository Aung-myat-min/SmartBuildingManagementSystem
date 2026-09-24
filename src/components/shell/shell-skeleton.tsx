"use client";

import { PageLoader } from "@/components/shared/loader";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shell's own shape, so there is no layout jump when the app arrives.
 * Shared by the auth gate, the wait for the first snapshot and the gap before
 * a route module lands — one loading surface rather than three.
 *
 * The edges are skeleton blocks because their shape is known; the middle is
 * the loading ring, because its shape is not. A static line of grey text there
 * read as a page that had finished loading and was empty.
 */
export function ShellSkeleton({ note }: { note: string }) {
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
        <PageLoader note={note} className="p-(--page-pad)" />
      </div>
    </div>
  );
}
