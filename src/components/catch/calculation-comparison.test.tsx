// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CalculationCard } from "@/components/catch/calculation-card";
import { QuantityPriceComparison } from "@/components/catch/quantity-price-comparison";
import { calculateCatch } from "@/lib/catch-calculation";
import {
  EMPTY_CATCH_FORM, pricingColumns, formPricingBasis, formValuesToCalculationInput,
  catchToCalculationInput, type CatchFormValues,
} from "@/lib/catches";
import { draftCatch } from "@/test/catch-fixture";
import { readPricingBasis, toMilligrams } from "@/lib/pricing-basis";
import { formatCurrency } from "@/lib/format";

afterEach(cleanup);
const values: CatchFormValues = {
  ...EMPTY_CATCH_FORM, product_name: "Pouletschenkel", pricing_mode: "pack",
  purchase_basis: "per_kg", purchase_rate: "6.75", purchase_total_weight: "20",
  purchase_total_weight_unit: "kg", sale_pack_weight: "2.5", sale_pack_weight_unit: "kg",
  catch_price: "20", regular_price: "30", vat_rate: "2.6",
  purchase_price_includes_vat: false, delivery_cost: "0",
  internal_handling_cost_per_unit: "2.50",
};
const columns = pricingColumns(values);
const saved = {
  ...draftCatch, ...columns, packaging: "Keine Gewichtsangabe",
  vat_rate: 2.6, purchase_price_includes_vat: false,
  delivery_cost: 0, delivery_included: false, internal_handling_cost_per_unit: 2.5,
  pricing_basis: readPricingBasis(columns.pricing_basis, columns),
};

for (const entry of ["live", "saved"] as const) {
  it(`${entry}: original EK, shared pack VP, exact profits and equivalent g/kg comparison`, async () => {
    const input = entry === "live"
      ? formValuesToCalculationInput(values)
      : catchToCalculationInput(saved);
    const basis = entry === "live" ? formPricingBasis(values) : saved.pricing_basis;
    const result = calculateCatch(input);
    expect(result.values?.purchase_quantity).toBe(8);
    expect(result.values?.net_investment).toBe(135);
    expect(result.values?.db_i).toBeCloseTo(20.9454191, 6);
    expect(result.values?.db_ii).toBeCloseTo(0.9454191, 6);
    const salePackKg = (toMilligrams(basis?.sale_pack_weight) ?? 0) / 1_000_000;
    const comparison = <QuantityPriceComparison grossPrice={input.catch_price}
      quantityUnit={input.quantity_unit} salePackKg={salePackKg} />;
    const view = render(entry === "live" ? <>
      {comparison}<CalculationCard result={result} input={input} pricingBasis={basis} />
    </> : <CalculationCard result={result} input={input} pricingBasis={basis}
      comparison={comparison} />);
    expect(screen.getByText(`${formatCurrency(6.75)} / kg`)).toBeTruthy();
    expect(screen.getByText(`${formatCurrency(20)} / 2.5-kg-Packung`)).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Vergleichsbasis" })).toBeNull();
    expect(screen.queryByLabelText("Nettogewicht pro Verkaufseinheit")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const comparisonValue = () => {
      const group = screen.getByText("Vergleich / kg").parentElement;
      if (!group) throw new Error("Comparison result missing");
      return within(group).getByText(formatCurrency(12));
    };
    fireEvent.change(screen.getByLabelText("Vergleichspreis pro Packung"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Gewicht der Vergleichspackung"), { target: { value: "2500" } });
    expect(comparisonValue()).toBeTruthy();
    expect(screen.getByText(formatCurrency(8))).toBeTruthy();
    // Operate the real accessible unit selector, not the comparison helper.
    fireEvent.click(screen.getByRole("combobox", { name: "Gewichtseinheit der Vergleichspackung" }));
    fireEvent.click(await screen.findByRole("option", { name: "kg" }));
    fireEvent.change(screen.getByLabelText("Gewicht der Vergleichspackung"), { target: { value: "2.5" } });
    expect(comparisonValue()).toBeTruthy();
    expect(input.regular_price).toBe(30);
    view.unmount();
  });
}

it("gross supplier inputs use the existing VAT conversion on the original source rate", () => {
  const gross = { ...values, purchase_rate: "6.9255", purchase_price_includes_vat: true, purchase_vat_rate: "2.6" };
  const input = formValuesToCalculationInput(gross);
  render(<CalculationCard result={calculateCatch(input)} input={input} pricingBasis={formPricingBasis(gross)} />);
  expect(screen.getByText(`${formatCurrency(6.75)} / kg`)).toBeTruthy();
  expect(calculateCatch(input).values?.net_investment).toBeCloseTo(135, 10);
});

it("legacy kg needs no weight and legacy Portion retains the labelled fallback", () => {
  const view = render(<QuantityPriceComparison grossPrice={8} quantityUnit="kg" />);
  expect(screen.getByText(formatCurrency(8))).toBeTruthy();
  expect(screen.queryByLabelText("Nettogewicht pro Verkaufseinheit")).toBeNull();
  view.rerender(<QuantityPriceComparison grossPrice={20} quantityUnit="Portion" />);
  fireEvent.change(screen.getByLabelText("Nettogewicht pro Verkaufseinheit"), { target: { value: "2500" } });
  expect(screen.getByRole("combobox", { name: "Gewichtseinheit Verkaufseinheit" })).toBeTruthy();
  expect(screen.getByText(formatCurrency(8))).toBeTruthy();
});