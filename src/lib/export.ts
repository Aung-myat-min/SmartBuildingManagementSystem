"use client";

// ============================================================================
// Real file export. Both the Historical Records ledger and the Reports library
// claimed to export and only raised a toast; this is the one implementation
// they share, so a second caller cannot quietly diverge on quoting rules.
// ============================================================================

/** A column: its header, and how to read it off a row. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | undefined | null;
}

/**
 * RFC 4180 quoting. A field is quoted when it contains a comma, a quote or a
 * newline, and an embedded quote is doubled. Skipping this is how an issue
 * description with a comma in it silently shifts every later column.
 */
function csvCell(raw: string | number | undefined | null): string {
  const value = raw === undefined || raw === null ? "" : String(raw);
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => csvCell(c.value(row))).join(","),
  );
  return [header, ...body].join("\r\n");
}

/**
 * Hands the browser a file. A BOM goes first because Excel reads a UTF-8 CSV
 * as the system codepage without one, which mangles every non-ASCII name in
 * the estate — and the object URL is revoked, because a page that exports a
 * few times an hour should not leak a blob per press.
 */
export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const blob = new Blob([`﻿${toCsv(rows, columns)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** `records-2026-09-18.csv` — sortable, and unambiguous between locales. */
export function stampedFilename(prefix: string, extension = "csv"): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${prefix}-${date}.${extension}`;
}

/**
 * PDF via the browser's own print dialog, which every browser can render to
 * PDF. It needs no dependency and no server, and what it prints is the page
 * the reader is looking at — `@media print` in globals.css hides the shell so
 * only the report itself lands on the page.
 */
export function printToPdf(): void {
  window.print();
}
