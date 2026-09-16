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

  const NET = 7.9 / 1.026;

  it("berechnet alle Kennzahlen netto nach MWST", () => {
    expect(v.vat_rate).toBeCloseTo(2.6, 6);
    expect(v.catch_price_net).toBeCloseTo(NET, 6);
    expect(v.vat_per_unit).toBeCloseTo(7.9 - NET, 6);
    expect(v.total_investment).toBeCloseTo(650, 6);
    expect(v.maximum_revenue_gross).toBeCloseTo(790, 6);
    expect(v.maximum_revenue).toBeCloseTo(100 * NET, 6);
    expect(v.maximum_vat).toBeCloseTo(790 - 100 * NET, 6);
    expect(v.effective_cost_per_unit).toBeCloseTo(6.5, 6);
    expect(v.contribution_margin_per_unit).toBeCloseTo(NET - 6.5, 6);
    expect(v.maximum_contribution_margin).toBeCloseTo(100 * NET - 650, 6);
    expect(v.gross_margin_percentage!.toFixed(1)).toBe("15.6");
    expect(v.discount_percentage!.toFixed(1)).toBe("26.5");
    expect(v.break_even_quantity!.toFixed(2)).toBe("84.42");
    expect(v.break_even_sell_through!.toFixed(1)).toBe("84.4");
  });

  it("rechnet ohne MWST wie zuvor", () => {
    const zero = calculateCatch(input({ vat_rate: 0 })).values!;
    expect(zero.maximum_revenue).toBeCloseTo(790, 6);
    expect(zero.maximum_vat).toBeCloseTo(0, 6);
    expect(zero.maximum_contribution_margin).toBeCloseTo(140, 6);
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
    expect(v.maximum_contribution_margin).toBeCloseTo((100 * 7.9) / 1.026 - 700, 6);
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
    expect(result.explanations).toContain(
      "Der geplante Verkaufspreis deckt den Wareneinsatz nicht.",
    );
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
      input({
        quantity_unit: "Stk",
        purchase_quantity: 40,
        purchase_price: 4,
        catch_price: 6,
        regular_price: 9,
      }),
    ).values!;
    expect(v.quantity_unit).toBe("Stk");
    expect(v.total_investment).toBeCloseTo(160, 6);
    expect(v.maximum_revenue).toBeCloseTo((40 * 6) / 1.026, 6);
  });

  it("rechnet mit Dezimalmengen", () => {
    const v = calculateCatch(input({ purchase_quantity: 12.5 })).values!;
    expect(v.total_investment).toBeCloseTo(81.25, 6);
    expect(v.maximum_revenue).toBeCloseTo((12.5 * 7.9) / 1.026, 6);
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
      "Food-Catch-Preis",
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
    expect(totals.contribution_margin).toBeCloseTo(2 * ((100 * 7.9) / 1.026 - 650), 6);
    expect(totals.weighted_margin!.toFixed(1)).toBe("15.6");
  });

  it("ignoriert unvollständige Datensätze ohne Umsatz", () => {
    const totals = aggregateCatches([input({}), input({ catch_price: null })]);
    expect(totals.revenue).toBeCloseTo((100 * 7.9) / 1.026, 6);
    expect(totals.revenue_gross).toBeCloseTo(790, 6);
    expect(totals.weighted_margin!.toFixed(1)).toBe("15.6");
  });
});

