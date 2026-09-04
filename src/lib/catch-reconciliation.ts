/**
 * Nachkalkulation eines Catches.
 *
 * Die verkaufte Menge ergibt sich ausschliesslich aus der manuell erfassten
 * Restmenge. Es werden keine Einzelverkäufe rekonstruiert.
 */

import { calculateCatch, type CalculationInput, type CalculationValues } from "@/lib/catch-calculation";

export interface ReconciliationInput extends CalculationInput {
  remaining_quantity: number | null;
  published_at: string | null;
  inventory_counted_at: string | null;
}

export interface ReconciliationValues {
  purchase_quantity: number;
  quantity_unit: string;
  remaining_quantity: number;
  sold_quantity: number;
  sell_through_percentage: number | null;
  effective_revenue: number;
  total_investment: number;
  effective_contribution_margin: number;
  remaining_inventory_value: number;
  /** Dauer in Millisekunden, null ohne Publikationszeitpunkt. */
  action_duration_ms: number | null;
  break_even_sell_through: number | null;
}

export type BreakEvenResult = "reached" | "borderline" | "missed" | "unknown";

export const BREAK_EVEN_LABELS: Record<BreakEvenResult, string> = {
  reached: "Break-even erreicht",
  borderline: "Break-even knapp erreicht",
  missed: "Break-even nicht erreicht",
  unknown: "Break-even nicht beurteilbar",
};

export interface ReconciliationResult {
  complete: boolean;
  /** Fehlermeldungen zur Restmenge (deutsch). */
  errors: string[];
  /** Fehlende Grundlagen, z. B. Einkaufspreis in einem alten Entwurf. */
  missing: string[];
  values: ReconciliationValues | null;
  planned: CalculationValues | null;
  break_even: BreakEvenResult;
  break_even_label: string;
}

const BREAK_EVEN_TOLERANCE = 1;

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Ganzzahlige Einheiten (Stück, Portion) lassen keine Dezimalstellen zu. */
export function isIntegerUnit(unit: string): boolean {
  return unit !== "kg";
}

export function validateRemainingQuantity(
  remaining: number | null,
  purchaseQuantity: number | null,
  unit: string,
): string[] {
  const errors: string[] = [];
  if (remaining === null || !Number.isFinite(remaining)) {
    errors.push("Effektive Restmenge ist erforderlich.");
    return errors;
  }
  if (remaining < 0) errors.push("Die Restmenge darf nicht negativ sein.");
  if (finite(purchaseQuantity) && remaining > purchaseQuantity) {
    errors.push("Die Restmenge darf die Einkaufsmenge nicht überschreiten.");
  }
  if (isIntegerUnit(unit) && !Number.isInteger(remaining)) {
    errors.push(`Bei ${unit} sind nur ganze Zahlen zulässig.`);
  }
  return errors;
}

export function breakEvenResult(
  actual: number | null,
  breakEven: number | null,
): BreakEvenResult {
  if (!finite(actual) || !finite(breakEven)) return "unknown";
  if (actual > breakEven + BREAK_EVEN_TOLERANCE) return "reached";
  if (actual < breakEven - BREAK_EVEN_TOLERANCE) return "missed";
  return "borderline";
}

