// The estate, pretending to be instrumented.
//
// There are no devices behind this app, so readings have to come from
// somewhere. They come from here: a bounded random walk per sensor, pulled
// toward a resting value, and bent by any HVAC unit in the same room.
//
// Pure and stepped, so the interesting part is testable — the timer that
// calls it lives in a hook and does nothing else.
//
// Driven by the type registry, never a list of sensor ids. Any sensor whose
// type has a `measurement` is simulated, so one created in the app starts
// moving the moment it exists.

import { clampToRange } from "@/lib/sensor-readings";
import type {
  EnvironmentalSensor,
  EquipmentUnit,
  RoomType,
  SensorTypeDef,
} from "@/lib/types";

export interface SimulationInput {
  sensors: EnvironmentalSensor[];
  types: SensorTypeDef[];
  /** For HVAC influence — a unit cooling a room drags its temperature down. */
  units: EquipmentUnit[];
  /** sensorId → reading. Missing means "start from the sensor's own value". */
  current: Record<string, number>;
  /** sensorId → a value someone is holding. Held sensors do not drift. */
  manual: Record<string, number>;
  seconds: number;
  /** Injected so a test can make the walk deterministic. */
  random?: () => number;
}

/** How fast a reading moves on its own, per second, as a share of its range. */
const DRIFT_PER_SECOND = 0.004;

/** How strongly a reading is pulled back toward its resting point. */
const SETTLE_PER_SECOND = 0.02;

/** Degrees per second an HVAC unit moves a room, at fan speed 1. */
const HVAC_PER_SECOND = 0.05;

/**
 * Where a reading sits when nothing is acting on it — a third of the way up
 * the range rather than the middle, so a sensor at rest reads "comfortable"
 * rather than hovering on a band edge and flapping between two statuses.
 */
function restingValue(type: SensorTypeDef): number {
  const m = type.measurement;
  if (!m) return 0;
  return m.min + (m.max - m.min) * 0.35;
}

/**
 * The HVAC unit acting on a room, if any. The first one found: a room with
 * two air conditioners fighting each other is not a case worth modelling.
 */
function hvacFor(
  roomId: string,
  units: EquipmentUnit[],
): EquipmentUnit["hvac"] {
  const unit = units.find(
    (u) =>
      u.roomId === roomId &&
      u.hvac &&
      u.hvac.mode !== "off" &&
      u.condition !== "decommissioned" &&
      u.condition !== "faulty",
  );
  return unit?.hvac;
}

export function stepReadings(input: SimulationInput): Record<string, number> {
  const rand = input.random ?? Math.random;
  const typeById = new Map(input.types.map((t) => [t.id, t]));
  const next: Record<string, number> = {};

  for (const sensor of input.sensors) {
    const type = typeById.get(sensor.typeId);
    const m = type?.measurement;
    if (!type || !m) continue;

    // A held sensor keeps its value exactly. That is the point of holding it.
    const held = input.manual[sensor.id];
    if (held !== undefined) {
      next[sensor.id] = clampToRange(type, held);
      continue;
    }

    const from =
      input.current[sensor.id] ?? sensor.reading ?? restingValue(type);
    const span = m.max - m.min;
    const dt = input.seconds;

    // Random walk, plus a pull toward rest so it cannot wander to an edge and
    // stick there.
    const wander = (rand() - 0.5) * 2 * span * DRIFT_PER_SECOND * dt;
    const settle = (restingValue(type) - from) * SETTLE_PER_SECOND * dt;

    // Only temperature answers to HVAC. Humidity and air quality would need a
    // model this demo does not have, and inventing one would be dressing.
    let forced = 0;
    let conditioned = false;
    if (type.id === "temperature") {
      const hvac = hvacFor(sensor.roomId, input.units);
      if (hvac) {
        conditioned = true;
        const target =
          hvac.mode === "fan" ? restingValue(type) : hvac.setpointC;
        const rate = HVAC_PER_SECOND * hvac.fan * dt;
        const gap = target - from;
        // A cooler cools. Setting "cool" to 22 in a 19 °C room used to *warm*
        // it to 22, because the step only asked which way the setpoint was and
        // never what the machine can do. Each mode may push one way only; with
        // the setpoint already passed there is nothing to do and the room is
        // left to its own drift.
        const allowed =
          hvac.mode === "cool"
            ? Math.min(0, gap)
            : hvac.mode === "heat"
              ? Math.max(0, gap)
              : gap;
        // Move toward the setpoint without stepping past it, or the reading
        // would oscillate around the target instead of settling on it.
        forced = Math.sign(allowed) * Math.min(Math.abs(allowed), rate);
      }
    }

    // A room with a unit running in it is a conditioned room: its pull
    // dominates, and the settle term — which drags an unattended room back to
    // ambient — is off entirely. Keyed on the unit running rather than on it
    // currently having work to do, or a cooler that has reached its setpoint
    // would let the room slide to ambient and then have to chase it back.
    const moved = conditioned
      ? from + forced + wander * 0.2
      : from + wander + settle;
    next[sensor.id] = clampToRange(type, moved);
  }

  return next;
}

/**
 * How far past a band edge a reading must go before the crossing counts, as a
 * share of the range. Without it a sensor resting on a boundary flips back
 * and forth every tick, writing a status change and a Log Book entry each
 * time — which is exactly what happened the first time this ran.
 */
const HYSTERESIS = 0.015;

/**
 * Sensors whose band has changed, and so need writing.
 *
 * This is the whole persistence story: the series is local and every tick
 * redraws the chart, but Firestore only hears about a crossing. At one tick
 * every few seconds across a few dozen sensors, storing each one would be
 * tens of thousands of writes an hour and would tell nobody anything.
 *
 * A crossing is only accepted when the reading is clear of the edge on both
 * sides of the margin — near a boundary the sensor keeps the status it has.
 */
export function crossings(
  sensors: EnvironmentalSensor[],
  types: SensorTypeDef[],
  readings: Record<string, number>,
  /**
   * Takes the room type as well as the reading, because a server room is
   * judged by stricter limits than a lecture hall — see `bandsFor`. Passing
   * the room is what makes an override actually fire an alarm rather than
   * only change what the screen says.
   */
  statusFor: (
    type: SensorTypeDef | undefined,
    reading: number,
    roomType?: RoomType,
  ) => string | null,
  roomTypeOf?: (roomId: string) => RoomType | undefined,
): { sensor: EnvironmentalSensor; status: string; reading: number }[] {
  const typeById = new Map(types.map((t) => [t.id, t]));
  const out: {
    sensor: EnvironmentalSensor;
    status: string;
    reading: number;
  }[] = [];

  for (const sensor of sensors) {
    const raw = readings[sensor.id];
    if (raw === undefined) continue;
    const type = typeById.get(sensor.typeId);
    const m = type?.measurement;
    if (!m) continue;

    const reading = roundTo(raw, m.decimals);
    const roomType = roomTypeOf?.(sensor.roomId);
    const status = statusFor(type, reading, roomType);
    if (!status || status === sensor.status) continue;

    // Both edges of the margin have to agree, or we are sitting on a boundary.
    const margin = (m.max - m.min) * HYSTERESIS;
    if (
      statusFor(type, reading - margin, roomType) !== status ||
      statusFor(type, reading + margin, roomType) !== status
    ) {
      continue;
    }

    out.push({ sensor, status, reading });
  }
  return out;
}

/** Readings are stored at the precision the type claims, not at float noise. */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
