import { describe, expect, it } from "vitest";

import { aggregateCatches, calculateCatch, type CalculationInput } from "@/lib/catch-calculation";

function input(partial: Partial<CalculationInput>): CalculationInput {
  return {
    purchase_quantity: 100,
    quantity_unit: "kg",
    purchase_price: 6.5,
    delivery_cost: 0,
    regular_price: 10.75,
    catch_price: 7.9,
    ...partial,
  };
}

describe("calculateCatch — Referenzfall Felchenfilets TK", () => {
  const result = calculateCatch(input({}));
  const v = result.values!;

  it("berechnet alle Kennzahlen korrekt", () => {
    expect(v.total_investment).toBeCloseTo(650, 6);
    expect(v.maximum_revenue).toBeCloseTo(790, 6);
    expect(v.effective_cost_per_unit).toBeCloseTo(6.5, 6);
    expect(v.contribution_margin_per_unit).toBeCloseTo(1.4, 6);
    expect(v.maximum_contribution_margin).toBeCloseTo(140, 6);
    expect(v.gross_margin_percentage!.toFixed(1)).toBe("17.7");
    expect(v.discount_percentage!.toFixed(1)).toBe("26.5");
    expect(v.break_even_quantity!.toFixed(2)).toBe("82.28");
    expect(v.break_even_sell_through!.toFixed(1)).toBe("82.3");
  });

  it("bewertet den Catch als grün", () => {
    expect(result.level).toBe("green");
    expect(result.label).toBe("Guter Catch");
    expect(result.explanations.length).toBeGreaterThan(0);
  });
});

describe("calculateCatch — Sonderfälle", () => {
  it("behandelt fehlenden Normalpreis nicht als null", () => {
    const result = calculateCatch(input({ regular_price: null }));
    expect(result.values!.discount_percentage).toBeNull();
    expect(result.level).toBe("orange");
    expect(result.explanations).toContain(
      "Der Vergleichspreis fehlt. Der Preisvorteil kann noch nicht beurteilt werden.",
    );
  });

  it("verteilt Lieferkosten anteilig auf die Einheit", () => {
    const v = calculateCatch(input({ delivery_cost: 50 })).values!;
    expect(v.delivery_cost_per_unit).toBeCloseTo(0.5, 6);
    expect(v.effective_cost_per_unit).toBeCloseTo(7, 6);
    expect(v.total_investment).toBeCloseTo(700, 6);
    expect(v.maximum_contribution_margin).toBeCloseTo(90, 6);
  });

  it("rechnet ohne Lieferkosten identisch", () => {
    const v = calculateCatch(input({ delivery_cost: 0 })).values!;
    expect(v.delivery_cost_per_unit).toBe(0);
    expect(v.effective_cost_per_unit).toBeCloseTo(6.5, 6);
  });

  it("meldet negative Marge als kritisch", () => {
    const result = calculateCatch(input({ catch_price: 6 }));
    expect(result.values!.maximum_contribution_margin).toBeLessThan(0);
    expect(result.level).toBe("red");
    expect(result.explanations).toContain("Der geplante Verkaufspreis deckt den Wareneinsatz nicht.");
  });

  it("meldet Break-even über 95 % als kritisch", () => {
    const result = calculateCatch(input({ catch_price: 6.8 }));
    expect(result.values!.break_even_sell_through!).toBeGreaterThan(95);
    expect(result.level).toBe("red");
  });

  it("wertet Break-even zwischen 85 und 95 % als knapp", () => {
    const result = calculateCatch(input({ catch_price: 7.3, regular_price: 12 }));
    const be = result.values!.break_even_sell_through!;
    expect(be).toBeGreaterThan(85);
    expect(be).toBeLessThanOrEqual(95);
    expect(result.level).toBe("orange");
  });

  it("rechnet mit Stückmengen", () => {
    const v = calculateCatch(
      input({ quantity_unit: "Stk", purchase_quantity: 40, purchase_price: 4, catch_price: 6, regular_price: 9 }),
    ).values!;
    expect(v.quantity_unit).toBe("Stk");
    expect(v.total_investment).toBeCloseTo(160, 6);
    expect(v.maximum_revenue).toBeCloseTo(240, 6);
  });

  it("rechnet mit Dezimalmengen", () => {
    const v = calculateCatch(input({ purchase_quantity: 12.5 })).values!;
    expect(v.total_investment).toBeCloseTo(81.25, 6);
    expect(v.maximum_revenue).toBeCloseTo(98.75, 6);
  });

  it("zeigt bei unvollständigem Entwurf den neutralen Zustand", () => {
    const result = calculateCatch(
      input({ purchase_quantity: null, purchase_price: null, catch_price: null }),
    );
    expect(result.complete).toBe(false);
    expect(result.level).toBe("incomplete");
    expect(result.values).toBeNull();
    expect(result.missing).toEqual([
      "Einkaufsmenge",
      "Einkaufspreis pro Einheit",
      "Kundi-Catch-Preis",
    ]);
  });

  it("behandelt Menge null als unvollständig", () => {
    expect(calculateCatch(input({ purchase_quantity: 0 })).level).toBe("incomplete");
  });

  it("bewertet Catch-Preis null als kritisch", () => {
    const result = calculateCatch(input({ catch_price: 0 }));
    expect(result.level).toBe("red");
    expect(result.values!.break_even_quantity).toBeNull();
  });

  it("zeigt negativen Preisvorteil ohne Rabattbegriff", () => {
    const result = calculateCatch(input({ regular_price: 7, catch_price: 7.9 }));
    expect(result.values!.discount_percentage!).toBeLessThan(0);
    expect(result.explanations.some((text) => text.includes("kein Preisvorteil"))).toBe(true);
  });

  it("liefert nie NaN oder Infinity", () => {
    const result = calculateCatch(input({ purchase_quantity: 1e9, catch_price: 1e9 }));
    for (const value of Object.values(result.values!)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("aggregateCatches", () => {
  it("addiert Einheiten nie gemischt", () => {
    const totals = aggregateCatches([
      input({}),
      input({ quantity_unit: "Stk", purchase_quantity: 40 }),
    ]);
    expect(totals.quantity_by_unit).toEqual([
      { unit: "kg", quantity: 100 },
      { unit: "Stk", quantity: 40 },
    ]);
  });

  it("berechnet die gewichtete Rohmarge", () => {
    const totals = aggregateCatches([input({}), input({})]);
    expect(totals.contribution_margin).toBeCloseTo(280, 6);
    expect(totals.weighted_margin!.toFixed(1)).toBe("17.7");
  });

  it("ignoriert unvollständige Datensätze ohne Umsatz", () => {
    const totals = aggregateCatches([input({}), input({ catch_price: null })]);
    expect(totals.revenue).toBeCloseTo(790, 6);
    expect(totals.weighted_margin!.toFixed(1)).toBe("17.7");
  });
});
