/**
 * Vorkalkulation eines Catches.
 *
 * Eine einzige Quelle der Wahrheit für Formular-Vorschau, Detailseite und
 * Dashboard. Es wird mit voller Genauigkeit gerechnet; gerundet wird erst
 * bei der Anzeige.
 */

import { DEFAULT_CATCH_THRESHOLDS, type CatchThresholds } from "@/lib/catch-thresholds";

export interface CalculationInput {
  purchase_quantity: number | null;
  quantity_unit: string;
  purchase_price: number | null;
  delivery_cost: number | null;
  regular_price: number | null;
  catch_price: number | null;
}

export type DecisionLevel = "green" | "orange" | "red" | "incomplete";

export interface CalculationValues {
  purchase_quantity: number;
  quantity_unit: string;
  purchase_price: number;
  delivery_cost: number;
  catch_price: number;
  regular_price: number | null;
  total_investment: number;
  maximum_revenue: number;
  delivery_cost_per_unit: number | null;
  effective_cost_per_unit: number;
  contribution_margin_per_unit: number;
  maximum_contribution_margin: number;
  /** Rohmarge in Prozent, null wenn kein Umsatz möglich ist. */
  gross_margin_percentage: number | null;
  /** Preisvorteil in Prozent, null ohne gültigen Normalpreis. */
  discount_percentage: number | null;
  break_even_quantity: number | null;
  break_even_sell_through: number | null;
}

export interface CalculationResult {
  complete: boolean;
  /** Fehlende Pflichtangaben (deutsche Labels) für den neutralen Zustand. */
  missing: string[];
  values: CalculationValues | null;
  level: DecisionLevel;
  label: string;
  /** Kurzbegründung des Ampelzustands. */
  summary: string;
  /** Ausgelöste Kriterien, z. B. «Rohmarge unter 15 %». */
  criteria: string[];
  /** Deterministisch erzeugte Beobachtungen in ganzen Sätzen. */
  explanations: string[];
}

export const DECISION_LABELS: Record<DecisionLevel, string> = {
  green: "Guter Catch",
  orange: "Knapp kalkuliert",
  red: "Kritisch",
  incomplete: "Kalkulation noch unvollständig",
};

const MISSING_LABELS = {
  purchase_quantity: "Einkaufsmenge",
  purchase_price: "Einkaufspreis pro Einheit",
  catch_price: "Kundi-Catch-Preis",
} as const;

