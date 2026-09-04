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