describe("Steuerbasis Einkauf und Lieferung", () => {
  it("nimmt einen exkl. MWST erfassten Einkaufspreis unverändert", () => {
    const v = calculateCatch(input({ purchase_price_includes_vat: false })).values!;
    expect(v.net_purchase_price_per_unit).toBeCloseTo(6.5, 10);
    expect(v.net_investment).toBeCloseTo(650, 10);
    expect(v.maximum_net_revenue).toBeCloseTo(100 * (7.9 / 1.026), 10);
    expect(v.maximum_contribution_margin).toBeCloseTo(100 * (7.9 / 1.026) - 650, 10);
    expect(v.gross_margin_percentage!).toBeCloseTo(15.58, 2);
    expect(v.break_even_quantity!).toBeCloseTo(84.42, 2);
    expect(v.break_even_sell_through!).toBeCloseTo(84.42, 2);
  });

  it("rechnet einen inkl. MWST erfassten Einkaufspreis auf netto um", () => {
    const v = calculateCatch(
      input({ purchase_price_includes_vat: true, purchase_vat_rate: 2.6 }),
    ).values!;
    expect(v.net_purchase_price_per_unit).toBeCloseTo(6.5 / 1.026, 10);
    expect(v.net_investment).toBeCloseTo((100 * 6.5) / 1.026, 10);
  });

  it("rechnet Lieferkosten mit 8.1 Prozent auf netto um", () => {
    const v = calculateCatch(
      input({ delivery_cost: 108.1, delivery_cost_includes_vat: true, delivery_vat_rate: 8.1 }),
    ).values!;
    expect(v.net_delivery_cost).toBeCloseTo(100, 8);
    expect(v.net_investment).toBeCloseTo(750, 8);
  });

  it("lässt Lieferkosten von null unberührt", () => {
    const v = calculateCatch(input({ delivery_cost: 0, delivery_cost_includes_vat: true })).values!;
    expect(v.net_delivery_cost).toBe(0);
    expect(v.net_investment).toBeCloseTo(650, 10);
  });

  it("vergleicht den Preisvorteil brutto gegen brutto", () => {
    const v = calculateCatch(input({})).values!;
    expect(v.discount_percentage!).toBeCloseTo(((10.75 - 7.9) / 10.75) * 100, 10);
  });
});

describe("DB II – interner Catch-Aufwand", () => {
  const input = {
    purchase_quantity: 100,
    quantity_unit: "kg",
    purchase_price: 6.5,
    delivery_cost: 0,
    regular_price: 12.5,
    catch_price: 7.9,
    vat_rate: 2.6,
    purchase_price_includes_vat: false,
    delivery_cost_includes_vat: false,
  };

  it("kennt den Standardsatz CHF 2.50", () => {
    expect(DEFAULT_INTERNAL_HANDLING_COST).toBe(2.5);
  });

  it("lässt DB II ohne erfassten Satz leer", () => {
    const v = calculateCatch(input).values!;
    expect(v.db_i).toBeCloseTo(119.98, 2);
    expect(v.internal_handling_cost_per_unit).toBeNull();
    expect(v.db_ii).toBeNull();
    expect(v.db_ii_margin_percentage).toBeNull();
  });

  it("zieht den Aufwand der gesamten vorbereiteten Menge von DB I ab", () => {
    const v = calculateCatch({ ...input, internal_handling_cost_per_unit: 0.5 }).values!;
    expect(v.internal_handling_cost_total).toBeCloseTo(50, 6);
    expect(v.db_ii).toBeCloseTo(69.98, 2);
    expect(v.db_ii_margin_percentage).toBeCloseTo((69.98 / v.maximum_net_revenue) * 100, 2);
  });

  it("bestätigt das Referenzbeispiel brutto 12.50 bei 2.6 % mit CHF 2.50 Aufwand", () => {
    const v = calculateCatch({
      ...input,
      purchase_quantity: 1,
      purchase_price: 0,
      catch_price: 12.5,
      internal_handling_cost_per_unit: 2.5,
    }).values!;
    expect(v.net_sales_price_per_unit).toBeCloseTo(12.18, 2);
    expect(v.internal_handling_cost_share_percentage).toBeCloseTo(20.5, 1);
  });

  it("meldet negative DB II ohne Fehler", () => {
    const v = calculateCatch({ ...input, internal_handling_cost_per_unit: 5 }).values!;
    expect(v.db_ii).toBeLessThan(0);
  });
});
