import { describe, expect, it } from "vitest";
import { EMPTY_RANGE, withinRange } from "./date-range-filter";

const at = (iso: string) => iso;

describe("withinRange", () => {
  it("lets everything through when both ends are open", () => {
    expect(withinRange(at("2020-01-01T00:00:00Z"), EMPTY_RANGE)).toBe(true);
  });

  it("applies a lower bound alone", () => {
    const range = { from: "2026-09-09T12:00", to: "" };
    expect(withinRange(at("2026-09-09T13:00:00"), range)).toBe(true);
    expect(withinRange(at("2026-09-09T11:00:00"), range)).toBe(false);
  });

  it("applies an upper bound alone", () => {
    const range = { from: "", to: "2026-09-09T12:00" };
    expect(withinRange(at("2026-09-09T11:00:00"), range)).toBe(true);
    expect(withinRange(at("2026-09-09T13:00:00"), range)).toBe(false);
  });

  // Picking "to the 9th" means the end of the 9th. Treating a bare date as
  // midnight would silently drop everything on the filter's last day.
  it("treats a date-only upper bound as the whole of that day", () => {
    const range = { from: "", to: "2026-09-09" };
    expect(withinRange(at("2026-09-09T23:59:00"), range)).toBe(true);
    expect(withinRange(at("2026-09-10T00:01:00"), range)).toBe(false);
  });

  it("does not extend a datetime upper bound to the end of its day", () => {
    const range = { from: "", to: "2026-09-09T12:00" };
    expect(withinRange(at("2026-09-09T23:59:00"), range)).toBe(false);
  });

  it("includes both ends", () => {
    const range = { from: "2026-09-09T12:00", to: "2026-09-09T13:00" };
    expect(withinRange(at("2026-09-09T12:00:00"), range)).toBe(true);
    expect(withinRange(at("2026-09-09T13:00:00"), range)).toBe(true);
  });
});
