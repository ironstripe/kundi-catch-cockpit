/**
 * Getrennte Einkaufs-/Verkaufsbasis: Akzeptanzfälle (a)–(d) mit
 * 2.6 % Verkaufs-MWST, EK netto, ohne Lieferkosten.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { calculateCatch } from "@/lib/catch-calculation";
import { reconcileCatch } from "@/lib/catch-reconciliation";
import { actualSellThrough, buildSnapshot } from "@/lib/catch-lifecycle";
import {
  catchDetailToForm,
  catchToCalculationInput,
  catchToReconciliationInput,
  displayUnit,
  EMPTY_CATCH_FORM,
  formValuesToCalculationInput,
  pricingColumns,
  type CatchDetail,
  type CatchFormValues,
} from "@/lib/catches";
import { validateDraft } from "@/lib/catch-validation";
import { catchToPostSource } from "@/lib/publication";
import { derivePackModel, readPricingBasis, salePackLabel } from "@/lib/pricing-basis";
import { compareQuantityPrice } from "@/lib/quantity-price";
import { generatePostText, postSourceSignature } from "@/lib/whatsapp-post";
import { draftCatch } from "@/test/catch-fixture";

const base: CatchFormValues = {
  ...EMPTY_CATCH_FORM,
  product_name: "Lachs",
  pricing_mode: "pack",
  catch_price: "20",
  vat_rate: "2.6",
  delivery_cost: "0",
  internal_handling_cost_per_unit: "2.50",
  sale_pack_weight: "2.5",
  sale_pack_weight_unit: "kg",
};
const perKg = {
  ...base,
  purchase_basis: "per_kg" as const,
  purchase_rate: "6.70",
  purchase_total_weight: "20",
  purchase_total_weight_unit: "kg" as const,
};
const per100g = {
  ...base,
  purchase_basis: "per_100g" as const,
  purchase_rate: "0.67",
  purchase_total_weight: "20000",
  purchase_total_weight_unit: "g" as const,
};
const perPack = {
  ...base,
  purchase_basis: "per_pack" as const,
  purchase_rate: "13.40",
  purchase_pack_count: "10",
  purchase_pack_weight: "2",
  purchase_pack_weight_unit: "kg" as const,
};

/** Speichern (Spalten) und als gespeicherter Catch zurücklesen. */
function saveAndReload(values: CatchFormValues): CatchDetail {
  const cols = JSON.parse(JSON.stringify(pricingColumns(values)));
  return {
    ...draftCatch,
    purchase_quantity: cols.purchase_quantity,
    quantity_unit: cols.quantity_unit,
    purchase_price: cols.purchase_price,
    catch_price: cols.catch_price,
    regular_price: cols.regular_price,
    vat_rate: 2.6,
    purchase_price_includes_vat: false,
    delivery_cost: 0,
    delivery_included: false,
    internal_handling_cost_per_unit: 2.5,
    pricing_basis: readPricingBasis(cols.pricing_basis, cols),
  };
}

describe("(a) drei gleichwertige Einkaufsbasen, 2.5-kg-Verkaufspackung", () => {
  for (const [name, values] of [
    ["pro kg", perKg],
    ["pro 100 g", per100g],
    ["pro Packung", perPack],
  ] as const) {
    it(`${name}: 20 kg, 8 Packungen, DB I 21.95, DB II 1.95 — auch nach Reload`, () => {
      const model = derivePackModel(
        JSON.parse(JSON.stringify(pricingColumns(values).pricing_basis)),
      ).model!;
      expect(model.total_kg).toBe(20);
      expect(model.capacity).toBe(8);
      expect(model.purchase_total).toBeCloseTo(134, 10);
      for (const input of [
        formValuesToCalculationInput(values),
        catchToCalculationInput(saveAndReload(values)),
      ]) {
        const v = calculateCatch(input).values!;
        expect(v.purchase_quantity).toBe(8);
        expect(v.net_investment).toBeCloseTo(134, 9);
        expect(v.maximum_gross_revenue).toBeCloseTo(160, 9);
        expect(v.db_i).toBeCloseTo(21.95, 2);
        expect(v.internal_handling_cost_total).toBeCloseTo(20, 9);
        expect(v.db_ii).toBeCloseTo(1.95, 2);
        expect(input.quantity_unit).toBe("2.5-kg-Packung");
      }
      const reloaded = catchDetailToForm(saveAndReload(values));
      for (const key of [
        "purchase_basis",
        "purchase_rate",
        "purchase_total_weight",
        "purchase_total_weight_unit",
        "purchase_pack_count",
        "purchase_pack_weight",
        "sale_pack_weight",
        "sale_pack_weight_unit",
      ] as const) {
        if (values[key] !== EMPTY_CATCH_FORM[key])
          expect(String(reloaded[key])).toBe(String(Number(values[key]) || values[key]));
      }
      expect(reloaded.pricing_mode).toBe("pack");
      const cmp = compareQuantityPrice({
        grossPrice: 20,
        quantityUnit: "Stk",
        knownSoldUnitKg: model.sale_pack_kg,
        basis: "kg",
        packPrice: "",
        packWeight: "",
        packWeightUnit: "g",
        soldUnitWeight: "",
        soldUnitWeightUnit: "g",
      });
      expect(cmp.ours).toBe(8);
    });
  }

  it("Legacy-Spalten bleiben dimensionskonsistent (Stk = Verkaufspackung)", () => {
    const cols = pricingColumns(perPack);
    expect(cols).toMatchObject({
      quantity_unit: "Stk",
      purchase_quantity: 8,
      purchase_price: 16.75,
      catch_price: 20,
    });
  });
});

