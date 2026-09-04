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
