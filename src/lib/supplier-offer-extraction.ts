/**
 * Angebotseingang: Feldschema und reine Regeln der strukturierten Auswertung.
 *
 * Es werden ausschliesslich Werte übernommen, die in der Original-E-Mail stehen.
 * Fehlt eine Angabe, bleibt das Feld `null` — es wird nie geraten oder ergänzt.
 */

/** Privater Ablagebereich für Anhänge weitergeleiteter Angebote. */
export const SUPPLIER_OFFER_BUCKET = "supplier-offers";

export type OfferFieldKey =
  | "supplier_name"
  | "supplier_contact_name"
  | "supplier_email"
  | "product_name"
  | "article_number"
  | "category"
  | "temperature"
  | "origin"
  | "certification"
  | "size_calibration"
  | "glazing"
  | "packaging"
  | "units_per_package"
  | "quantity_unit"
  | "carton_count"
  | "available_quantity"
  | "purchase_price"
  | "regular_price"
  | "currency"
  | "delivery_cost"
  | "delivery_location"
  | "available_from"
  | "expiry_date"
  | "offer_reason"
  | "other_conditions";

export const OFFER_FIELD_KEYS: OfferFieldKey[] = [
  "supplier_name",
  "supplier_contact_name",
  "supplier_email",
  "product_name",
  "article_number",
  "category",
  "temperature",
  "origin",
  "certification",
  "size_calibration",
  "glazing",
  "packaging",
  "units_per_package",
  "quantity_unit",
  "carton_count",
  "available_quantity",
  "purchase_price",
  "regular_price",
  "currency",
  "delivery_cost",
  "delivery_location",
  "available_from",
  "expiry_date",
  "offer_reason",
  "other_conditions",
];

export const OFFER_FIELD_LABELS: Record<OfferFieldKey, string> = {
  supplier_name: "Lieferant",
  supplier_contact_name: "Ansprechperson",
  supplier_email: "E-Mail Lieferant",
  product_name: "Produkt",
  article_number: "Artikelnummer",
  category: "Kategorie",
  temperature: "Frisch oder TK",
  origin: "Herkunft",
  certification: "Zertifizierung",
  size_calibration: "Grösse / Kalibrierung",
  glazing: "Glasuranteil",
  packaging: "Verpackung",
  units_per_package: "Stück pro Gebinde",
  quantity_unit: "Mengeneinheit",
  carton_count: "Anzahl Kartons",
  available_quantity: "Verfügbare Menge",
  purchase_price: "Einkaufspreis",
  regular_price: "Normalpreis",
  currency: "Währung",
  delivery_cost: "Lieferkosten",
  delivery_location: "Liefer- oder Abholort",
  available_from: "Verfügbar ab",
  expiry_date: "Mindesthaltbarkeitsdatum",
  offer_reason: "Grund für das Sonderangebot",
  other_conditions: "Weitere Konditionen",
};

/** Felder, die als Zahl interpretiert werden. */
export const NUMERIC_FIELDS: OfferFieldKey[] = [
  "units_per_package",
  "carton_count",
  "available_quantity",
  "purchase_price",
  "regular_price",
  "delivery_cost",
];

/** Felder, die als Datum (YYYY-MM-DD) interpretiert werden. */
export const DATE_FIELDS: OfferFieldKey[] = ["available_from", "expiry_date"];

export interface ExtractedField {
  /** Wortgetreu übernommener Wert; `null`, wenn die E-Mail dazu nichts sagt. */
  value: string | number | null;
  /** Einheit, falls im Text genannt (kg, Stück, CHF …). */
  unit: string | null;
  /** Sicherheit der Erkennung zwischen 0 und 1. */
  confidence: number | null;
  /** Textstelle aus der E-Mail, auf der der Wert beruht. */
  source_excerpt: string | null;
}

export type ExtractedOffer = Partial<Record<OfferFieldKey, ExtractedField | null>>;

export const EMPTY_FIELD: ExtractedField = {
  value: null,
  unit: null,
  confidence: null,
  source_excerpt: null,
};

function clampConfidence(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(1, Math.max(0, numeric));
}

function textOrNull(value: unknown, maxLength = 400): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null" || text === "-") return null;
  return text.slice(0, maxLength);
}

