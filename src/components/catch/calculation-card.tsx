import type { ReactNode } from "react";

import { DECISION_CLASSES, DECISION_ICONS } from "@/components/catch/decision-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHelp } from "@/components/ui/info-help";
import { MountedDisclosure } from "@/components/layout/mounted-disclosure";
import type { CalculationResult, CalculationInput } from "@/lib/catch-calculation";
import { formatCurrency, formatPercentValue, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { vatBasisLabel, netCost, resolveVatRate, DEFAULT_PURCHASE_VAT_RATE } from "@/lib/vat";

const HELP: Record<string, string> = {
  "Angebotspreis inkl. MWST":
    "Der Kundenpreis enthält immer die Mehrwertsteuer. Er wird so kommuniziert und publiziert.",
  "Maximaler Nettoumsatz":
    "Vor der Margenrechnung wird die enthaltene Mehrwertsteuer abgezogen. Deckungsbeitrag und Rohmarge beruhen auf diesem Nettoumsatz.",
  Nettoinvestition:
    "Ware und Lieferkosten ohne Mehrwertsteuer — je nach erfasster Steuerbasis umgerechnet.",
  "DB I":
    "DB I ist der Deckungsbeitrag nach Waren- und Lieferkosten, wenn die gesamte Einkaufsmenge zum Food-Catch-Preis verkauft wird.",
  "DB II":
    "DB II ist DB I abzüglich des direkt zurechenbaren internen Catch-Aufwands (Wareneingang, interner Transport, Vorbereitung, Umpacken, Etikettierung, catchbezogene Administration, Verpackungs- und Etikettenmaterial). Nicht enthalten sind Miete, Energie, allgemeine Administration, normale Ladenarbeit, Marketing sowie andere Gemeinkosten. DB II ist kein Gewinn.",
  "DB-II-Marge": "Anteil von DB II am Nettoumsatz.",
  "Interner Aufwand pro Einheit":
    "Pauschale für direkt zurechenbare Logistik, Bereitstellung, Etikettierung und Verpackung — pro vorbereitete Einheit.",
  "Interner Aufwand total":
    "Interner Aufwand pro Einheit multipliziert mit der gesamten vorbereiteten Menge, unabhängig vom Abverkauf.",
  "DB-I-Marge": "Die Rohmarge ist der Anteil des maximalen Deckungsbeitrags am maximalen Umsatz.",
  "Break-even-Abverkauf":
    "Der Break-even-Abverkauf zeigt, welcher Anteil der Einkaufsmenge verkauft werden muss, damit der gesamte Wareneinsatz gedeckt ist.",
  Preisvorteil:
    "Der Preisvorteil zeigt, wie viel günstiger der Food-Catch-Preis gegenüber dem hinterlegten Normalpreis ist.",
};

interface CalculationCardProps {
  result: CalculationResult;
  input?: CalculationInput;
  comparison?: ReactNode;
  /** Kompakte Variante für die Formularspalte. */
  compact?: boolean;
  description?: string;
  footer?: ReactNode;
}

export function CalculationCard({
  result,
  input,
  comparison,
  compact = false,
  description,
  footer,
}: CalculationCardProps) {
  const v = result.values;
  const unit = v?.quantity_unit ?? input?.quantity_unit ?? "kg";
  const ek = v?.net_purchase_price_per_unit ?? (input?.purchase_price == null ? null : netCost(input.purchase_price, Boolean(input.purchase_price_includes_vat), resolveVatRate(input.purchase_vat_rate, DEFAULT_PURCHASE_VAT_RATE)));
  const vp = v?.gross_sales_price_per_unit ?? input?.catch_price ?? null;
  const quantity = v?.purchase_quantity ?? input?.purchase_quantity ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">Vorkalkulation</CardTitle>
        <CardDescription className="text-xs">
          Vorkalkulation / maximal bei vollständigem Abverkauf
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact && "text-sm")}>
        <p
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            DECISION_CLASSES[result.level],
          )}
          role="status"
        >
          {DECISION_ICONS[result.level]} {result.label}
          <InfoHelp label="Beurteilung">
            {result.summary} {result.criteria.join(" · ")}
          </InfoHelp>
        </p>
        {description ? <span className="sr-only">{description}</span> : null}
        <dl className="grid grid-cols-2 gap-3 border-b pb-3">
          <Primary label="EK netto" value={ek === null ? "—" : `${formatCurrency(ek)} / ${unit}`} />
          <Primary label="VP inkl. MWST" value={vp === null ? "—" : `${formatCurrency(vp)} / ${unit}`} />
        </dl>
        <p className="text-xs text-muted-foreground">Einkaufsmenge: {quantity === null || quantity <= 0 ? "—" : formatQuantity(quantity, unit)}</p>
        {comparison}
        {!result.complete ? (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Fehlende Angaben</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {result.missing.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        ) : v ? (
          <>
            <dl className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2")}>
              <Primary label="DB I" value={formatCurrency(v.db_i)} negative={v.db_i <= 0} />
              <Primary
                label="DB-I-Marge"
                value={
                  v.gross_margin_percentage === null
                    ? "—"
                    : formatPercentValue(v.gross_margin_percentage)
                }
                negative={(v.gross_margin_percentage ?? 0) <= 0}
              />
              <Primary
                label="DB II"
                value={
                  v.db_ii === null ? "Interner Aufwand nicht erfasst" : formatCurrency(v.db_ii)
                }
                negative={(v.db_ii ?? 0) <= 0 && v.db_ii !== null}
              />
              <Primary
                label="DB-II-Marge"
                value={
                  v.db_ii_margin_percentage === null
                    ? "—"
                    : formatPercentValue(v.db_ii_margin_percentage)
                }
                negative={
                  (v.db_ii_margin_percentage ?? 0) <= 0 && v.db_ii_margin_percentage !== null
                }
              />
            </dl>

            <MountedDisclosure title="Rechenweg und Details">
              <dl className="space-y-1 border-t pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Interner Catch-Aufwand
                </p>
                <Secondary
                  label="Interner Aufwand pro Einheit"
                  value={
                    v.internal_handling_cost_per_unit === null
                      ? "Interner Aufwand nicht erfasst"
                      : `${formatCurrency(v.internal_handling_cost_per_unit)} / ${unit}`
                  }
                  muted={v.internal_handling_cost_per_unit === null}
                />
                <Secondary
                  label="Interner Aufwand total"
                  value={
                    v.internal_handling_cost_total === null
                      ? "—"
                      : `${formatCurrency(v.internal_handling_cost_total)}${
                          v.internal_handling_cost_share_percentage === null
                            ? ""
                            : ` (${formatPercentValue(v.internal_handling_cost_share_percentage)} des Nettoumsatzes)`
                        }`
                  }
                />
              </dl>

              <dl className="space-y-1 border-t pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Interne Rechnung (netto)
                </p>
                <Secondary
                  label={`Nettopreis (MWST ${formatPercentValue(v.vat_rate)})`}
                  value={`${formatCurrency(v.net_sales_price_per_unit)} / ${unit}`}
                />
                <Secondary
                  label="Enthaltene MWST"
                  value={`${formatCurrency(v.maximum_sales_vat)} (${formatCurrency(v.vat_per_unit)} / ${unit})`}
                />
                <Secondary
                  label="Nettoeinkaufspreis"
                  value={`${formatCurrency(v.net_purchase_price_per_unit)} / ${unit} (${vatBasisLabel(v.purchase_price_includes_vat)} erfasst)`}
                />
                <Secondary
                  label="Nettolieferkosten"
                  value={`${formatCurrency(v.net_delivery_cost)} (${vatBasisLabel(v.delivery_cost_includes_vat)} erfasst)`}
                />
                <Secondary
                  label="Effektiver EK pro Einheit"
                  value={`${formatCurrency(v.effective_cost_per_unit)} / ${unit}`}
                />
                <Secondary
                  label="DB pro Einheit"
                  value={`${formatCurrency(v.contribution_margin_per_unit)} / ${unit}`}
                  negative={v.contribution_margin_per_unit <= 0}
                />
                <Secondary
                  label="Break-even-Menge"
                  value={
                    v.break_even_quantity === null
                      ? "—"
                      : formatQuantity(v.break_even_quantity, unit)
                  }
                />
                <Secondary
                  label="Break-even-Abverkauf"
                  value={
                    v.break_even_sell_through === null
                      ? "—"
                      : formatPercentValue(v.break_even_sell_through)
                  }
                />
              </dl>

              <dl className="space-y-1">
                <Secondary label="Nettoinvestition" value={formatCurrency(v.net_investment)} />
                <Secondary
                  label="Maximaler Nettoumsatz"
                  value={formatCurrency(v.maximum_net_revenue)}
                />
                <Secondary
                  label="Maximaler Bruttoumsatz"
                  value={formatCurrency(v.maximum_gross_revenue)}
                />
                <Secondary
                  label="Normalpreis inkl. MWST"
                  value={
                    v.regular_price === null ? "—" : `${formatCurrency(v.regular_price)} / ${unit}`
                  }
                />
                <Secondary
                  label="Preisvorteil"
                  value={
                    v.discount_percentage === null ? "—" : formatPercentValue(v.discount_percentage)
                  }
                />
              </dl>
            </MountedDisclosure>
          </>
        ) : null}

        {footer}
      </CardContent>
    </Card>
  );
}

function Help({ label }: { label: string }) {
  const text = HELP[label];
  return text ? <InfoHelp label={label}>{text}</InfoHelp> : null;
}

function Primary({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        <Help label={label} />
      </dt>
      <dd className={cn("text-base font-semibold", negative && "text-destructive")}>{value}</dd>
    </div>
  );
}

function Secondary({
  label,
  value,
  negative,
  muted,
}: {
  label: string;
  value: string;
  negative?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        <Help label={label} />
      </dt>
      <dd
        className={cn(
          "text-right font-medium",
          negative && "text-destructive",
          muted && "font-normal text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
