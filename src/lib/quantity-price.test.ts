import { describe, expect, it } from "vitest";
import { compareQuantityPrice, weightKg } from "@/lib/quantity-price";
import { calculateCatch } from "@/lib/catch-calculation";

const input = {
  grossPrice: 12,
  quantityUnit: "kg",
  soldUnitWeight: "",
  soldUnitWeightUnit: "g" as const,
  packPrice: "8",
  packWeight: "500",
  packWeightUnit: "g" as const,
  basis: "kg" as const,
};
describe("local gross mass comparison", () => {
  it("compares kg and 100 g with full-precision percentages", () => {
    expect(compareQuantityPrice(input)).toMatchObject({
      ours: 12,
      competitor: 16,
      difference: -25,
    });
    const per100g = compareQuantityPrice({ ...input, basis: "100g" });
    expect(per100g.ours).toBeCloseTo(1.2);
    expect(per100g.competitor).toBeCloseTo(1.6);
    expect(per100g.difference).toBe(-25);
    expect(weightKg("0.5", "kg")).toBe(0.5);
  });
  it("does not infer Stk/Portion weight and uses only explicitly known net weight", () => {
    for (const quantityUnit of ["Stk", "Portion"]) {
      expect(compareQuantityPrice({ ...input, quantityUnit })).toMatchObject({
        ours: null,
        difference: null,
        missingSoldWeight: true,
      });
      expect(compareQuantityPrice({ ...input, quantityUnit, soldUnitWeight: "750" }).ours).toBe(16);
    }
  });
  it.each(["", "0", "-1", "no", "Infinity"])(
    "unknown/invalid weight %s never becomes zero/NaN/Infinity",
    (packWeight) => {
      expect(compareQuantityPrice({ ...input, packWeight }).competitor).toBeNull();
      expect(compareQuantityPrice({ ...input, packPrice: packWeight }).difference).toBeNull();
    },
  );
  it("display and scratch entries cannot alter persisted inputs or DB values", () => {
    const financial = Object.freeze({
      purchase_quantity: 100,
      quantity_unit: "kg",
      purchase_price: 6,
      delivery_cost: 0,
      regular_price: 20,
      catch_price: 12,
      internal_handling_cost_per_unit: 2.5,
    });
    const before = calculateCatch(financial);
    compareQuantityPrice({ ...input, basis: "100g", packPrice: "17.33" });
    expect(financial.quantity_unit).toBe("kg");
    expect(financial.catch_price).toBe(12);
    expect(calculateCatch(financial)).toEqual(before);
    expect(before.values?.db_ii).toBeCloseTo(100 * (12 / 1.026 - 6) - 250);
  });
});
