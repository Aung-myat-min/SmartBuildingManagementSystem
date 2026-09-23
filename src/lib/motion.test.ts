import { describe, expect, it } from "vitest";
import { staggerMs, staggerStyle } from "./motion";

describe("staggerMs", () => {
  it("steps one row at a time", () => {
    expect(staggerMs(0)).toBe(0);
    expect(staggerMs(1)).toBe(22);
    expect(staggerMs(3)).toBe(66);
  });

  it("caps, so a long list does not take seconds to appear", () => {
    expect(staggerMs(12)).toBe(staggerMs(400));
    expect(staggerMs(400)).toBeLessThan(300);
  });

  it("treats a negative index as the first row", () => {
    expect(staggerMs(-5)).toBe(0);
  });
});

describe("staggerStyle", () => {
  it("writes the delay as a CSS duration", () => {
    expect(staggerStyle(2)).toEqual({ animationDelay: "44ms" });
  });
});