/** Menschenlesbare Aktionsdauer, z. B. «1 Tag 4 Stunden». */
export function formatDuration(ms: number | null): string {
  if (!finite(ms) || ms < 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} ${totalMinutes === 1 ? "Minute" : "Minuten"}`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) return `${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;
  const dayPart = `${days} ${days === 1 ? "Tag" : "Tage"}`;
  if (hours === 0) return dayPart;
  return `${dayPart} ${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;
}

export function durationMs(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const diff = end - start;
  return diff < 0 ? null : diff;
}

/**
 * Berechnet die Nachkalkulation. Ungültige Restmengen liefern kein Ergebnis,
 * damit nie negative Verkaufsmengen oder Quoten über 100 % entstehen.
 */
export function reconcileCatch(input: ReconciliationInput): ReconciliationResult {
  const planned = calculateCatch(input);
  const purchaseQuantity = input.purchase_quantity;
  const remaining = input.remaining_quantity;
  const errors = validateRemainingQuantity(remaining, purchaseQuantity, input.quantity_unit);

  const missing: string[] = [];
  if (!finite(purchaseQuantity) || (purchaseQuantity ?? 0) <= 0) missing.push("Einkaufsmenge");
  if (!finite(input.purchase_price)) missing.push("Einkaufspreis pro Einheit");
  if (!finite(input.catch_price)) missing.push("Kundi-Catch-Preis");

  if (errors.length > 0 || missing.length > 0 || !finite(remaining) || !finite(purchaseQuantity)) {
    return {
      complete: false,
      errors,
      missing,
      values: null,
      planned: planned.values,
      break_even: "unknown",
      break_even_label: BREAK_EVEN_LABELS.unknown,
    };
  }

  const purchasePrice = input.purchase_price ?? 0;
  const catchPrice = input.catch_price ?? 0;
  const deliveryCost =
    finite(input.delivery_cost) && input.delivery_cost > 0 ? input.delivery_cost : 0;

  const soldQuantity = Math.max(0, purchaseQuantity - remaining);
  const sellThrough = purchaseQuantity > 0 ? (soldQuantity / purchaseQuantity) * 100 : null;
  const effectiveRevenue = soldQuantity * catchPrice;
  const totalInvestment = purchaseQuantity * purchasePrice + deliveryCost;
  const effectiveContributionMargin = effectiveRevenue - totalInvestment;
  const remainingInventoryValue = remaining * purchasePrice;
  const duration = durationMs(input.published_at, input.inventory_counted_at);
  const breakEven = planned.values?.break_even_sell_through ?? null;
  const result = breakEvenResult(sellThrough, breakEven);

  return {
    complete: true,
    errors: [],
    missing: [],
    values: {
      purchase_quantity: purchaseQuantity,
      quantity_unit: input.quantity_unit,
      remaining_quantity: remaining,
      sold_quantity: soldQuantity,
      sell_through_percentage: sellThrough,
      effective_revenue: effectiveRevenue,
      total_investment: totalInvestment,
      effective_contribution_margin: effectiveContributionMargin,
      remaining_inventory_value: remainingInventoryValue,
      action_duration_ms: duration,
      break_even_sell_through: breakEven,
    },
    planned: planned.values,
    break_even: result,
    break_even_label: BREAK_EVEN_LABELS[result],
  };
}

/* ------------------------------------------------------------------ */
/* Aggregation für Historie und Dashboard                              */
/* ------------------------------------------------------------------ */

export interface UnitTotal {
  unit: string;
  purchase_quantity: number;
  sold_quantity: number;
  /** Gewichteter Abverkauf in Prozent, null ohne Einkaufsmenge. */
  sell_through: number | null;
}

export interface HistoryTotals {
  count: number;
  by_unit: UnitTotal[];
  revenue: number;
  contribution_margin: number;
  /** Durchschnittliche Aktionsdauer in Millisekunden, null ohne Daten. */
  average_duration_ms: number | null;
}

/**
 * Summiert abgeschlossene Catches. Kilogramm und Stück werden nie addiert;
 * Finanzwerte dürfen zusammengefasst werden, weil alles CHF ist.
 */
export function aggregateReconciliations(inputs: ReconciliationInput[]): HistoryTotals {
  const byUnit = new Map<string, { purchase: number; sold: number }>();
  let revenue = 0;
  let margin = 0;
  let durationSum = 0;
  let durationCount = 0;
  let count = 0;

  for (const input of inputs) {
    const result = reconcileCatch(input);
    count += 1;
    const v = result.values;
    if (!v) continue;
    const entry = byUnit.get(v.quantity_unit) ?? { purchase: 0, sold: 0 };
    entry.purchase += v.purchase_quantity;
    entry.sold += v.sold_quantity;
    byUnit.set(v.quantity_unit, entry);
    revenue += v.effective_revenue;
    margin += v.effective_contribution_margin;
    if (v.action_duration_ms !== null) {
      durationSum += v.action_duration_ms;
      durationCount += 1;
    }
  }

  return {
    count,
    by_unit: [...byUnit.entries()].map(([unit, entry]) => ({
      unit,
      purchase_quantity: entry.purchase,
      sold_quantity: entry.sold,
      sell_through: entry.purchase > 0 ? (entry.sold / entry.purchase) * 100 : null,
    })),
    revenue,
    contribution_margin: margin,
    average_duration_ms: durationCount > 0 ? durationSum / durationCount : null,
  };
}
