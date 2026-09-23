// Turning a number into a status.
//
// A measuring sensor reads a value; its type's bands say which of its own
// statuses that value means. Everything downstream — isAlarm, tone,
// escalation, the actions, the banner, the Log Book — then works exactly as
// it did for a categorical sensor, because a band produces a status id and
// nothing more.
//
// Pure, and tested at every band edge: whether 27 is "normal" or "warm" is
// the kind of thing that is quietly wrong forever.

import type { SensorBand, SensorTypeDef } from "@/lib/types";

/** Whether this type reads a number at all. A door lock does not. */
export function isMeasuring(type: SensorTypeDef | undefined): boolean {
  return Boolean(type?.measurement && type.measurement.bands.length > 0);
}

/**
 * The band a reading falls in: the first whose `upTo` is null or at least the
 * reading. Null when the type does not measure, or its bands are malformed.
 *
 * `upTo` is inclusive, so a band ending at 27 owns 27 and the next one starts
 * above it. Stated because the alternative is equally defensible and the
 * choice has to be somewhere.
 */
export function bandFor(
  type: SensorTypeDef | undefined,
  reading: number,
): SensorBand | null {
  const m = type?.measurement;
  if (!m || !Number.isFinite(reading)) return null;
  for (const band of m.bands) {
    if (band.upTo === null || reading <= band.upTo) return band;
  }
  // Only reachable when the last band is not the null catch-all, which the
  // editor refuses to save. Falling back to the topmost band beats returning
  // nothing and leaving the sensor without a status.
  return m.bands[m.bands.length - 1] ?? null;
}

export function statusForReading(
  type: SensorTypeDef | undefined,
  reading: number,
): string | null {
  return bandFor(type, reading)?.statusId ?? null;
}

/** Keeps a reading inside the gauge, so a forced value cannot leave the dial. */
export function clampToRange(
  type: SensorTypeDef | undefined,
  reading: number,
): number {
  const m = type?.measurement;
  if (!m) return reading;
  return Math.min(m.max, Math.max(m.min, reading));
}

/** Where a reading sits on the gauge, 0–1. */
export function gaugeFraction(
  type: SensorTypeDef | undefined,
  reading: number,
): number {
  const m = type?.measurement;
  if (!m || m.max === m.min) return 0;
  return (clampToRange(type, reading) - m.min) / (m.max - m.min);
}

/** The reading as it is written on screen, with its unit. */
export function formatReading(
  type: SensorTypeDef | undefined,
  reading: number | undefined,
): string {
  const m = type?.measurement;
  if (!m || reading === undefined || !Number.isFinite(reading)) return "—";
  return `${reading.toFixed(m.decimals)} ${m.unit}`;
}

/**
 * Why a set of bands cannot be saved, or null when they can.
 *
 * Ascending and ending in a catch-all is what makes `bandFor` total. Without
 * the check a type could be saved that leaves some readings with no status at
 * all, and the sensor would simply stop updating.
 */
export function bandsRefusal(
  bands: SensorBand[],
  statusIds: string[],
): string | null {
  if (bands.length === 0) return "A measuring type needs at least one band.";
  const last = bands[bands.length - 1];
  if (last.upTo !== null) {
    return "The last band must have no upper limit — it catches every reading above the others.";
  }
  for (const band of bands) {
    if (!statusIds.includes(band.statusId)) {
      return `No status on this type is called "${band.statusId}".`;
    }
  }
  const limits = bands.slice(0, -1).map((b) => b.upTo as number);
  if (limits.some((n) => !Number.isFinite(n))) {
    return "Every band except the last needs an upper limit.";
  }
  for (let i = 1; i < limits.length; i += 1) {
    if (limits[i] <= limits[i - 1]) {
      return "Band limits have to climb — each one above the last.";
    }
  }
  return null;
}