/** Wandelt Formulartext in eine endliche Zahl oder null. */
export function parseNumberInput(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/**
 * Berechnet alle Kennzahlen und den Ampelzustand.
 * Negative Mengen oder Preise gelten als ungültige Eingabe.
 */
export function calculateCatch(
  input: CalculationInput,
  thresholds: CatchThresholds = DEFAULT_CATCH_THRESHOLDS,
): CalculationResult {
  const quantity = input.purchase_quantity;
  const purchasePrice = input.purchase_price;
  const catchPrice = input.catch_price;
  const deliveryCost = input.delivery_cost ?? 0;

  const missing: string[] = [];
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    missing.push(MISSING_LABELS.purchase_quantity);
  }
  if (purchasePrice === null || !Number.isFinite(purchasePrice) || purchasePrice < 0) {
    missing.push(MISSING_LABELS.purchase_price);
  }
  if (catchPrice === null || !Number.isFinite(catchPrice)) {
    missing.push(MISSING_LABELS.catch_price);
  }

  if (missing.length > 0 || quantity === null || purchasePrice === null || catchPrice === null) {
    return {
      complete: false,
      missing,
      values: null,
      level: "incomplete",
      label: DECISION_LABELS.incomplete,
      summary:
        "Für eine Beurteilung fehlen noch Angaben. Ein Entwurf lässt sich trotzdem speichern.",
      criteria: missing.map((field) => `${field} fehlt`),
      explanations: [],
    };
  }

  const safeDelivery = Number.isFinite(deliveryCost) && deliveryCost > 0 ? deliveryCost : 0;
  const regularPrice =
    input.regular_price !== null && Number.isFinite(input.regular_price) && input.regular_price > 0
      ? input.regular_price
      : null;

  const totalInvestment = quantity * purchasePrice + safeDelivery;
  const maximumRevenue = quantity * catchPrice;
  const deliveryCostPerUnit = safeDivide(safeDelivery, quantity);
  const effectiveCostPerUnit = purchasePrice + (deliveryCostPerUnit ?? 0);
  const contributionMarginPerUnit = catchPrice - effectiveCostPerUnit;
  const maximumContributionMargin = maximumRevenue - totalInvestment;
  const grossMarginPercentage =
    maximumRevenue > 0 ? (maximumContributionMargin / maximumRevenue) * 100 : null;
  const discountPercentage =
    regularPrice !== null ? ((regularPrice - catchPrice) / regularPrice) * 100 : null;
  const breakEvenQuantity = catchPrice > 0 ? safeDivide(totalInvestment, catchPrice) : null;
  const breakEvenSellThrough =
    breakEvenQuantity !== null ? (breakEvenQuantity / quantity) * 100 : null;

  const values: CalculationValues = {
    purchase_quantity: quantity,
    quantity_unit: input.quantity_unit,
    purchase_price: purchasePrice,
    delivery_cost: safeDelivery,
    catch_price: catchPrice,
    regular_price: regularPrice,
    total_investment: totalInvestment,
    maximum_revenue: maximumRevenue,
    delivery_cost_per_unit: deliveryCostPerUnit,
    effective_cost_per_unit: effectiveCostPerUnit,
    contribution_margin_per_unit: contributionMarginPerUnit,
    maximum_contribution_margin: maximumContributionMargin,
    gross_margin_percentage: grossMarginPercentage,
    discount_percentage: discountPercentage,
    break_even_quantity: breakEvenQuantity,
    break_even_sell_through: breakEvenSellThrough,
  };

  const decision = decide(values, thresholds);
  return { complete: true, missing: [], values, ...decision };
}

function decide(
  v: CalculationValues,
  t: CatchThresholds,
): Pick<CalculationResult, "level" | "label" | "summary" | "criteria" | "explanations"> {
  const criteria: string[] = [];
  const margin = v.gross_margin_percentage;
  const discount = v.discount_percentage;
  const breakEven = v.break_even_sell_through;

  let level: DecisionLevel;

  if (
    v.maximum_contribution_margin <= 0 ||
    v.catch_price <= 0 ||
    (breakEven !== null && breakEven > t.maximum_orange_break_even) ||
    breakEven === null
  ) {
    level = "red";
    if (v.catch_price <= 0) criteria.push("Kundi-Catch-Preis ist null oder negativ");
    if (v.maximum_contribution_margin <= 0) {
      criteria.push("Maximaler DB ist null oder negativ");
    }
    if (breakEven !== null && breakEven > t.maximum_orange_break_even) {
      criteria.push(`Break-even-Abverkauf über ${t.maximum_orange_break_even} %`);
    }
  } else {
    const marginOk = margin !== null && margin >= t.minimum_green_margin;
    const discountOk = discount !== null && discount >= t.minimum_green_discount;
    const breakEvenOk = breakEven <= t.maximum_green_break_even;

    if (marginOk && discountOk && breakEvenOk) {
      level = "green";
      criteria.push(`Rohmarge mindestens ${t.minimum_green_margin} %`);
      criteria.push(`Preisvorteil mindestens ${t.minimum_green_discount} %`);
      criteria.push(`Break-even-Abverkauf höchstens ${t.maximum_green_break_even} %`);
    } else {
      level = "orange";
      if (!marginOk) criteria.push(`Rohmarge unter ${t.minimum_green_margin} %`);
      if (discount === null) criteria.push("Kein Vergleichspreis hinterlegt");
      else if (!discountOk) criteria.push(`Preisvorteil unter ${t.minimum_green_discount} %`);
      if (!breakEvenOk) criteria.push(`Break-even-Abverkauf über ${t.maximum_green_break_even} %`);
    }
  }

  const summary =
    level === "green"
      ? "Einkauf, Preisvorteil und nötiger Abverkauf liegen im Zielbereich."
      : level === "orange"
        ? "Der Catch trägt sich, aber mindestens ein Zielwert wird nicht erreicht."
        : "So kalkuliert deckt der Catch den Wareneinsatz nicht verlässlich.";

  return { level, label: DECISION_LABELS[level], summary, criteria, explanations: explain(v, t) };
}

