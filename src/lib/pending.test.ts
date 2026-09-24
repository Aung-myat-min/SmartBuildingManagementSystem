// The floor is arithmetic, and the arithmetic is the whole point: hold a fast
// write long enough to see, never slow a slow one.

import { describe, expect, it, vi } from "vitest";
import { PENDING_FLOOR_MS, remainingFloor, withMinDuration } from "./pending";

describe("remainingFloor", () => {
  it("holds a fast write for what is left of the floor", () => {
    expect(remainingFloor(50)).toBe(PENDING_FLOOR_MS - 50);
  });

  it("does not hold a write that already outran the floor", () => {
    expect(remainingFloor(PENDING_FLOOR_MS)).toBe(0);
    expect(remainingFloor(5000)).toBe(0);
  });

  it("treats a nonsense clock as no time passed rather than negative time", () => {
    expect(remainingFloor(-10)).toBe(PENDING_FLOOR_MS);
    expect(remainingFloor(Number.NaN)).toBe(PENDING_FLOOR_MS);
  });
});

describe("withMinDuration", () => {
  it("returns the value, held to the floor", async () => {
    vi.useFakeTimers();
    let clock = 0;
    const now = () => clock;
    const promise = withMinDuration(Promise.resolve("ok"), 400, now);
    clock = 50;
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toBe("ok");
    vi.useRealTimers();
  });

  it("does not wait at all when the work outran the floor", async () => {
    let clock = 0;
    const now = () => (clock += 1000);
    await expect(withMinDuration(Promise.resolve(7), 400, now)).resolves.toBe(
      7,
    );
  });

  it("surfaces a failure immediately rather than holding it", async () => {
    // A floor on an error is just a delay — the one case it buys nothing.
    const started = Date.now();
    await expect(
      withMinDuration(Promise.reject(new Error("nope")), 5000),
    ).rejects.toThrow("nope");
    expect(Date.now() - started).toBeLessThan(200);
  });
});
