import type * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground rounded-md border border-dashed border-[#cdd1d8] p-4 text-center text-[11.5px] dark:border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}
