import { parseNumberInput } from "@/lib/catch-calculation";

export type MassUnit = "g" | "kg";
export type DisplayBasis = "kg" | "100g";

function positive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

export function weightKg(value: string, unit: MassUnit): number | null {
  const weight = parseNumberInput(value);
  if (!positive(weight)) return null;
  const kg = unit === "g" ? weight / 1000 : weight;
  return positive(kg) ? kg : null;
}

/** Scratch comparison only: both inputs are retail prices INCLUDING VAT. */
export function compareQuantityPrice({
  grossPrice,
  quantityUnit,
  soldUnitWeight,
  soldUnitWeightUnit,
  packPrice,
  packWeight,
  packWeightUnit,
  basis,
}: {
  grossPrice: number | null;
  quantityUnit: string;
  soldUnitWeight: string;
  soldUnitWeightUnit: MassUnit;
  packPrice: string;
  packWeight: string;
  packWeightUnit: MassUnit;
  basis: DisplayBasis;
}) {
  const ourWeight = quantityUnit === "kg" ? 1 : weightKg(soldUnitWeight, soldUnitWeightUnit);
  const competitorWeight = weightKg(packWeight, packWeightUnit);
  const competitorPrice = parseNumberInput(packPrice);
  const factor = basis === "100g" ? 0.1 : 1;
  const ourPerKg = positive(grossPrice) && positive(ourWeight) ? grossPrice / ourWeight : null;
  const competitorPerKg =
    positive(competitorPrice) && positive(competitorWeight)
      ? competitorPrice / competitorWeight
      : null;
  const ours = ourPerKg === null ? null : ourPerKg * factor;
  const competitor = competitorPerKg === null ? null : competitorPerKg * factor;
  const difference =
    positive(ourPerKg) && positive(competitorPerKg)
      ? ((ourPerKg - competitorPerKg) / competitorPerKg) * 100
      : null;
  return {
    ours: ours !== null && Number.isFinite(ours) ? ours : null,
    competitor: competitor !== null && Number.isFinite(competitor) ? competitor : null,
    difference: difference !== null && Number.isFinite(difference) ? difference : null,
    missingSoldWeight: ourWeight === null,
  };
}
