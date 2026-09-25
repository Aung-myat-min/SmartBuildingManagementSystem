// Turning what the app stores into what a chart can draw.
//
// A sensor's history comes from two places that are not the same kind of thing,
// and the whole job of this module is to keep them apart:
//
//   - the **live** series, in memory, one point every few seconds, which is a
//     continuous measurement and is drawn as a curve;
//   - the **recorded** series, from Log Book crossings, which is only the
//     moments a reading changed band and is drawn as a step.
//
// Putting them on one axis would imply a resolution the record does not have —
// a flat line across an afternoon nobody measured. They stay separate, and the
// caller picks one.
//
// Pure, so the shaping is testable without Firestore, a clock or a browser.

import type { LogBookEntry, SensorTypeDef } from "@/lib/types";

/** One point on a reading chart. `at` is epoch ms, which is what a time axis wants. */
export interface ReadingPoint {
  at: number;
  value: number;
  /** Present on a recorded point: the status the reading put the sensor in. */
  statusId?: string;
}

/** A band drawn as a background region, in chart units. */
export interface BandZone {
  statusId: string;
  from: number;
  to: number;
}

/**
 * The persisted history for one sensor, newest-last.
 *
 * Entries from before the reading was stored have no number; they are dropped
 * rather than plotted at zero, which would be a lie in the shape of data.
 */
export function recordedSeries(
  entries: LogBookEntry[],
  sensorId: string,
  sinceMs: number,
): ReadingPoint[] {
  return entries
    .filter(
      (e) =>
        e.refId === sensorId &&
        typeof e.reading === "number" &&
        Number.isFinite(e.reading),
    )
    .map((e) => ({
      at: new Date(e.timestamp).getTime(),
      value: e.reading as number,
      statusId: undefined,
    }))
    .filter((p) => Number.isFinite(p.at) && p.at >= sinceMs)
    .sort((a, b) => a.at - b.at);
}

/**
 * The in-memory series as points on a time axis.
 *
 * The simulation keeps values without timestamps — it is a fixed-length window
 * stepped at a known rate — so the times are reconstructed backwards from now.
 * The last point is the present; each earlier one is one tick before it.
 */
export function liveSeries(
  values: number[],
  tickSeconds: number,
  nowMs: number,
): ReadingPoint[] {
  const step = tickSeconds * 1000;
  const last = values.length - 1;
  return values.map((value, i) => ({ at: nowMs - (last - i) * step, value }));
}

/**
 * The type's bands as regions to paint behind the series.
 *
 * The first band starts at the dial's floor and the last ends at its ceiling,
 * so the regions tile the plot exactly — `upTo: null` means "everything above",
 * which on a chart has to become a number.
 */
export function bandZones(type: SensorTypeDef | undefined): BandZone[] {
  const m = type?.measurement;
  if (!m) return [];
  let from = m.min;
  const zones: BandZone[] = [];
  for (const band of m.bands) {
    const to = band.upTo === null ? m.max : Math.min(band.upTo, m.max);
    if (to > from) zones.push({ statusId: band.statusId, from, to });
    from = to;
  }
  return zones;
}

/**
 * What the y-axis should span.
 *
 * Not simply the dial's full range: a temperature that lives between 18 and 22
 * on a 5–45 dial would be a flat line across the middle of an empty chart.
 * This takes the data's own range, pads it, and then keeps whichever band
 * edges fall inside — so the thresholds that matter stay visible and the ones
 * far away do not squash the series.
 */
export function readingDomain(
  type: SensorTypeDef | undefined,
  points: ReadingPoint[],
  /**
   * A line that has to stay in frame even when the data never goes near it —
   * an HVAC setpoint, which is the whole point of the chart it sits on and was
   * being clipped out of view by the framing below.
   */
  keepInView?: number,
): [number, number] {
  const m = type?.measurement;
  if (!m) return [0, 1];
  if (points.length === 0) return [m.min, m.max];

  const values = points.map((p) => p.value);
  if (keepInView !== undefined && Number.isFinite(keepInView)) {
    values.push(keepInView);
  }
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A pad proportional to the spread, with a floor so a dead-flat series still
  // gets a chart rather than a line on the axis.
  const pad = Math.max((high - low) * 0.35, (m.max - m.min) * 0.04);
  return [
    Math.max(m.min, Math.floor(low - pad)),
    Math.min(m.max, Math.ceil(high + pad)),
  ];
}
