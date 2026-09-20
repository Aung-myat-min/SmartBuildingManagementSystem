// The corpus has to agree with itself.
//
// In memory, a request naming one room and its unit naming another just
// rendered two strings on two screens. As documents people edit, the same
// inconsistency is permanent and starts producing wrong counts. This suite
// turns it into a failing build. Runs against the seed literals directly,
// not through the provider.

import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  EQUIPMENT_UNITS,
  equipmentForSensor,
  MAINTENANCE_REQUESTS,
  ROOMS,
  SENSOR_TYPES,
  SENSORS,
} from "./mock-data";

const buildingIds = new Set(BUILDINGS.map((b) => b.id));
const roomById = new Map(ROOMS.map((r) => [r.id, r]));
const unitById = new Map(EQUIPMENT_UNITS.map((u) => [u.id, u]));
const typeById = new Map(SENSOR_TYPES.map((t) => [t.id, t]));

describe("the estate", () => {
  it("gives every room a building that exists", () => {
    for (const room of ROOMS) {
      expect(buildingIds, room.id).toContain(room.buildingId);
    }
  });

  it("gives every building at least one room", () => {
    for (const building of BUILDINGS) {
      const rooms = ROOMS.filter((r) => r.buildingId === building.id);
      expect(rooms.length, building.id).toBeGreaterThan(0);
    }
  });
});

describe("the equipment register", () => {
  it("puts every unit in a room that exists", () => {
    for (const unit of EQUIPMENT_UNITS) {
      expect(roomById.has(unit.roomId), unit.id).toBe(true);
    }
  });

  it("keeps a unit's building the same as its room's building", () => {
    for (const unit of EQUIPMENT_UNITS) {
      expect(roomById.get(unit.roomId)?.buildingId, unit.id).toBe(
        unit.buildingId,
      );
    }
  });

  it("uses one identifier — the id is the tag", () => {
    // The join key. Until every reference moves to `id`, renaming a tag
    // silently orphans the sensor link, the request, the history and the log.
    for (const unit of EQUIPMENT_UNITS) {
      expect(unit.tag, unit.id).toBe(unit.id);
    }
  });

  it("gives every unit a unique tag", () => {
    const tags = EQUIPMENT_UNITS.map((u) => u.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe("sensors", () => {
  it("puts every sensor in a room that exists, in its own building", () => {
    for (const sensor of SENSORS) {
      const room = roomById.get(sensor.roomId);
      expect(room, sensor.id).toBeDefined();
      expect(room?.buildingId, sensor.id).toBe(sensor.buildingId);
    }
  });

  it("gives every sensor a type in the registry", () => {
    for (const sensor of SENSORS) {
      expect(typeById.has(sensor.typeId), sensor.id).toBe(true);
    }
  });

  it("only ever reports a status its own type declares", () => {
    for (const sensor of SENSORS) {
      const statuses = typeById.get(sensor.typeId)?.statuses ?? [];
      expect(
        statuses.map((s) => s.id),
        sensor.id,
      ).toContain(sensor.status);
    }
  });

  it("resolves every linked equipment unit", () => {
    for (const sensor of SENSORS) {
      if (!sensor.linkedEquipmentId) continue;
      expect(
        equipmentForSensor(sensor),
        `${sensor.id} → ${sensor.linkedEquipmentId}`,
      ).toBeDefined();
    }
  });

  it("puts a linked sensor and its unit in the same room", () => {
    // One physical device, two records. They cannot be in two places.
    for (const sensor of SENSORS) {
      const unit = equipmentForSensor(sensor);
      if (!unit) continue;
      expect(unit.roomId, sensor.id).toBe(sensor.roomId);
    }
  });
});

describe("the sensor type registry", () => {
  it("gives every type at least one status", () => {
    for (const type of SENSOR_TYPES) {
      expect(type.statuses.length, type.id).toBeGreaterThan(0);
    }
  });

  it("keeps status ids unique within a type", () => {
    for (const type of SENSOR_TYPES) {
      const ids = type.statuses.map((s) => s.id);
      expect(new Set(ids).size, type.id).toBe(ids.length);
    }
  });

  it("only ever results in a status the type has", () => {
    for (const type of SENSOR_TYPES) {
      const ids = type.statuses.map((s) => s.id);
      for (const action of type.actions) {
        expect(ids, `${type.id}/${action.id}`).toContain(action.resultStatus);
      }
    }
  });
});

describe("maintenance requests", () => {
  it("gives every request a room that exists, in its own building", () => {
    for (const request of MAINTENANCE_REQUESTS) {
      const room = roomById.get(request.roomId);
      expect(room, request.id).toBeDefined();
      expect(room?.buildingId, request.id).toBe(request.buildingId);
    }
  });

  it("resolves every request to an equipment unit", () => {
    for (const request of MAINTENANCE_REQUESTS) {
      expect(unitById.has(request.equipmentId), request.id).toBe(true);
    }
  });

  it("raises a request against a unit in the room it names", () => {
    // The drawer says "raised against a specific unit so the register and the
    // request stay in step". This is that promise, enforced.
    for (const request of MAINTENANCE_REQUESTS) {
      const unit = unitById.get(request.equipmentId);
      if (!unit) continue;
      expect(unit.roomId, request.id).toBe(request.roomId);
    }
  });

  it("gives every request a unique id", () => {
    const ids = MAINTENANCE_REQUESTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
