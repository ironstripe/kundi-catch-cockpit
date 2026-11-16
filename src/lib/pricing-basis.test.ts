/**
 * Getrennte Einkaufs-/Verkaufsbasis: Akzeptanzfälle (a)–(d) mit
 * 2.6 % Verkaufs-MWST, EK netto, ohne Lieferkosten.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// PGlite-Starts brauchen unter voller Suite-Last mehrere Sekunden.
vi.setConfig({ testTimeout: 30_000 });

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
import {
  derivePackModel,
  MAX_PACK_CAPACITY,
  readPricingBasis,
  roundCents,
  salePackLabel,
} from "@/lib/pricing-basis";
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

describe("Round-trip durch numeric(12,2) (PGlite)", () => {
  const ratio300g: CatchFormValues = {
    ...perKg,
    sale_pack_weight: "300",
    sale_pack_weight_unit: "g",
    catch_price: "3.333",
    regular_price: "4.995",
  };

  async function roundTrip(values: CatchFormValues, legacyOverride?: Record<string, unknown>) {
    const db = new PGlite();
    await db.exec(`CREATE TABLE c (
      purchase_quantity numeric(12,3), quantity_unit text, purchase_price numeric(12,2),
      catch_price numeric(12,2), regular_price numeric(12,2), pricing_basis jsonb)`);
    const cols = pricingColumns(values);
    const basis = legacyOverride
      ? { ...cols.pricing_basis!, legacy: { ...cols.pricing_basis!.legacy, ...legacyOverride } }
      : cols.pricing_basis;
    await db.query(`INSERT INTO c VALUES ($1,$2,$3,$4,$5,$6)`, [
      cols.purchase_quantity,
      cols.quantity_unit,
      cols.purchase_price,
      cols.catch_price,
      cols.regular_price,
      JSON.stringify(basis),
    ]);
    const read = async () => {
      const r = (
        await db.query<{
          quantity_unit: string;
          purchase_quantity: unknown;
          purchase_price: unknown;
          catch_price: unknown;
          regular_price: unknown;
          pricing_basis: unknown;
        }>("SELECT * FROM c")
      ).rows[0]!;
      const toNum = (v: unknown) => (v === null ? null : Number(v));
      const row = {
        quantity_unit: String(r.quantity_unit),
        purchase_quantity: Number(r.purchase_quantity),
        purchase_price: toNum(r.purchase_price),
        catch_price: toNum(r.catch_price),
        regular_price: toNum(r.regular_price),
      };
      return { row, basis: readPricingBasis(r.pricing_basis, row) };
    };
    return { db, read };
  }

  it("300-g-Packungen: 66 Stück, CHF 134 Einkauf, Basis bleibt aktiv", async () => {
    const { db, read } = await roundTrip(ratio300g);
    const { row, basis } = await read();
    expect(row.purchase_price).toBe(2.03);
    expect(row.catch_price).toBe(3.33);
    expect(row.regular_price).toBe(5);
    expect(basis).not.toBeNull();
    const item = {
      ...draftCatch,
      ...row,
      vat_rate: 2.6,
      purchase_price_includes_vat: false,
      delivery_cost: 0,
      delivery_included: false,
      internal_handling_cost_per_unit: 2.5,
      pricing_basis: basis,
    };
    const v = calculateCatch(catchToCalculationInput(item)).values!;
    expect(v.purchase_quantity).toBe(66);
    expect(v.net_investment).toBeCloseTo(134, 9);
    expect(v.maximum_gross_revenue).toBeCloseTo(66 * 3.33, 9);
    const r = reconcileCatch({ ...catchToReconciliationInput(item), remaining_quantity: 0 });
    expect(r.values!.total_investment).toBeCloseTo(134, 9);
    expect(r.values!.sold_quantity).toBe(66);
    expect(catchDetailToForm(item).catch_price).toBe("3.33");
    const text = generatePostText(catchToPostSource({ ...item, locations: [] }));
    expect(text).toContain("CHF 3.33 pro 300-g-Packung");
    // Reload → Formular → erneutes Speichern ist stabil.
    expect(pricingColumns(catchDetailToForm(item)).pricing_basis!.legacy).toEqual(basis!.legacy);
    await db.close();
  });

  it("exakter Abdruck eines früheren Builds wird über Rappen erkannt", async () => {
    const { db, read } = await roundTrip(ratio300g, { purchase_price: 134 / 66 });
    expect((await read()).basis).not.toBeNull();
    await db.close();
  });

  it("echte Spaltenänderung eines älteren Frontends deaktiviert die Basis", async () => {
    const { db, read } = await roundTrip(ratio300g);
    await db.exec("UPDATE c SET purchase_price = 2.10");
    expect((await read()).basis).toBeNull();
    await db.exec("UPDATE c SET purchase_price = 2.03, catch_price = 3.40");
    expect((await read()).basis).toBeNull();
    await db.close();
  });

  it("unrealistische Beträge werden abgelehnt statt still verloren", () => {
    const huge = derivePackModel({
      purchase_basis: "per_kg",
      purchase_rate: 1e12,
      purchase_total_weight: { value: 20, unit: "kg" },
      purchase_pack_count: null,
      purchase_pack_weight: null,
      sale_pack_weight: { value: 300, unit: "g" },
    });
    expect(huge.model).toBeNull();
    expect(huge.issues[0]?.field).toBe("purchase_rate");
  });
});

describe("Rappenrundung und Kapazitätsgrenze", () => {
  it("roundCents: winzige Beträge → +0, Halbrappen kaufmännisch", () => {
    expect(Object.is(roundCents(5e-8), 0)).toBe(true);
    expect(Object.is(roundCents(-5e-8), 0)).toBe(true);
    expect(roundCents(0.004999)).toBe(0);
    expect(roundCents(0.005)).toBe(0.01);
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(2.030303)).toBe(2.03);
  });

  it("winziger Einkaufsbetrag: Spalte 0, Basis bleibt aktiv und exakt", () => {
    const values: CatchFormValues = {
      ...base,
      purchase_basis: "per_kg",
      purchase_rate: "0.00000005",
      purchase_total_weight: "1",
      purchase_total_weight_unit: "kg",
      sale_pack_weight: "1",
      sale_pack_weight_unit: "kg",
    };
    const cols = JSON.parse(JSON.stringify(pricingColumns(values)));
    expect(cols.purchase_price).toBe(0);
    const basis = readPricingBasis(cols.pricing_basis, { ...cols, purchase_price: 0 });
    expect(basis).not.toBeNull();
    expect(basis!.purchase_rate).toBe(5e-8);
    expect(derivePackModel(basis!).model!.purchase_price_per_sale_pack).toBe(5e-8);
  });

  it("Kapazität über numeric(12,2)-Bereich → Feldmeldung statt Modell", () => {
    const tooMany = derivePackModel({
      purchase_basis: "per_kg",
      purchase_rate: 1,
      purchase_total_weight: { value: 100_000, unit: "kg" },
      purchase_pack_count: null,
      purchase_pack_weight: null,
      sale_pack_weight: { value: 0.001, unit: "g" },
    });
    expect(tooMany.model).toBeNull();
    expect(tooMany.issues[0]?.field).toBe("sale_pack_weight");
    const atLimit = derivePackModel({
      purchase_basis: "per_kg",
      purchase_rate: 0,
      purchase_total_weight: { value: MAX_PACK_CAPACITY, unit: "g" },
      purchase_pack_count: null,
      purchase_pack_weight: null,
      sale_pack_weight: { value: 1, unit: "g" },
    });
    expect(atLimit.model?.capacity).toBe(MAX_PACK_CAPACITY);
  });
});