function pct(value: number): string {
  return `${value.toFixed(1).replace(".", ".")} %`;
}

function explain(v: CalculationValues, t: CatchThresholds): string[] {
  const out: string[] = [];
  const margin = v.gross_margin_percentage;
  const discount = v.discount_percentage;
  const breakEven = v.break_even_sell_through;

  if (margin !== null) {
    out.push(
      margin >= t.minimum_green_margin
        ? `Die geplante Rohmarge beträgt ${pct(margin)} und liegt im Zielbereich.`
        : `Die geplante Rohmarge beträgt ${pct(margin)} und liegt unter dem Zielwert von ${t.minimum_green_margin} %.`,
    );
  }

  if (v.maximum_contribution_margin <= 0 || v.catch_price <= 0) {
    out.push("Der geplante Verkaufspreis deckt den Wareneinsatz nicht.");
  }

  if (discount === null) {
    out.push("Der Vergleichspreis fehlt. Der Preisvorteil kann noch nicht beurteilt werden.");
  } else if (discount < 0) {
    out.push(
      `Der Kundi-Catch-Preis liegt ${pct(Math.abs(discount))} über dem Normalpreis. Das ist kein Preisvorteil für die Kundschaft.`,
    );
  } else if (discount === 0) {
    out.push("Der Kundi-Catch-Preis entspricht dem Normalpreis. Es entsteht kein Preisvorteil.");
  } else {
    out.push(
      discount >= t.minimum_green_discount
        ? `Der Preisvorteil für Kunden beträgt ${pct(discount)}.`
        : `Der Preisvorteil für Kunden beträgt ${pct(discount)} und liegt unter dem Zielwert von ${t.minimum_green_discount} %.`,
    );
  }

  if (breakEven !== null) {
    out.push(
      `${pct(breakEven)} der Einkaufsmenge müssen verkauft werden, um den Wareneinsatz zu decken.`,
    );
  }

  if (v.delivery_cost > 0 && v.delivery_cost_per_unit !== null) {
    out.push("Die Lieferkosten sind anteilig im effektiven Einkaufspreis enthalten.");
  }

  return out;
}

/** Aggregierte Kennzahlen mehrerer Catches fürs Dashboard. */
export interface CatchTotals {
  contribution_margin: number;
  revenue: number;
  /** Gewichtete Rohmarge in Prozent, null wenn kein Umsatz vorliegt. */
  weighted_margin: number | null;
  /** Geplante Einkaufsmenge je Einheit — nie einheitenübergreifend addiert. */
  quantity_by_unit: { unit: string; quantity: number }[];
}

export function aggregateCatches(inputs: CalculationInput[]): CatchTotals {
  let contribution = 0;
  let revenue = 0;
  const byUnit = new Map<string, number>();

  for (const input of inputs) {
    const result = calculateCatch(input);
    if (result.values) {
      if (result.values.maximum_revenue > 0) {
        contribution += result.values.maximum_contribution_margin;
        revenue += result.values.maximum_revenue;
      }
    }
    const quantity = input.purchase_quantity;
    if (quantity !== null && Number.isFinite(quantity) && quantity > 0) {
      byUnit.set(input.quantity_unit, (byUnit.get(input.quantity_unit) ?? 0) + quantity);
    }
  }

  return {
    contribution_margin: contribution,
    revenue,
    weighted_margin: revenue > 0 ? (contribution / revenue) * 100 : null,
    quantity_by_unit: [...byUnit.entries()].map(([unit, quantity]) => ({ unit, quantity })),
  };
}
