export function ageHours(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 3600000));
}

export function formatAge(iso: string, now = Date.now()): string {
  const hours = ageHours(iso, now);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function isAging(
  iso: string,
  priority: "normal" | "high",
  now = Date.now(),
): boolean {
  return priority === "high" && ageHours(iso, now) > 24;
}

export function formatClock(date = new Date()): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * The absolute moment, for the places where "8d" is not enough — a request
 * row has to say when it actually came in, not only how old it is.
 */
export function formatStamp(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

/**
 * The label a generated report carries, read back from the dates it covers:
 * a whole calendar month reads as its name, anything else as its span. The
 * "YYYY-MM-DD" parts are read directly rather than through `new Date`, which
 * would treat them as UTC midnight and slip a day west of Greenwich.
 */
export function formatPeriod(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (!fy || !ty) return "—";
  const start = new Date(fy, fm - 1, fd);
  if (fy === ty && fm === tm) {
    const lastDay = new Date(ty, tm, 0).getDate();
    if (fd === 1 && td === lastDay) {
      return start.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });
    }
    const month = start.toLocaleDateString("en-GB", { month: "short" });
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(fd)}–${pad(td)} ${month} ${fy}`;
  }
  return `${formatDate(new Date(fy, fm - 1, fd).toISOString())} – ${formatDate(
    new Date(ty, tm - 1, td).toISOString(),
  )}`;
}

export function formatMmk(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} MMK`;
}

export function formatRelative(iso: string): string {
  const hours = ageHours(iso);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
