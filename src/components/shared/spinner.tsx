import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one spinner. Before this a pending state was a text swap — "Saving…",
 * "Resizing…" — which says the same thing but does not move, and a label that
 * does not move is easy to miss on a button you just pressed.
 *
 * It rides beside the label rather than replacing it, so the button does not
 * change width mid-press.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden
      className={cn("size-3 shrink-0 animate-spin", className)}
    />
  );
}
