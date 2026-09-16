import { describe, expect, it } from "vitest";

import {
  DEFAULT_CALCULATION_DEFAULTS,
  DEFAULT_INTERNAL_HANDLING_COST,
  parseInternalHandlingInput,
  validateInternalHandlingDefault,
} from "@/lib/app-settings";
import { calculateCatch, type CalculationInput } from "@/lib/catch-calculation";
import {
  EMPTY_CATCH_FORM,
  formValuesToCalculationInput,
  withInternalHandlingDefault,
} from "@/lib/catches";

const input: CalculationInput = {
  purchase_quantity: 100,
  quantity_unit: "kg",
  purchase_price: 8,
  delivery_cost: 0,
  regular_price: 20,
  catch_price: 12.5,
  vat_rate: 2.6,
  purchase_price_includes_vat: false,
  purchase_vat_rate: 2.6,
  delivery_cost_includes_vat: false,
  delivery_vat_rate: 8.1,
};

describe("Standardwert interner Aufwand", () => {
  it("liefert CHF 2.50 als Auslieferungsstandard", () => {
    expect(DEFAULT_CALCULATION_DEFAULTS.internal_handling_cost_per_unit).toBe(2.5);
    expect(DEFAULT_INTERNAL_HANDLING_COST).toBe(2.5);
  });

  it("liest Eingaben mit Komma und leeren Feldern korrekt", () => {
    expect(parseInternalHandlingInput("2,50")).toBe(2.5);
    expect(parseInternalHandlingInput("")).toBeNull();
    expect(parseInternalHandlingInput("abc")).toBeNull();
  });

  it("akzeptiert gültige Beträge", () => {
    expect(validateInternalHandlingDefault(2.5)).toBeNull();
    expect(validateInternalHandlingDefault(0)).toBeNull();
  });

  it("weist fehlende, negative und unpräzise Werte zurück", () => {
    expect(validateInternalHandlingDefault(null)).toBeTruthy();
    expect(validateInternalHandlingDefault(-1)).toBeTruthy();
    expect(validateInternalHandlingDefault(2.555)).toBeTruthy();
    expect(validateInternalHandlingDefault(5000)).toBeTruthy();
  });
});

describe("Vorbelegung neuer Catches", () => {
  it("das leere Formular enthält keinen fest verdrahteten Wert", () => {
    expect(EMPTY_CATCH_FORM.internal_handling_cost_per_unit).toBe("");
  });

  it("übernimmt den konfigurierten Standardwert", () => {
    const values = withInternalHandlingDefault(EMPTY_CATCH_FORM, 3.25);
    expect(values.internal_handling_cost_per_unit).toBe("3.25");
    expect(formValuesToCalculationInput(values).internal_handling_cost_per_unit).toBe(3.25);
  });

  it("überschreibt eine bereits erfasste Eingabe nicht", () => {
    const typed = { ...EMPTY_CATCH_FORM, internal_handling_cost_per_unit: "1.10" };
    expect(withInternalHandlingDefault(typed, 2.5).internal_handling_cost_per_unit).toBe("1.10");
  });

  it("bleibt leer, wenn kein Standardwert verfügbar ist", () => {
    expect(
      withInternalHandlingDefault(EMPTY_CATCH_FORM, null).internal_handling_cost_per_unit,
    ).toBe("");
  });
});

describe("DB II nach Übernahme des Standardwerts", () => {
  it("bleibt ohne erfassten Wert nicht gerechnet", () => {
    const values = calculateCatch({ ...input, internal_handling_cost_per_unit: null }).values!;
    expect(values.internal_handling_cost_total).toBeNull();
    expect(values.db_ii).toBeNull();
  });

  it("rechnet DB II sofort mit dem übernommenen Standardwert", () => {
    const before = calculateCatch({ ...input, internal_handling_cost_per_unit: null }).values!;
    const after = calculateCatch({ ...input, internal_handling_cost_per_unit: 2.5 }).values!;
    expect(after.internal_handling_cost_total).toBeCloseTo(250, 6);
    expect(after.db_ii).toBeCloseTo(before.db_i - 250, 6);
    expect(before.db_i).toBeCloseTo(after.db_i, 6);
  });

  it("erlaubt einen catchspezifischen abweichenden Wert", () => {
    const custom = calculateCatch({ ...input, internal_handling_cost_per_unit: 4 }).values!;
    expect(custom.internal_handling_cost_total).toBeCloseTo(400, 6);
  });
});
