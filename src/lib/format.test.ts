import { describe, expect, it } from "vitest";
import { ageHours, formatAge, formatPeriod, formatStamp } from "./format";

const NOW = new Date("2026-09-18T12:00:00Z").getTime();

describe("ageHours", () => {
  it("never reports a negative age for a future timestamp", () => {
    expect(ageHours(new Date(NOW + 3600_000).toISOString(), NOW)).toBe(0);
  });

  it("rounds to the nearest hour", () => {
    expect(ageHours(new Date(NOW - 90 * 60_000).toISOString(), NOW)).toBe(2);
  });
});

describe("formatAge", () => {
  it("stays in hours inside a day", () => {
    expect(formatAge(new Date(NOW - 5 * 3600_000).toISOString(), NOW)).toBe(
      "5h",
    );
  });

  it("switches to days at 24 hours", () => {
    expect(formatAge(new Date(NOW - 24 * 3600_000).toISOString(), NOW)).toBe(
      "1d",
    );
  });
});

describe("formatPeriod", () => {
  // A whole calendar month is named; anything else shows its span. This is the
  // format the seeded reports already used, so generated ones match them.
  it("names a whole calendar month", () => {
    expect(formatPeriod("2026-09-01", "2026-09-30")).toBe("September 2026");
  });

  it("handles a 31-day month", () => {
    expect(formatPeriod("2026-08-01", "2026-08-31")).toBe("August 2026");
  });

  it("handles February in a non-leap year", () => {
    expect(formatPeriod("2026-02-01", "2026-02-28")).toBe("February 2026");
  });

  it("shows a span for part of a month", () => {
    expect(formatPeriod("2026-09-01", "2026-09-08")).toMatch(
      /^01–08 Sept? 2026$/,
    );
  });

  it("does not call a partial month by its name", () => {
    expect(formatPeriod("2026-09-01", "2026-09-29")).not.toBe("September 2026");
  });

  it("falls back to full dates across a month boundary", () => {
    expect(formatPeriod("2026-08-15", "2026-09-14")).toContain("–");
  });

  // "YYYY-MM-DD" parsed by `new Date` is UTC midnight, which is the previous
  // day anywhere west of Greenwich. The parts are read directly instead.
  it("does not slip a day west of Greenwich", () => {
    expect(formatPeriod("2026-09-01", "2026-09-30")).toBe("September 2026");
    expect(formatPeriod("2026-01-01", "2026-01-31")).toBe("January 2026");
  });

  it("returns a dash rather than throwing on an empty range", () => {
    expect(formatPeriod("", "")).toBe("—");
  });
});

describe("formatStamp", () => {
  it("joins the date and the time", () => {
    expect(formatStamp("2026-09-08T14:00:00Z")).toMatch(/2026/);
    expect(formatStamp("2026-09-08T14:00:00Z")).toContain("·");
  });
});
