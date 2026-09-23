"use client";

import * as React from "react";
import { statusForReading } from "@/lib/sensor-readings";
import { crossings, stepReadings } from "@/lib/simulation";
import type {
  EnvironmentalSensor,
  EquipmentUnit,
  SensorTypeDef,
} from "@/lib/types";

/** How often the estate is re-read. Slow enough to watch, fast enough to feel live. */
const TICK_SECONDS = 3;

/** Points kept per sensor — two minutes of history at the tick above. */
const HISTORY = 40;

export interface SimulationState {
  /** sensorId → its current reading. */
  readings: Record<string, number>;
  /** sensorId → its recent readings, oldest first. Local, and empty on load. */
  series: Record<string, number[]>;
  /** sensorId → a value being held, ignoring the drift. */
  manual: Record<string, number>;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  hold: (sensorId: string, value: number) => void;
  release: (sensorId: string) => void;
}

/**
 * The estate, ticking.
 *
 * Mounted once inside AppStateProvider so it runs per tab rather than per
 * component. Readings and their history live here, in memory: the chart is
 * local and starts empty on load, and Firestore only hears about a crossing —
 * which is `onCrossing`, and which already writes the status, the stamp, the
 * log entry and the banner.
 *
 * It stops while the tab is hidden. A background tab quietly writing status
 * changes would fill the Log Book with events nobody saw.
 */
export function useSimulation(input: {
  sensors: EnvironmentalSensor[];
  types: SensorTypeDef[];
  units: EquipmentUnit[];
  onCrossing: (sensorId: string, status: string, reading: number) => void;
  enabled: boolean;
}): SimulationState {
  const [readings, setReadings] = React.useState<Record<string, number>>({});
  const [series, setSeries] = React.useState<Record<string, number[]>>({});
  const [manual, setManual] = React.useState<Record<string, number>>({});
  const [paused, setPaused] = React.useState(false);

  // The tick reads these rather than closing over them, so the interval does
  // not need tearing down and rebuilding every time a snapshot arrives.
  const latest = React.useRef(input);
  latest.current = input;
  const manualRef = React.useRef(manual);
  manualRef.current = manual;
  const readingsRef = React.useRef(readings);
  readingsRef.current = readings;

  React.useEffect(() => {
    if (!input.enabled || paused) return;

    const tick = () => {
      if (document.hidden) return;
      const { sensors, types, units, onCrossing } = latest.current;

      // The readings are stepped from a ref rather than inside a setState
      // updater. A side effect in an updater runs twice under StrictMode, and
      // did: every crossing wrote its Log Book entry twice.
      const next = stepReadings({
        sensors,
        types,
        units,
        current: readingsRef.current,
        manual: manualRef.current,
        seconds: TICK_SECONDS,
      });
      readingsRef.current = next;
      setReadings(next);

      setSeries((prev) => {
        const updated: Record<string, number[]> = { ...prev };
        for (const [id, value] of Object.entries(next)) {
          updated[id] = [...(prev[id] ?? []), value].slice(-HISTORY);
        }
        return updated;
      });

      for (const row of crossings(sensors, types, next, statusForReading)) {
        onCrossing(row.sensor.id, row.status, row.reading);
      }
    };

    const timer = setInterval(tick, TICK_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [input.enabled, paused]);

  const hold = React.useCallback((sensorId: string, value: number) => {
    setManual((prev) => ({ ...prev, [sensorId]: value }));
    // Applied immediately rather than on the next tick, so dragging the
    // slider moves the gauge under your finger.
    readingsRef.current = { ...readingsRef.current, [sensorId]: value };
    setReadings(readingsRef.current);
  }, []);

  const release = React.useCallback((sensorId: string) => {
    setManual((prev) => {
      const next = { ...prev };
      delete next[sensorId];
      return next;
    });
  }, []);

  return { readings, series, manual, paused, setPaused, hold, release };
}