describe("(b) 3.5-kg-Verkaufspackungen mit Rohrest", () => {
  const values = { ...perKg, sale_pack_weight: "3500", sale_pack_weight_unit: "g" as const };
  const item = saveAndReload(values);

  it("5 volle Packungen, 2.5 kg Rest, CHF 100 brutto, voller Einkauf", () => {
    const model = derivePackModel(item.pricing_basis!).model!;
    expect(model.capacity).toBe(5);
    expect(model.unallocated_kg).toBe(2.5);
    const v = calculateCatch(catchToCalculationInput(item)).values!;
    expect(v.maximum_gross_revenue).toBeCloseTo(100, 9);
    expect(v.net_investment).toBeCloseTo(134, 9);
  });

  it("4 vorbereitet, 1 unverkauft → 3 verkauft, CHF 60 brutto, CHF 10 Aufwand", () => {
    const r = reconcileCatch({
      ...catchToReconciliationInput(item),
      remaining_quantity: 1,
      prepared_quantity: 4,
    }).values!;
    expect(r.sold_quantity).toBe(3);
    expect(r.effective_revenue_gross).toBeCloseTo(60, 9);
    expect(r.internal_handling_cost_total).toBeCloseTo(10, 9);
    expect(r.total_investment).toBeCloseTo(134, 9);
    expect(r.sell_through_percentage).toBeCloseTo(75, 9);
    expect(r.unsold_pack_kg).toBe(3.5);
    expect(r.unallocated_kg).toBe(6); // 20 − 4 × 3.5
    expect(r.remaining_inventory_value).toBeCloseTo((9.5 * 134) / 20, 9);
    expect(actualSellThrough(item, 1, 4)).toBeCloseTo(75, 9);
    expect(buildSnapshot(item, 1, "2026-11-16T10:00:00Z", 4).prepared_quantity).toBe(4);
  });

  it("vorbereitete Packungen über Kapazität oder gebrochen sind ungültig", () => {
    expect(
      reconcileCatch({
        ...catchToReconciliationInput(item),
        remaining_quantity: 0,
        prepared_quantity: 6,
      }).values,
    ).toBeNull();
    expect(
      reconcileCatch({
        ...catchToReconciliationInput(item),
        remaining_quantity: 0,
        prepared_quantity: 2.5,
      }).values,
    ).toBeNull();
    expect(
      reconcileCatch({
        ...catchToReconciliationInput(item),
        remaining_quantity: 5,
        prepared_quantity: 4,
      }).values,
    ).toBeNull();
  });

  it("Grenzen ohne Binärrundung: 0.3 kg in 0.1-kg-Packungen = 3", () => {
    const m = derivePackModel({
      purchase_basis: "per_kg",
      purchase_rate: 1,
      purchase_total_weight: { value: 0.3, unit: "kg" },
      purchase_pack_count: null,
      purchase_pack_weight: null,
      sale_pack_weight: { value: 0.1, unit: "kg" },
    }).model!;
    expect(m.capacity).toBe(3);
    expect(m.unallocated_kg).toBe(0);
  });
});

