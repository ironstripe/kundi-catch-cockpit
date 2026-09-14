/**
 * Schweizer Mehrwertsteuer für Food Catch.
 *
 * Kundenpreise (Food-Catch-Preis, Normalpreis, WhatsApp- und Bildpreis) sind
 * immer Bruttopreise inklusive MWST. Umsatz, Deckungsbeitrag und Rohmarge
 * werden netto gerechnet. Einkaufspreise und Lieferkosten sind Nettowerte und
 * werden deshalb nicht umgerechnet.
 */

/** Reduzierter Satz für Lebensmittel und Fisch zum menschlichen Verzehr. */
export const DEFAULT_VAT_RATE = 2.6;

/** Wareneinkauf von Lebensmitteln unterliegt demselben reduzierten Satz. */
export const DEFAULT_PURCHASE_VAT_RATE = 2.6;

/** Transportleistungen unterliegen dem Normalsatz. */
export const DEFAULT_DELIVERY_VAT_RATE = 8.1;

/**
 * Nettowert einer Kostenposition. Ist der erfasste Betrag ein Bruttowert,
 * wird die enthaltene Vorsteuer herausgerechnet — sie ist kein Warenaufwand.
 */
export function netCost(amount: number, includesVat: boolean, rate: number): number {
  if (!Number.isFinite(amount)) return 0;
  return includesVat ? netFromGross(amount, rate) : amount;
}

/** Beschriftung der erfassten Steuerbasis. */
export function vatBasisLabel(includesVat: boolean): string {
  return includesVat ? "inkl. MWST" : "exkl. MWST";
}

/** Zur Auswahl angebotene Schweizer Sätze. */
export const VAT_RATE_OPTIONS = [
  { rate: 2.6, label: "2.6 % — Lebensmittel (reduziert)" },
  { rate: 3.8, label: "3.8 % — Beherbergung" },
  { rate: 8.1, label: "8.1 % — Normalsatz" },
  { rate: 0, label: "0 % — ohne MWST" },
] as const;

export interface VatSettings {
  /** Standardsatz in Prozent für neue Catches. */
  rate: number;
}

export const DEFAULT_VAT_SETTINGS: VatSettings = { rate: DEFAULT_VAT_RATE };

/** Gültiger Satz in Prozent oder null. */
export function parseVatRate(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Ungültige oder fehlende Sätze fallen auf den Standardsatz zurück. */
export function resolveVatRate(
  rate: number | null | undefined,
  fallback: number = DEFAULT_VAT_RATE,
): number {
  if (typeof rate === "number" && Number.isFinite(rate) && rate >= 0 && rate < 100) return rate;
  if (Number.isFinite(fallback) && fallback >= 0 && fallback < 100) return fallback;
  return DEFAULT_VAT_RATE;
}

/** Bruttopreis (inkl. MWST) -> Nettopreis. */
export function netFromGross(gross: number, rate: number): number {
  const safeRate = resolveVatRate(rate, 0);
  if (!Number.isFinite(gross)) return 0;
  const net = gross / (1 + safeRate / 100);
  return Number.isFinite(net) ? net : 0;
}

/** MWST-Betrag, der in einem Bruttopreis enthalten ist. */
export function vatFromGross(gross: number, rate: number): number {
  return gross - netFromGross(gross, rate);
}

/** Deutsche Fehlermeldung oder null. */
export function validateVatRate(rate: number): string | null {
  if (!Number.isFinite(rate) || rate < 0 || rate >= 100) {
    return "Der Mehrwertsteuersatz muss zwischen 0 und 99.9 Prozent liegen.";
  }
  return null;
}
