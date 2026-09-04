/**
 * Fachliche Konstanten rund um einen Catch.
 * Interne Werte sind englisch, die Anzeige ist deutsch.
 */

export const CATCH_STATUSES = [
  "draft",
  "ready",
  "published",
  "closed",
  "cancelled",
] as const;

export type CatchStatus = (typeof CATCH_STATUSES)[number];

export const CATCH_STATUS_LABELS: Record<CatchStatus, string> = {
  draft: "Entwurf",
  ready: "Bereit",
  published: "Publiziert",
  closed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

/** CSS-Variable je Status, siehe src/styles.css */
export const CATCH_STATUS_TINT: Record<CatchStatus, string> = {
  draft: "var(--status-draft)",
  ready: "var(--status-ready)",
  published: "var(--status-published)",
  closed: "var(--status-closed)",
  cancelled: "var(--status-cancelled)",
};

export const ACTIVE_STATUSES: CatchStatus[] = ["draft", "ready", "published"];

export type Temperature = "fresh" | "frozen";

export const TEMPERATURE_LABELS: Record<Temperature, string> = {
  fresh: "Frisch",
  frozen: "TK",
};

export const TEMPERATURE_TINT: Record<Temperature, string> = {
  fresh: "var(--temp-fresh)",
  frozen: "var(--temp-frozen)",
};

export const QUANTITY_UNITS = ["kg", "Stk", "Portion"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export const QUANTITY_UNIT_LABELS: Record<string, string> = {
  kg: "Kilogramm (kg)",
  Stk: "Stück",
  Portion: "Portion",
};

/** Vorgegebene Gründe, warum ein Produkt zum Catch wird. */
export const HANDICAP_REASONS = [
  "overproduction",
  "short_shelf_life",
  "cosmetic",
  "size_deviation",
  "packaging",
  "surplus_lot",
  "other",
] as const;

export type HandicapReason = (typeof HANDICAP_REASONS)[number];

export const HANDICAP_REASON_LABELS: Record<HandicapReason, string> = {
  overproduction: "Überproduktion",
  short_shelf_life: "Kurze Haltbarkeit",
  cosmetic: "Optischer Makel",
  size_deviation: "Abweichende Grösse",
  packaging: "Verpackungsfehler",
  surplus_lot: "Restposten aus Sonderlos",
  other: "Anderer Grund",
};

/** Aus dem gewählten Grund generierter, manuell editierbarer Satz. */
export const HANDICAP_REASON_SENTENCES: Record<HandicapReason, string> = {
  overproduction:
    "Dieser Fisch stammt aus einer Überproduktion — Qualität top, Menge zu gross. Deshalb gibt es ihn jetzt als Catch.",
  short_shelf_life:
    "Dieser Fisch hat nur noch eine kurze Haltbarkeit. Wer schnell ist, isst gut und rettet ihn vor dem Abfall.",
  cosmetic:
    "Dieser Fisch hat einen kleinen optischen Makel. Auf dem Teller merkt man davon nichts — im Preis schon.",
  size_deviation:
    "Diese Ware weicht in der Grösse vom Standard ab. Geschmacklich einwandfrei, darum jetzt als Catch.",
  packaging:
    "Die Verpackung dieser Charge ist nicht perfekt. Der Inhalt schon — deshalb gibt es ihn günstiger.",
  surplus_lot:
    "Ein Restposten aus einem Sonderlos. Begrenzte Menge, guter Fisch, kleines Handicap.",
  other:
    "Dieser Fisch hat ein kleines Handicap und wird deshalb als Catch angeboten.",
};
