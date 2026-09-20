import { describe, expect, it } from "vitest";
import {
  buildingDeletionRefusal,
  floorsFor,
  roomsToCascade,
} from "./estate-rules";
import type { Room } from "./types";

const estate = (
  over: Partial<Parameters<typeof buildingDeletionRefusal>[1]> = {},
) => ({
  units: [],
  sensors: [],
  requests: [],
  ...over,
});

describe("buildingDeletionRefusal", () => {
  it("allows a building nothing points at", () => {
    expect(buildingDeletionRefusal("b216", estate())).toBeNull();
  });

  // Rooms belong to the building and go with it — they are not a reason to
  // refuse. Anything that could outlive it is.
  it("does not count rooms as a reason to refuse", () => {
    expect(buildingDeletionRefusal("b216", estate())).toBeNull();
  });

  it("refuses while equipment is still registered there", () => {
    const refusal = buildingDeletionRefusal(
      "b216",
      estate({ units: [{ buildingId: "b216" }, { buildingId: "b216" }] }),
    );
    expect(refusal).toContain("2 equipment units");
  });

  it("counts one thing in the singular", () => {
    const refusal = buildingDeletionRefusal(
      "b216",
      estate({ sensors: [{ buildingId: "b216" }] }),
    );
    expect(refusal).toContain("1 sensor");
    expect(refusal).not.toContain("1 sensors");
  });

  it("ignores a closed request but counts an open one", () => {
    const closed = buildingDeletionRefusal(
      "b216",
      estate({ requests: [{ buildingId: "b216", status: "completed" }] }),
    );
    expect(closed).toBeNull();

    const open = buildingDeletionRefusal(
      "b216",
      estate({ requests: [{ buildingId: "b216", status: "requested" }] }),
    );
    expect(open).toContain("1 open request");
  });

  it("ignores everything belonging to another building", () => {
    const refusal = buildingDeletionRefusal(
      "b216",
      estate({
        units: [{ buildingId: "b209" }],
        sensors: [{ buildingId: "jsq" }],
      }),
    );
    expect(refusal).toBeNull();
  });

  it("lists every reason at once, readably", () => {
    const refusal = buildingDeletionRefusal(
      "b216",
      estate({
        units: [{ buildingId: "b216" }],
        sensors: [{ buildingId: "b216" }],
        requests: [{ buildingId: "b216", status: "in-progress" }],
      }),
    );
    expect(refusal).toBe(
      "This building still holds 1 equipment unit, 1 sensor and 1 open request. Move or remove them before deleting it.",
    );
  });
});

describe("roomsToCascade", () => {
  const rooms = [
    { id: "r-1", buildingId: "b216" },
    { id: "r-2", buildingId: "b209" },
    { id: "r-3", buildingId: "b216" },
  ] as Room[];

  it("takes only the building's own rooms", () => {
    expect(roomsToCascade("b216", rooms).map((r) => r.id)).toEqual([
      "r-1",
      "r-3",
    ]);
  });

  it("returns nothing for a building with no rooms", () => {
    expect(roomsToCascade("jsq", rooms)).toEqual([]);
  });
});

describe("floorsFor", () => {
  it("offers ground plus one option per storey", () => {
    expect(floorsFor(3)).toEqual(["G", "1", "2", "3"]);
  });

  it("gives a single-storey building only the ground floor", () => {
    // The room form used to offer G/1/2/3 whatever the building, so a
    // two-storey block accepted a Floor 3 room.
    expect(floorsFor(1)).toEqual(["G", "1"]);
    expect(floorsFor(0)).toEqual(["G"]);
  });

  it("never returns a fractional or negative floor", () => {
    expect(floorsFor(2.7)).toEqual(["G", "1", "2"]);
    expect(floorsFor(-4)).toEqual(["G"]);
  });
});
