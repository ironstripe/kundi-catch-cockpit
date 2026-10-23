/**
 * Deterministische Erzeugung des WhatsApp-Posts aus Catch-Daten.
 *
 * Kein KI-Dienst: gespeicherte Vorlage (Einstellungen › WhatsApp-Vorlage),
 * Catch-Fakten immer automatisch; leere/ausgeblendete Abschnitte entfallen.
 */

import {
  DEFAULT_TEMPLATE_SETTINGS,
  normalizeTemplate,
  type TemplateBlock,
  type TemplateSettings,
} from "@/lib/app-settings";
import { QUANTITY_UNIT_LABELS } from "@/lib/catch-domain";
import { APP_LOCALE, APP_TIMEZONE, formatDate } from "@/lib/format";

export const BRAND_CLAIM = "Guter Fisch. Kleines Handicap. Grosser Fang.";
export const BRAND_PURPOSE = "Gut essen. Food Waste vermeiden.";

/** Version der deterministischen Vorlage. Erhöhen, wenn sich der Aufbau ändert. */
export const POST_TEMPLATE_VERSION = 6;

/** Kundenpreise sind Bruttopreise — im Post kurz und einmalig ausgewiesen. */
export const VAT_NOTE = "inkl. MWST";

/** Abholort aus den Standort-Stammdaten — Adresse und Hinweis kommen immer von dort. */
export interface PostLocation {
  name: string;
  address: string | null;
  pickup_note: string | null;
}