/** Wandelt "12'500.50", "12.500,50" oder "CHF 8.20/kg" in eine Zahl um. */
export function parseOfferNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = textOrNull(value);
  if (!raw) return null;
  const match = raw.match(/-?\d[\d'’.,\s]*/);
  if (!match) return null;
  let cleaned = match[0].replace(/[\s'’]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > -1 && lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Erkennt Datumsangaben in ISO- und Schweizer Schreibweise. */
export function parseOfferDate(value: unknown): string | null {
  const raw = textOrNull(value, 40);
  if (!raw) return null;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const swiss = raw.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (swiss) {
    const year = swiss[3]!.length === 2 ? `20${swiss[3]}` : swiss[3];
    return `${year}-${swiss[2]!.padStart(2, "0")}-${swiss[1]!.padStart(2, "0")}`;
  }
  return null;
}

/** Frisch oder TK aus dem Text ableiten; `null`, wenn unklar. */
export function parseTemperature(value: unknown): "fresh" | "frozen" | null {
  const raw = textOrNull(value, 60)?.toLowerCase();
  if (!raw) return null;
  if (/(tk|tiefgek|tiefgefroren|frozen|gefroren)/.test(raw)) return "frozen";
  if (/(frisch|fresh|gekühlt|chilled)/.test(raw)) return "fresh";
  return null;
}

function normaliseField(key: OfferFieldKey, input: unknown): ExtractedField {
  if (!input || typeof input !== "object") return { ...EMPTY_FIELD };
  const record = input as Record<string, unknown>;
  const rawValue = record["value"];

  let value: string | number | null;
  if (NUMERIC_FIELDS.includes(key)) {
    value = parseOfferNumber(rawValue);
  } else if (DATE_FIELDS.includes(key)) {
    value = parseOfferDate(rawValue);
  } else if (key === "temperature") {
    value = parseTemperature(rawValue);
  } else {
    value = textOrNull(rawValue, key === "other_conditions" ? 2000 : 400);
  }

  return {
    value,
    unit: textOrNull(record["unit"], 40),
    confidence: clampConfidence(record["confidence"]),
    source_excerpt: textOrNull(record["source_excerpt"], 500),
  };
}

/** Bringt eine beliebige Auswertungsantwort in das feste Schema. */
export function normaliseExtraction(input: unknown): ExtractedOffer {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result: ExtractedOffer = {};
  for (const key of OFFER_FIELD_KEYS) {
    result[key] = normaliseField(key, source[key]);
  }
  return result;
}

export function fieldValue(offer: ExtractedOffer, key: OfferFieldKey): string | number | null {
  return offer[key]?.value ?? null;
}

export function fieldText(offer: ExtractedOffer, key: OfferFieldKey): string {
  const value = fieldValue(offer, key);
  return value === null || value === undefined ? "" : String(value);
}

/** Mindestfelder für die Übernahme in einen Catch-Entwurf. */
export const REQUIRED_FOR_CONVERSION: OfferFieldKey[] = [
  "product_name",
  "available_quantity",
  "purchase_price",
];

export function missingRequiredFields(offer: ExtractedOffer): OfferFieldKey[] {
  return REQUIRED_FOR_CONVERSION.filter((key) => {
    const value = fieldValue(offer, key);
    return value === null || value === "" || (typeof value === "number" && !Number.isFinite(value));
  });
}

/** Plausibilitätswarnungen — sie blockieren nichts, sondern machen sichtbar. */
export function extractionWarnings(offer: ExtractedOffer): string[] {
  const warnings: string[] = [];
  const purchase = fieldValue(offer, "purchase_price");
  const regular = fieldValue(offer, "regular_price");
  const quantity = fieldValue(offer, "available_quantity");
  const cartons = fieldValue(offer, "carton_count");
  const currency = fieldValue(offer, "currency");

  if (typeof purchase === "number" && typeof regular === "number" && purchase > regular) {
    warnings.push("Der Einkaufspreis liegt über dem angegebenen Normalpreis.");
  }
  if (typeof quantity === "number" && quantity <= 0) {
    warnings.push("Die verfügbare Menge ist null oder negativ.");
  }
  if (typeof purchase === "number" && purchase <= 0) {
    warnings.push("Der Einkaufspreis ist null oder negativ.");
  }
  if (typeof cartons === "number" && typeof quantity === "number" && cartons > quantity) {
    warnings.push("Die Anzahl Kartons ist grösser als die verfügbare Menge.");
  }
  if (typeof currency === "string" && currency.toUpperCase() !== "CHF") {
    warnings.push(`Das Angebot ist in ${currency.toUpperCase()} — Umrechnung manuell prüfen.`);
  }
  for (const key of OFFER_FIELD_KEYS) {
    const field = offer[key];
    if (field?.value !== null && field?.value !== undefined && (field.confidence ?? 1) < 0.5) {
      warnings.push(`${OFFER_FIELD_LABELS[key]}: unsicher erkannt — bitte prüfen.`);
    }
  }
  return warnings;
}

/**
 * Absender der Weiterleitung und ursprünglicher Absender sind zwei
 * verschiedene Dinge: die Weiterleitung kommt aus dem eigenen Haus.
 */
export function looksLikeForward(subject: string | null, body: string | null): boolean {
  const text = `${subject ?? ""}\n${body ?? ""}`.toLowerCase();
  return /(^|\s)(fwd:|fw:|wg:|weitergeleitete nachricht|forwarded message)/.test(text);
}

/** Liest den ursprünglichen Absender aus dem Weiterleitungskopf. */
export function originalSenderFromBody(
  body: string | null,
): { email: string | null; name: string | null } {
  if (!body) return { email: null, name: null };
  const header = body.match(/(?:^|\n)\s*(?:From|Von)\s*:\s*(.+)/i);
  if (!header) return { email: null, name: null };
  const line = header[1]!.trim();
  const bracketed = line.match(/^(.*?)[<[]\s*([^\s<>[\]]+@[^\s<>[\]]+)\s*[>\]]/);
  if (bracketed) {
    const name = bracketed[1]!.replace(/["']/g, "").trim();
    return { email: bracketed[2]!.toLowerCase(), name: name || null };
  }
  const plain = line.match(/[^\s<>]+@[^\s<>]+/);
  return { email: plain ? plain[0].toLowerCase() : null, name: null };
}
