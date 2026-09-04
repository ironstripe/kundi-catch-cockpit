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
    expect(v.effective_revenue).toBeCloseTo(695.2, 6);
    expect(v.total_investment).toBeCloseTo(650, 6);
    expect(v.effective_contribution_margin).toBeCloseTo(45.2, 6);
    expect(v.remaining_inventory_value).toBeCloseTo(78, 6);
    expect(v.break_even_sell_through).toBeCloseTo(82.2785, 3);
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
    expect(result.missing).toEqual(["Einkaufspreis pro Einheit", "Kundi-Catch-Preis"]);
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
    expect(totals.revenue).toBeCloseTo(695.2 + 135, 6);
    expect(totals.average_duration_ms).toBe(28 * 3600_000);
  });

  it("ignoriert unvollständige Catches in den Summen", () => {
    const totals = aggregateReconciliations([{ ...base, remaining_quantity: null }]);
    expect(totals.count).toBe(1);
    expect(totals.by_unit).toEqual([]);
    expect(totals.revenue).toBe(0);
  });
});
