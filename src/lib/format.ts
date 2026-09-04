/**
 * Schweizer Formatierung für Kundi Catch.
 * Zeitzone: Europe/Zurich, Währung: CHF, Locale: de-CH.
 */

export const APP_TIMEZONE = "Europe/Zurich";
export const APP_LOCALE = "de-CH";
export const APP_CURRENCY = "CHF";

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const currencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "percent",
  maximumFractionDigits: 0,
});

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: Date | string): string {
  return dateFormatter.format(toDate(value));
}

export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(toDate(value));
}

export function formatWeekday(value: Date | string): string {
  return weekdayFormatter.format(toDate(value));
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatQuantity(value: number, unit: string): string {
  const formatted = new Intl.NumberFormat(APP_LOCALE, {
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} ${unit}`;
}

export function formatPercent(fraction: number): string {
  return percentFormatter.format(fraction);
}

/** Offset (ms) zwischen Europe/Zurich-Wanduhr und UTC zum gegebenen Zeitpunkt. */
function zurichOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** "2026-03-14T17:30" (Zürcher Wanduhr) -> ISO-Zeitstempel in UTC. */
export function zurichLocalToIso(local: string): string | null {
  if (!local) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number) as unknown as number[];
  const naive = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  let ts = naive - zurichOffsetMs(new Date(naive));
  ts = naive - zurichOffsetMs(new Date(ts));
  return new Date(ts).toISOString();
}

/** ISO-Zeitstempel -> "2026-03-14T17:30" für <input type="datetime-local">. */
export function isoToZurichLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