export interface PostSource {
  product_name: string;
  description: string | null;
  packaging: string | null;
  expiry_date: string | null;
  regular_price: number | null;
  catch_price: number | null;
  quantity_unit: string;
  locations: PostLocation[];
  available_from: string | null;
  available_until: string | null;
  handicap_story: string | null;
  image_path: string | null;
  /** Optionaler Direktlink zum Produkt im Onlineshop. */
  online_shop_url: string | null;
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

/** Stadt/Postleitzahl aus einer Adresse entfernen ("8200 Schaffhausen"). */
function stripCityPart(part: string): string | null {
  const trimmed = part.trim();
  // Schweizer Postleitzahl + Ort am Ende oder als eigener Teil
  if (/^\d{4}\s+\S/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Adresse aus den Stammdaten in Zeilen zerlegen.
 * Postleitzahl und Ort («8200 Schaffhausen») entfallen im Post, da dort nur
 * Standortname und Strasse erscheinen sollen.
 */
export function addressLines(address: string | null | undefined): string[] {
  return (address ?? "")
    .split(/\n|,/)
    .map((part) => stripCityPart(part))
    .filter((part): part is string => part !== null && part !== "");
}

/**
 * Abholblock aus den Standort-Stammdaten.
 * Ein Ort: Name und Adresse in Zeilen. Mehrere Orte: Aufzählung mit eingerückter Adresse.
 * Ohne Adresse erscheint nur der Name — ohne Leerzeilen oder Platzhalter.
 */
export function pickupBlock(locations: PostLocation[], label: string): string | null {
  const valid = locations.filter((location) => (location.name ?? "").trim() !== "");
  if (valid.length === 0) return null;

  if (valid.length === 1) {
    const location = valid[0]!;
    const lines = [label, location.name.trim(), ...addressLines(location.address)];
    const note = (location.pickup_note ?? "").trim();
    if (note !== "") lines.push(note);
    return lines.join("\n");
  }

  const lines = [label];
  for (const location of valid) {
    lines.push(`• ${location.name.trim()}`);
    for (const line of addressLines(location.address)) lines.push(`  ${line}`);
    const note = (location.pickup_note ?? "").trim();
    if (note !== "") lines.push(`  ${note}`);
  }
  return lines.join("\n");
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\u2013\u2014-]+/g, " ")
    .trim();
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Nicht blockierend: nur fehlende Kundendaten, keine internen Prüfungen. */
export function missingPostDetails(source: PostSource): string[] {
  const missing: string[] = [];
  if (
    source.catch_price === null ||
    !Number.isFinite(source.catch_price) ||
    source.catch_price <= 0
  )
    missing.push("Catch-Preis");
  if (!source.locations.some((location) => location.name.trim())) missing.push("Abholort");
  if (!source.available_from) missing.push("Verfügbarkeit");
  return missing;
}

/**
 * Erzeugt den vollständigen WhatsApp-Text.
 * Optionale Zeilen ohne Wert entfallen restlos.
 */
export function generatePostText(
  source: PostSource,
  template: TemplateSettings = DEFAULT_TEMPLATE_SETTINGS,
): string {
  const t = normalizeTemplate(template);
  const blocks: string[] = [];
  const header = clean(t.header);
  if (header) blocks.push(header);

  const build: Record<TemplateBlock, () => string | null> = {
    intro: () => clean(t.intro),
    claim: () => clean(t.claim),
    story: () => clean(source.handicap_story),
    product: () => {
      const productLines: string[] = [`*${source.product_name.trim()}*`];
      const description = clean(source.description);
      const packaging = clean(source.packaging);
      for (const field of t.detail_order) {
        if (field === "description" && description) productLines.push(description);
        if (
          field === "packaging" &&
          packaging &&
          !(description && normalise(description).includes(normalise(packaging)))
        ) {
          productLines.push(packaging);
        }
      }
      return productLines.join("\n");
    },
    price: () => {
      const catchPrice = source.catch_price;
      if (catchPrice === null || !(catchPrice > 0)) return null;
      const regular = source.regular_price;
      const hasComparison = regular !== null && Number.isFinite(regular) && regular > catchPrice;
      if (hasComparison) {
        const discount = ((regular - catchPrice) / regular) * 100;
        const priceLine = `~${postPrice(regular, source.quantity_unit)}~ → *${postPrice(catchPrice, source.quantity_unit)}* 🔥`;
        return t.show_discount && discount > 0
          ? `${priceLine}\n${postPercent(discount)} günstiger\n${VAT_NOTE}`
          : `${priceLine}\n${VAT_NOTE}`;
      }
      return `*FOOD CATCH ${postPrice(catchPrice, source.quantity_unit)}* 🔥\n${VAT_NOTE}`;
    },
    stock: () => {
      const stockLines: string[] = [];
      if (t.show_expiry && source.expiry_date)
        stockLines.push(`MHD: ${formatDate(source.expiry_date)}`);
      stockLines.push("*Nur solange Vorrat.*");
      return stockLines.join("\n");
    },
    pickup: () => {
      const actionLines: string[] = [];
      const pickup = pickupBlock(source.locations, t.pickup_label.trim());
      if (pickup) actionLines.push(pickup);
      if (source.available_from) {
        actionLines.push(
          `${t.available_from_label.trim()} ${postDateTime(source.available_from, "ab")}`,
        );
      }
      if (t.show_available_until && source.available_until) {
        actionLines.push(`📅 Verfügbar bis: ${postDateTime(source.available_until, "bis")}`);
      }
      return actionLines.length > 0 ? actionLines.join("\n") : null;
    },
    shop: () => {
      const shopUrl = clean(source.online_shop_url);
      return shopUrl ? `🛒 Im Onlineshop bestellen:\n${shopUrl}` : null;
    },
    footer: () => clean(t.footer),
  };

  for (const block of t.block_order) {
    if (t.hidden_blocks.includes(block)) continue;
    const content = build[block]();
    if (content) blocks.push(content);
  }

  return blocks.join("\n\n");
}

/** Nur die Vorlagenwerte, die den Text beeinflussen (ohne Zusatzschlüssel). */
export function templateFingerprint(template: TemplateSettings): string {
  const t = normalizeTemplate(template);
  return JSON.stringify([
    t.header,
    t.intro,
    t.claim,
    t.footer,
    t.pickup_label,
    t.available_from_label,
    t.detail_order,
    t.show_expiry,
    t.show_available_until,
    t.show_discount,
    t.block_order,
    t.hidden_blocks,
  ]);
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

/**
 * Vorlagenkennung in der Signatur: Standardvorlage = Versionsnummer (kompatibel
 * mit bestehenden Signaturen), angepasste Vorlage = "Version:Inhaltshash".
 */
export function templateSignatureTag(template: TemplateSettings): number | string {
  const fingerprint = templateFingerprint(template);
  if (fingerprint === templateFingerprint(DEFAULT_TEMPLATE_SETTINGS)) return POST_TEMPLATE_VERSION;
  return `${POST_TEMPLATE_VERSION}:${hashString(fingerprint)}`;
}

/**
 * Signatur der postrelevanten Catch-Daten.
 * Ändert sie sich nach der Generierung, gilt der Post als möglicherweise veraltet.
 */
export function postSourceSignature(
  source: PostSource,
  template: TemplateSettings = DEFAULT_TEMPLATE_SETTINGS,
): string {
  return JSON.stringify([
    source.product_name.trim(),
    clean(source.description),
    clean(source.packaging),
    source.expiry_date,
    source.regular_price,
    source.catch_price,
    source.quantity_unit,
    [...source.locations]
      .map((location) => [
        location.name.trim(),
        addressLines(location.address).join(", "),
        clean(location.pickup_note),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    source.available_from,
    source.available_until,
    clean(source.handicap_story),
    source.image_path,
    clean(source.online_shop_url),
    templateSignatureTag(template),
  ]);
}

/** Vorlagenversion aus einer gespeicherten Signatur; null bei unbekanntem Format. */
export function signatureTemplateVersion(signature: string | null): number | null {
  if (!signature) return null;
  try {
    const parsed: unknown = JSON.parse(signature);
    if (!Array.isArray(parsed)) return null;
    const last = parsed[parsed.length - 1];
    if (typeof last === "number") return last;
    if (typeof last === "string" && /^\d+:/.test(last)) return Number(last.split(":")[0]);
    return null;
  } catch {
    return null;
  }
}

/** True, wenn sich gegenüber der Signatur nur die Vorlagenversion geändert hat. */
export function isTemplateOnlyChange(signature: string | null, current: string): boolean {
  if (!signature) return false;
  try {
    const a = JSON.parse(signature) as unknown[];
    const b = JSON.parse(current) as unknown[];
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return (
      JSON.stringify(a.slice(0, -1)) === JSON.stringify(b.slice(0, -1)) &&
      a[a.length - 1] !== b[b.length - 1]
    );
  } catch {
    return false;
  }
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
