"use client";

import type * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A styled tooltip around a control that is already written.
 *
 * Most of this app's hints were the native `title` attribute: unstyled, a
 * second late, and impossible to animate. This puts them on the same tooltip
 * every other part of the app uses, without rewriting the control — the child
 * is handed to Base UI's trigger through `render`, so it keeps its own markup.
 *
 * `text` is optional on purpose. A padlocked control's reason is
 * `may ? undefined : REASON`, and with nothing to say this renders the child
 * alone rather than an empty tooltip.
 *
 * **A locked control must use `aria-disabled`, not `disabled`.** A disabled
 * button receives no pointer events and is out of the tab order, so its
 * explanation can be reached by neither a mouse nor a keyboard — which is the
 * one thing the padlock exists to do.
 */
export function Hint({
  text,
  side = "top",
  children,
}: {
  text?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  if (!text) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{text}</TooltipContent>
    </Tooltip>
  );
}
