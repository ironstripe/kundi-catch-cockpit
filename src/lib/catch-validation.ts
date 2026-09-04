import type { CatchFormValues } from "@/lib/catches";

export interface FieldIssue {
  field: string;
  message: string;
}

function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Minimalanforderung, damit überhaupt ein Entwurf angelegt werden darf. */
export function validateDraft(values: CatchFormValues): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!values.product_name.trim()) {
    issues.push({ field: "product_name", message: "Produktname ist für einen Entwurf nötig." });
  }
  if (values.product_name.trim().length > 120) {
    issues.push({ field: "product_name", message: "Produktname ist zu lang (max. 120 Zeichen)." });
  }
  return issues;
}

/** Vollständige Prüfung, bevor ein Catch als «Bereit» markiert wird. */
export function validateReady(values: CatchFormValues, hasImage: boolean): FieldIssue[] {
  const issues: FieldIssue[] = [...validateDraft(values)];

  if (!hasImage) {
    issues.push({ field: "product_image", message: "Ein Produktbild ist erforderlich." });
  }
  if (!values.supplier_id) {
    issues.push({ field: "supplier_id", message: "Lieferant auswählen." });
  }

  const quantity = toNumber(values.purchase_quantity);
  if (quantity === null || quantity <= 0) {
    issues.push({ field: "purchase_quantity", message: "Einkaufsmenge muss grösser als 0 sein." });
  }

  const purchasePrice = toNumber(values.purchase_price);
  if (purchasePrice === null || purchasePrice < 0) {
    issues.push({
      field: "purchase_price",
      message: "Einkaufspreis pro Einheit ist erforderlich und darf nicht negativ sein.",
    });
  }

  if (!values.delivery_included) {
    const delivery = toNumber(values.delivery_cost);
    if (delivery !== null && delivery < 0) {
      issues.push({ field: "delivery_cost", message: "Lieferkosten dürfen nicht negativ sein." });
    }
  }

  const regular = toNumber(values.regular_price);
  if (regular !== null && regular < 0) {
    issues.push({ field: "regular_price", message: "Normalpreis darf nicht negativ sein." });
  }

  const catchPrice = toNumber(values.catch_price);
  if (catchPrice === null || catchPrice <= 0) {
    issues.push({ field: "catch_price", message: "Kundi-Catch-Preis muss grösser als 0 sein." });
  }

  if (values.location_ids.length === 0) {
    issues.push({ field: "location_ids", message: "Mindestens einen Abholort wählen." });
  }

  if (!values.available_from) {
    issues.push({ field: "available_from", message: "«Verfügbar ab» ist erforderlich." });
  }
  if (values.available_until && values.available_from) {
    if (new Date(values.available_until) <= new Date(values.available_from)) {
      issues.push({
        field: "available_until",
        message: "«Verfügbar bis» muss nach «Verfügbar ab» liegen.",
      });
    }
  }

  if (!values.handicap_reason) {
    issues.push({ field: "handicap_reason", message: "Grund für den Catch auswählen." });
  }
  if (!values.handicap_story.trim()) {
    issues.push({ field: "handicap_story", message: "Handicap-Story darf nicht leer sein." });
  }

  return issues;
}
