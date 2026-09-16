import { describe, expect, it } from "vitest";

import {
  aggregateReconciliations,
  breakEvenResult,
  durationMs,
  formatDuration,
  isIntegerUnit,
  reconcileCatch,
  validateRemainingQuantity,
  type ReconciliationInput,
} from "@/lib/catch-reconciliation";

const base: ReconciliationInput = {
  purchase_quantity: 100,
  quantity_unit: "kg",
  purchase_price: 6.5,
  delivery_cost: 0,
  regular_price: 10.75,
  catch_price: 7.9,
  remaining_quantity: 12,
  published_at: "2026-09-04T12:00:00.000Z",
  inventory_counted_at: "2026-09-05T16:00:00.000Z",
};

describe("reconcileCatch", () => {
  it("berechnet den Referenzfall Felchenfilets", () => {
    const result = reconcileCatch(base);
    expect(result.complete).toBe(true);
    const v = result.values!;
    expect(v.sold_quantity).toBe(88);
    expect(v.sell_through_percentage).toBeCloseTo(88, 6);
    expect(v.vat_rate).toBeCloseTo(2.6, 6);
    expect(v.effective_revenue_gross).toBeCloseTo(695.2, 6);
    expect(v.effective_revenue).toBeCloseTo((88 * 7.9) / 1.026, 6);
    expect(v.effective_vat).toBeCloseTo(695.2 - (88 * 7.9) / 1.026, 6);
    expect(v.total_investment).toBeCloseTo(650, 6);
    expect(v.effective_contribution_margin).toBeCloseTo((88 * 7.9) / 1.026 - 650, 6);
    expect(v.remaining_inventory_value).toBeCloseTo(78, 6);
    expect(v.break_even_sell_through).toBeCloseTo(84.4177, 3);
    expect(result.break_even).toBe("reached");
    expect(result.break_even_label).toBe("Break-even erreicht");
  });

  it("akzeptiert Restmenge 0 (vollständig verkauft)", () => {
    const result = reconcileCatch({ ...base, remaining_quantity: 0 });
    expect(result.values?.sold_quantity).toBe(100);
    expect(result.values?.sell_through_percentage).toBe(100);
  });

  it("akzeptiert Restmenge gleich Einkaufsmenge (nichts verkauft)", () => {
    const result = reconcileCatch({ ...base, remaining_quantity: 100 });
    expect(result.values?.sold_quantity).toBe(0);
    expect(result.values?.sell_through_percentage).toBe(0);
    expect(result.values?.effective_contribution_margin).toBeCloseTo(-650, 6);
    expect(result.break_even).toBe("missed");
  });

  it("lehnt Restmengen über der Einkaufsmenge und negative Werte ab", () => {
    expect(reconcileCatch({ ...base, remaining_quantity: 120 }).values).toBeNull();
    expect(reconcileCatch({ ...base, remaining_quantity: -1 }).values).toBeNull();
    expect(reconcileCatch({ ...base, remaining_quantity: null }).values).toBeNull();
  });

  it("erzeugt niemals NaN oder Infinity", () => {
    const result = reconcileCatch({ ...base, purchase_quantity: 0, remaining_quantity: 0 });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("Einkaufsmenge");
  });

  it("meldet fehlende Preisdaten", () => {
    const result = reconcileCatch({ ...base, purchase_price: null, catch_price: null });
    expect(result.missing).toEqual(["Einkaufspreis pro Einheit", "Food-Catch-Preis"]);
    expect(result.values).toBeNull();
  });

  it("liefert ohne Publikationszeitpunkt keine Aktionsdauer", () => {
    const result = reconcileCatch({ ...base, published_at: null });
    expect(result.values?.action_duration_ms).toBeNull();
  });
});

describe("validateRemainingQuantity", () => {
  it("erlaubt Dezimalstellen bei kg", () => {
    expect(validateRemainingQuantity(12.5, 100, "kg")).toEqual([]);
  });

  it("verlangt ganze Zahlen bei Stück", () => {
    expect(isIntegerUnit("Stück")).toBe(true);
    expect(validateRemainingQuantity(3.5, 100, "Stück")).toContain(
      "Bei Stück sind nur ganze Zahlen zulässig.",
    );
  });

  it("verlangt eine Eingabe", () => {
    expect(validateRemainingQuantity(null, 100, "kg")).toEqual([
      "Effektive Restmenge ist erforderlich.",
    ]);
  });
});

describe("breakEvenResult", () => {
  it("unterscheidet erreicht, knapp und nicht erreicht", () => {
    expect(breakEvenResult(90, 82.3)).toBe("reached");
    expect(breakEvenResult(82.5, 82.3)).toBe("borderline");
    expect(breakEvenResult(60, 82.3)).toBe("missed");
    expect(breakEvenResult(null, 82.3)).toBe("unknown");
  });
});

describe("formatDuration", () => {
  it("formatiert Stunden und Tage", () => {
    expect(formatDuration(6 * 3600_000)).toBe("6 Stunden");
    expect(formatDuration(28 * 3600_000)).toBe("1 Tag 4 Stunden");
    expect(formatDuration(72 * 3600_000)).toBe("3 Tage");
    expect(formatDuration(null)).toBe("—");
  });

  it("ignoriert negative Zeiträume", () => {
    expect(durationMs("2026-09-05T10:00:00Z", "2026-09-04T10:00:00Z")).toBeNull();
  });
});

