import { formatCurrency } from "@/lib/format";
import type { CalculationInput } from "@/lib/catch-calculation";
import { netCost, resolveVatRate, DEFAULT_PURCHASE_VAT_RATE } from "@/lib/vat";
import {
  derivePackModel,
  formatWeight,
  salePackLabel,
  toMilligrams,
  type PricingBasisV1,
} from "@/lib/pricing-basis";

export type BasisInput = Pick<
  PricingBasisV1,
  | "purchase_basis"
  | "purchase_rate"
  | "purchase_total_weight"
  | "purchase_pack_count"
  | "purchase_pack_weight"
  | "sale_pack_weight"
>;

/** Original-Netto-EK und Brutto-Packungs-VP; Masse und volle Kapazität einmal. */
export function PackBasisSummary({ basis, input }: { basis: BasisInput; input: CalculationInput }) {
  const { model } = derivePackModel(basis);
  const sale = salePackLabel(basis as PricingBasisV1) ?? "Verkaufspackung";
  const rate =
    basis.purchase_rate === null
      ? null
      : netCost(
          basis.purchase_rate,
          Boolean(input.purchase_price_includes_vat),
          resolveVatRate(input.purchase_vat_rate, DEFAULT_PURCHASE_VAT_RATE),
        );
  const purchasePackMg = toMilligrams(basis.purchase_pack_weight);
  const rateText =
    rate === null || !Number.isFinite(rate)
      ? "—"
      : basis.purchase_basis === "per_100g"
        ? `${formatCurrency(rate)} / 100 g`
        : basis.purchase_basis === "per_kg"
          ? `${formatCurrency(rate)} / kg`
          : `${formatCurrency(rate)} / ${
              purchasePackMg === null
                ? "Einkaufspackung"
                : `${formatWeight(purchasePackMg / 1_000_000).replace(" ", "-")}-Packung`
            }`;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-3 border-b pb-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">EK netto</dt>
          <dd className="text-base font-semibold">{rateText}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">VP inkl. MWST</dt>
          <dd className="text-base font-semibold">
            {input.catch_price === null ? "—" : `${formatCurrency(input.catch_price)} / ${sale}`}
          </dd>
        </div>
      </dl>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Einkaufsgewicht</dt>
        <dd className="text-right">{model ? formatWeight(model.total_kg) : "—"}</dd>
        <dt className="text-muted-foreground">Volle Verkaufspackungen</dt>
        <dd className="text-right">{model ? `${model.capacity} × ${sale}` : "—"}</dd>
        {model && model.unallocated_kg > 0 ? (
          <>
            <dt className="text-muted-foreground">Nicht verpacktes Restgewicht</dt>
            <dd className="text-right">{formatWeight(model.unallocated_kg)}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
