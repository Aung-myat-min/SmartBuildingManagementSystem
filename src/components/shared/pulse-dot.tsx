import { cn } from "@/lib/utils";
import { type Tone, toneDotClass } from "./tone-badge";

export function PulseDot({
  tone,
  pulse = false,
  className,
}: {
  tone: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        toneDotClass(tone),
        pulse && "animate-sb-pulse",
        className,
      )}
    />
  );
}
