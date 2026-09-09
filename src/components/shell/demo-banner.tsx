"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";

export function DemoBanner() {
  const { elapsed, alarmActive, resetDemo } = useAppState();

  return (
    <div className="border-border bg-card mx-4 mt-4 flex flex-wrap items-center gap-4 rounded-md border px-4 py-3 lg:mx-5 lg:mt-5">
      <div className="text-primary font-mono text-[11px] font-semibold tracking-wider uppercase">
        Demo state
      </div>
      <div className="text-foreground/80 min-w-70 flex-1 text-[12px] leading-snug">
        Data is simulated and ticking.{" "}
        {alarmActive ? (
          <span className="text-danger font-medium">
            A fire alarm is active in Building 216 / Room 302.
          </span>
        ) : (
          "A fire alarm triggers in Building 216 / Room 302 about twenty seconds after load so the alert path is visible."
        )}{" "}
        Elapsed: <span className="font-mono font-medium">{elapsed}s</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={resetDemo}
        className="border-primary text-info-foreground hover:bg-accent"
      >
        <RotateCcw className="size-3.5" /> Restart demo
      </Button>
    </div>
  );
}
