import { formatCurrency } from "@/lib/format";
import {
  derivePackModel,
  formatWeight,
  salePackLabel,
  toMilligrams,
  type PricingBasisV1,
} from "@/lib/pricing-basis";

type BasisInput = Pick<
  PricingBasisV1,
  | "purchase_basis"
  | "purchase_rate"
  | "purchase_total_weight"
  | "purchase_pack_count"
  | "purchase_pack_weight"
  | "sale_pack_weight"
>;

/** Originalbasis von Einkauf und Verkauf plus gemeinsamer CHF/kg-Vergleich. */
export function PackBasisSummary({
  basis,
  catchPrice,
  purchaseVatLabel,
}: {
  basis: BasisInput;
  catchPrice: number | null;
  purchaseVatLabel: string;
}) {
  const { model } = derivePackModel(basis);
  const sale = salePackLabel(basis as PricingBasisV1) ?? "Verkaufspackung";
  const rate = basis.purchase_rate;
  const rateText =
    rate === null || !Number.isFinite(rate)
      ? "—"
      : basis.purchase_basis === "per_100g"
        ? `${formatCurrency(rate)} pro 100 g`
        : basis.purchase_basis === "per_kg"
          ? `${formatCurrency(rate)} pro kg`
          : `${formatCurrency(rate)} pro ${
              toMilligrams(basis.purchase_pack_weight) === null
                ? "Einkaufspackung"
                : `${formatWeight(toMilligrams(basis.purchase_pack_weight)! / 1_000_000).replace(" ", "-")}-Packung`
            }`;
  const vpPerKg =
    model && catchPrice !== null && catchPrice > 0 ? catchPrice / model.sale_pack_kg : null;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border bg-muted/20 p-2 text-xs">
      <dt className="text-muted-foreground">EK-Basis {purchaseVatLabel}</dt>
      <dd className="text-right">{rateText}</dd>
      <dt className="text-muted-foreground">Einkaufsgewicht</dt>
      <dd className="text-right">{model ? formatWeight(model.total_kg) : "—"}</dd>
      <dt className="text-muted-foreground">Einkauf total {purchaseVatLabel}</dt>
      <dd className="text-right">{model ? formatCurrency(model.purchase_total) : "—"}</dd>
      <dt className="text-muted-foreground">Volle Verkaufspackungen</dt>
      <dd className="text-right">{model ? `${model.capacity} × ${sale}` : "—"}</dd>
      {model && model.unallocated_kg > 0 ? (
        <>
          <dt className="text-muted-foreground">Nicht verpacktes Restgewicht</dt>
          <dd className="text-right">{formatWeight(model.unallocated_kg)}</dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">VP inkl. MWST pro kg</dt>
      <dd className="text-right">{vpPerKg === null ? "—" : formatCurrency(vpPerKg)}</dd>
    </dl>
  );
}
