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
