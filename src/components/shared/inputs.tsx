"use client";

// The three plain controls Administration and the sensor type registry both
// use. Nothing clever — they exist so the same border, padding and type size
// are not retyped at every call site.

import type * as React from "react";
import { cn } from "@/lib/utils";

export function RowButton({
  children,
  danger,
  title,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "bg-card flex cursor-pointer items-center gap-1 rounded border px-2.25 py-1.25 text-[10.5px] leading-none font-medium",
        danger
          ? "border-danger/40 text-danger-foreground hover:bg-danger-muted"
          : "border-input text-neutral-foreground hover:border-primary hover:text-accent-foreground",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      {children}
    </button>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className="border-input focus:border-primary w-full rounded border px-2.25 py-2 text-[12px] outline-none"
    />
  );
}

export function SelectInput(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className="border-input bg-card w-full cursor-pointer rounded border px-2 py-2 text-[11.5px] font-medium"
    />
  );
}