describe("(c) keine erfundenen Werte", () => {
  it("fehlendes Gewicht, unmögliche Packung oder Preis → keine Kalkulation", () => {
    expect(
      calculateCatch(formValuesToCalculationInput({ ...perKg, sale_pack_weight: "" })).values,
    ).toBeNull();
    expect(
      calculateCatch(formValuesToCalculationInput({ ...perKg, purchase_total_weight: "" })).values,
    ).toBeNull();
    expect(
      calculateCatch(formValuesToCalculationInput({ ...perKg, purchase_rate: "" })).values,
    ).toBeNull();
    expect(
      calculateCatch(formValuesToCalculationInput({ ...perKg, sale_pack_weight: "25" })).values,
    ).toBeNull();
    expect(validateDraft({ ...perKg, sale_pack_weight: "25" }).map((i) => i.field)).toContain(
      "sale_pack_weight",
    );
    expect(validateDraft({ ...perPack, purchase_pack_count: "2.5" }).map((i) => i.field)).toContain(
      "purchase_pack_count",
    );
    expect(validateDraft({ ...perKg, sale_pack_weight: "" })).toEqual([]);
    const cmp = compareQuantityPrice({
      grossPrice: 20,
      quantityUnit: "Stk",
      knownSoldUnitKg: 0,
      basis: "kg",
      packPrice: "10",
      packWeight: "1",
      packWeightUnit: "kg",
      soldUnitWeight: "",
      soldUnitWeightUnit: "g",
    });
    expect(cmp.ours).toBeNull();
    expect(cmp.difference).toBeNull();
  });

  it("Legacy-Catch (100 kg à 6.50, VP 7.90/kg) rechnet und postet unverändert", () => {
    const v = calculateCatch(catchToCalculationInput(draftCatch)).values!;
    expect(v.net_investment).toBe(650);
    expect(v.quantity_unit).toBe("kg");
    expect(displayUnit(draftCatch)).toBe("kg");
    expect(catchDetailToForm(draftCatch).pricing_mode).toBe("unit");
    expect(pricingColumns(catchDetailToForm(draftCatch)).pricing_basis).toBeNull();
    const source = catchToPostSource(draftCatch);
    expect(generatePostText(source)).toContain("CHF 7.90/kg");
    expect(JSON.parse(postSourceSignature(source))).toHaveLength(14);
    expect(postSourceSignature(source)).not.toContain("sale_unit");
    const r = reconcileCatch({
      ...catchToReconciliationInput(draftCatch),
      remaining_quantity: 10,
    }).values!;
    expect(r.sold_quantity).toBe(90);
    expect(r.remaining_inventory_value).toBe(65);
  });

  it("geänderte Legacy-Spalten (älteres Frontend) → Basis wird ignoriert", () => {
    const cols = JSON.parse(JSON.stringify(pricingColumns(perKg)));
    expect(readPricingBasis(cols.pricing_basis, { ...cols, catch_price: 25 })).toBeNull();
    expect(readPricingBasis(cols.pricing_basis, { ...cols, quantity_unit: "kg" })).toBeNull();
  });
});

describe("(d) WhatsApp: echte Verkaufspackung, Legacy-Signatur unverändert", () => {
  it("Preis und Rabatt pro 2.5-kg-Packung; Signatur erkennt Packungsänderung", () => {
    const item = { ...saveAndReload({ ...perKg, regular_price: "25" }), locations: [] };
    const text = generatePostText(catchToPostSource(item));
    expect(text).toContain("~CHF 25.00 pro 2.5-kg-Packung~ → *CHF 20.00 pro 2.5-kg-Packung*");
    expect(text).toContain("20.0 % günstiger");
    expect(text).not.toContain("/Stück");
    const other = saveAndReload({
      ...perKg,
      regular_price: "25",
      sale_pack_weight: "500",
      sale_pack_weight_unit: "g",
    });
    expect(salePackLabel(other.pricing_basis)).toBe("500-g-Packung");
    expect(postSourceSignature(catchToPostSource(other))).not.toBe(
      postSourceSignature(catchToPostSource(item)),
    );
  });
});

describe("Migration (isoliertes PGlite)", () => {
  it("fügt nur eine optionale, versionierte Spalte hinzu", async () => {
    const db = new PGlite();
    await db.exec(
      `CREATE TABLE public.catches (id int PRIMARY KEY, quantity_unit text NOT NULL DEFAULT 'kg'); INSERT INTO public.catches VALUES (1, 'kg');`,
    );
    await db.exec(readFileSync("drizzle/migrations/0004_add_catch_pricing_basis.sql", "utf8"));
    const legacy = await db.query<{ pricing_basis: unknown }>(
      "SELECT pricing_basis FROM public.catches WHERE id = 1",
    );
    expect(legacy.rows[0]!.pricing_basis).toBeNull();
    await db.exec(`INSERT INTO public.catches VALUES (2, 'Stk', '{"version":1}')`);
    await expect(
      db.exec(`INSERT INTO public.catches VALUES (3, 'Stk', '{"version":2}')`),
    ).rejects.toThrow();
    await db.close();
  });
});
