/**
 * Deterministische Erzeugung des WhatsApp-Posts aus Catch-Daten.
 *
 * Kein KI-Dienst: fixes Template, optionale Zeilen fallen sauber weg.
 * Nur die beiden freigegebenen Markentexte werden verwendet.
 */

import { QUANTITY_UNIT_LABELS } from "@/lib/catch-domain";
import { APP_LOCALE, APP_TIMEZONE, formatDate } from "@/lib/format";

export const BRAND_CLAIM = "Guter Fisch. Kleines Handicap. Grosser Fang.";
export const BRAND_CALL = "Schnell sein. Gut essen. Food Waste vermeiden.";

export interface PostSource {
  product_name: string;
  description: string | null;
  packaging: string | null;
  expiry_date: string | null;
  regular_price: number | null;
  catch_price: number | null;
  quantity_unit: string;
  location_names: string[];
  available_from: string | null;
  available_until: string | null;
  handicap_story: string | null;
  image_path: string | null;
}

/** Anzeigeeinheit für den Post (nie interne Datenbankwerte). */
export function unitLabel(unit: string): string {
  if (unit === "kg") return "kg";
  if (unit === "Stk") return "Stück";
  return QUANTITY_UNIT_LABELS[unit] ?? unit;
}

/** Preis im Postformat: "CHF 7.90/kg" (immer zwei Nachkommastellen). */
export function postPrice(value: number, unit: string): string {
  return `CHF ${value.toFixed(2)}/${unitLabel(unit)}`;
}

const timeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** Einheitliches Datumsformat im Post: "04.09.2026 ab 14:00 Uhr". */
export function postDateTime(value: string, prefix: "ab" | "bis"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDate(date)} ${prefix} ${timeFormatter.format(date)} Uhr`;
}

/** Prozentwert im Post: "26.5 %". */
export function postPercent(percent: number): string {
  return `${percent.toFixed(1)} %`;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[\s\u2013\u2014-]+/g, " ").trim();
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Erzeugt den vollständigen WhatsApp-Text.
 * Optionale Zeilen ohne Wert entfallen restlos.
 */
export function generatePostText(source: PostSource): string {
  const blocks: string[] = [];

  blocks.push("🐟 *KUNDI CATCH*");
  blocks.push(`*${BRAND_CLAIM}*`);

  const story = clean(source.handicap_story);
  if (story) blocks.push(story);

  const productLines: string[] = [`*${source.product_name.trim()}*`];
  const description = clean(source.description);
  if (description) productLines.push(description);
  const packaging = clean(source.packaging);
  if (packaging && !(description && normalise(description).includes(normalise(packaging)))) {
    productLines.push(packaging);
  }
  blocks.push(productLines.join("\n"));

  const catchPrice = source.catch_price;
  if (catchPrice !== null && catchPrice > 0) {
    const regular = source.regular_price;
    const hasComparison = regular !== null && Number.isFinite(regular) && regular > catchPrice;
    if (hasComparison) {
      const discount = ((regular - catchPrice) / regular) * 100;
      blocks.push(
        `~${postPrice(regular, source.quantity_unit)}~ → *${postPrice(catchPrice, source.quantity_unit)}* 🔥\n${postPercent(discount)} günstiger`,
      );
    } else {
      blocks.push(`*KUNDI CATCH ${postPrice(catchPrice, source.quantity_unit)}* 🔥`);
    }
  }

  const stockLines: string[] = [];
  if (source.expiry_date) stockLines.push(`MHD: ${formatDate(source.expiry_date)}`);
  stockLines.push("*Nur solange Vorrat.*");
  blocks.push(stockLines.join("\n"));

  const actionLines: string[] = [];
  const locations = source.location_names.filter((name) => clean(name));
  if (locations.length === 1) {
    actionLines.push(`📍 Abholung: ${locations[0]}`);
  } else if (locations.length > 1) {
    actionLines.push(`📍 Abholung:\n${locations.map((name) => `• ${name}`).join("\n")}`);
  }
  if (source.available_from) {
    actionLines.push(`📅 Ab: ${postDateTime(source.available_from, "ab")}`);
  }
  if (source.available_until) {
    actionLines.push(`📅 Verfügbar bis: ${postDateTime(source.available_until, "bis")}`);
  }
  if (actionLines.length > 0) blocks.push(actionLines.join("\n"));

  blocks.push(`*${BRAND_CALL}*`);

  return blocks.join("\n\n");
}

/**
 * Signatur der postrelevanten Catch-Daten.
 * Ändert sie sich nach der Generierung, gilt der Post als möglicherweise veraltet.
 */
export function postSourceSignature(source: PostSource): string {
  return JSON.stringify([
    source.product_name.trim(),
    clean(source.description),
    clean(source.packaging),
    source.expiry_date,
    source.regular_price,
    source.catch_price,
    source.quantity_unit,
    [...source.location_names].sort(),
    source.available_from,
    source.available_until,
    clean(source.handicap_story),
    source.image_path,
  ]);
}

export interface PreviewSegment {
  text: string;
  bold: boolean;
  strike: boolean;
}

/**
 * Zerlegt eine Zeile in Segmente für die Vorschau.
 * Die Formatzeichen bleiben im kopierten Text erhalten — nur die Anzeige interpretiert sie.
 */
export function parsePostLine(line: string): PreviewSegment[] {
  const segments: PreviewSegment[] = [];
  const pattern = /(\*[^*\n]+\*|~[^~\n]+~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), bold: false, strike: false });
    }
    const token = match[0];
    segments.push({
      text: token.slice(1, -1),
      bold: token.startsWith("*"),
      strike: token.startsWith("~"),
    });
    lastIndex = match.index + token.length;
  }
  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), bold: false, strike: false });
  }
  return segments;
}
