import { describe, expect, it } from "vitest";
import { type CsvColumn, toCsv } from "./export";

interface Row {
  text: string;
  count: number;
  note?: string;
}

const columns: CsvColumn<Row>[] = [
  { header: "Record", value: (r) => r.text },
  { header: "Count", value: (r) => r.count },
  { header: "Note", value: (r) => r.note },
];

describe("toCsv", () => {
  it("writes a header even with no rows", () => {
    expect(toCsv([], columns)).toBe("Record,Count,Note");
  });

  it("separates rows with CRLF, as RFC 4180 asks", () => {
    const csv = toCsv(
      [
        { text: "a", count: 1 },
        { text: "b", count: 2 },
      ],
      columns,
    );
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("leaves an ordinary field unquoted", () => {
    expect(
      toCsv([{ text: "Nightly backup completed", count: 1 }], columns),
    ).toContain("Nightly backup completed,1,");
  });

  // The one that matters: a record description with a comma in it would
  // otherwise shift every later column by one, silently.
  it("quotes a field containing a comma", () => {
    const csv = toCsv(
      [{ text: "Filter replaced, unit retested", count: 3 }],
      columns,
    );
    expect(csv).toContain('"Filter replaced, unit retested",3,');
  });

  it("doubles an embedded quote and wraps the field", () => {
    const csv = toCsv(
      [{ text: 'Reset the "faulty" detector', count: 1 }],
      columns,
    );
    expect(csv).toContain('"Reset the ""faulty"" detector"');
  });

  it("quotes a field containing a newline rather than breaking the row", () => {
    const csv = toCsv([{ text: "line one\nline two", count: 1 }], columns);
    expect(csv).toContain('"line one\nline two"');
    // Three lines of text, but only two CSV records: header and one row.
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("writes an empty cell for a missing optional value", () => {
    expect(toCsv([{ text: "a", count: 0 }], columns)).toContain("a,0,");
  });

  it("keeps zero rather than blanking it", () => {
    const csv = toCsv([{ text: "a", count: 0, note: "n" }], columns);
    expect(csv.endsWith("a,0,n")).toBe(true);
  });

  it("preserves non-ASCII text", () => {
    expect(
      toCsv([{ text: "Access denied — unknown card", count: 1 }], columns),
    ).toContain("Access denied — unknown card");
  });
});