describe("aggregateReconciliations", () => {
  it("addiert kg und Stück getrennt und fasst Finanzwerte zusammen", () => {
    const totals = aggregateReconciliations([
      base,
      {
        ...base,
        quantity_unit: "Stück",
        purchase_quantity: 50,
        remaining_quantity: 5,
        purchase_price: 2,
        catch_price: 3,
      },
    ]);
    expect(totals.count).toBe(2);
    expect(totals.by_unit).toHaveLength(2);
    const kg = totals.by_unit.find((entry) => entry.unit === "kg")!;
    expect(kg.sold_quantity).toBe(88);
    expect(kg.sell_through).toBeCloseTo(88, 6);
    const pieces = totals.by_unit.find((entry) => entry.unit === "Stück")!;
    expect(pieces.sold_quantity).toBe(45);
    expect(pieces.sell_through).toBeCloseTo(90, 6);
    expect(totals.revenue).toBeCloseTo((88 * 7.9) / 1.026 + (45 * 3) / 1.026, 6);
    expect(totals.revenue_gross).toBeCloseTo(695.2 + 135, 6);
    expect(totals.vat).toBeCloseTo(695.2 + 135 - totals.revenue, 6);
    expect(totals.average_duration_ms).toBe(28 * 3600_000);
  });

  it("ignoriert unvollständige Catches in den Summen", () => {
    const totals = aggregateReconciliations([{ ...base, remaining_quantity: null }]);
    expect(totals.count).toBe(1);
    expect(totals.by_unit).toEqual([]);
    expect(totals.revenue).toBe(0);
  });
});

describe("Nachkalkulation mit Steuerbasis", () => {
  it("rechnet den effektiven Deckungsbeitrag gegen die Nettoinvestition", () => {
    const result = reconcileCatch({
      purchase_quantity: 100,
      quantity_unit: "kg",
      purchase_price: 6.5,
      delivery_cost: 108.1,
      delivery_cost_includes_vat: true,
      delivery_vat_rate: 8.1,
      regular_price: 10.75,
      catch_price: 7.9,
      vat_rate: 2.6,
      remaining_quantity: 20,
      published_at: null,
      inventory_counted_at: null,
    });
    const v = result.values!;
    expect(v.sold_quantity).toBe(80);
    expect(v.effective_revenue_gross).toBeCloseTo(632, 8);
    expect(v.effective_revenue).toBeCloseTo(632 / 1.026, 8);
    expect(v.total_investment).toBeCloseTo(750, 6);
    expect(v.effective_contribution_margin).toBeCloseTo(632 / 1.026 - 750, 6);
    expect(v.remaining_inventory_value).toBeCloseTo(130, 8);
  });
});

describe("DB II in der Nachkalkulation", () => {
  it("bleibt ohne erfassten Satz leer", () => {
    const v = reconcileCatch(base).values!;
    expect(v.internal_handling_cost_per_unit).toBeNull();
    expect(v.internal_handling_cost_total).toBeNull();
    expect(v.db_ii).toBeNull();
    expect(v.db_ii_margin_percentage).toBeNull();
    expect(v.db_i).toBeCloseTo(v.effective_contribution_margin, 6);
  });

  it("rechnet auf der vorbereiteten Menge, nicht auf der verkauften", () => {
    const v = reconcileCatch({
      ...base,
      vat_rate: 2.6,
      internal_handling_cost_per_unit: 2.5,
    }).values!;
    expect(v.internal_handling_cost_total).toBeCloseTo(250, 6);
    expect(v.db_ii).toBeCloseTo(v.effective_contribution_margin - 250, 6);
    expect(v.db_ii_margin_percentage).toBeCloseTo((v.db_ii! / v.effective_revenue) * 100, 6);
  });

  it("senkt den Aufwand nicht, wenn weniger verkauft wird", () => {
    const many = reconcileCatch({
      ...base,
      remaining_quantity: 0,
      internal_handling_cost_per_unit: 2.5,
    }).values!;
    const few = reconcileCatch({
      ...base,
      remaining_quantity: 80,
      internal_handling_cost_per_unit: 2.5,
    }).values!;
    expect(few.internal_handling_cost_total).toBeCloseTo(many.internal_handling_cost_total!, 6);
  });

  it("liefert ohne Nettoumsatz keine Marge", () => {
    const v = reconcileCatch({
      ...base,
      remaining_quantity: 100,
      internal_handling_cost_per_unit: 2.5,
    }).values!;
    expect(v.effective_revenue).toBe(0);
    expect(v.db_ii_margin_percentage).toBeNull();
  });

  it("summiert DB II über abgeschlossene Catches", () => {
    const totals = aggregateReconciliations([
      { ...base, internal_handling_cost_per_unit: 2.5 },
      { ...base },
    ]);
    expect(totals.internal_handling_cost).toBeCloseTo(250, 6);
    expect(totals.contribution_margin_ii).toBeCloseTo(totals.contribution_margin - 250, 6);
  });
});
