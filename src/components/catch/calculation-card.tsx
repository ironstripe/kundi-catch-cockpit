import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

import { DECISION_CLASSES, DECISION_ICONS } from "@/components/catch/decision-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CalculationResult } from "@/lib/catch-calculation";
import { formatCurrency, formatPercentValue, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

const HELP: Record<string, string> = {
  "Maximaler DB":
    "Der maximale Deckungsbeitrag zeigt, was übrig bleibt, wenn die gesamte Einkaufsmenge zum Kundi-Catch-Preis verkauft wird.",
  Rohmarge:
    "Die Rohmarge ist der Anteil des maximalen Deckungsbeitrags am maximalen Umsatz.",
  "Break-even-Abverkauf":
    "Der Break-even-Abverkauf zeigt, welcher Anteil der Einkaufsmenge verkauft werden muss, damit der gesamte Wareneinsatz gedeckt ist.",
  Preisvorteil:
    "Der Preisvorteil zeigt, wie viel günstiger der Kundi-Catch-Preis gegenüber dem hinterlegten Normalpreis ist.",
};

interface CalculationCardProps {
  result: CalculationResult;
  /** Kompakte Variante für die Formularspalte. */
  compact?: boolean;
  description?: string;
  footer?: ReactNode;
}

export function CalculationCard({
  result,
  compact = false,
  description,
  footer,
}: CalculationCardProps) {
  const v = result.values;
  const unit = v?.quantity_unit ?? "kg";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Vorkalkulation</CardTitle>
        <CardDescription className="text-xs">
          {description ?? "Entscheidungshilfe aus den erfassten Eingabewerten — nicht editierbar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn("rounded-md border p-3", DECISION_CLASSES[result.level])}
          role="status"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {DECISION_ICONS[result.level]}
            {result.label}
          </p>
          <p className="mt-1 text-xs text-foreground/80">{result.summary}</p>
          {result.criteria.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[11px] text-foreground/70">
              {result.criteria.map((criterion) => (
                <li key={criterion}>· {criterion}</li>
              ))}
            </ul>
          ) : null}
        </div>

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
              <Primary label="Investition" value={formatCurrency(v.total_investment)} />
              <Primary label="Maximaler Umsatz" value={formatCurrency(v.maximum_revenue)} />
              <Primary
                label="Maximaler DB"
                value={formatCurrency(v.maximum_contribution_margin)}
                negative={v.maximum_contribution_margin <= 0}
              />
              <Primary
                label="Rohmarge"
                value={
                  v.gross_margin_percentage === null
                    ? "—"
                    : formatPercentValue(v.gross_margin_percentage)
                }
                negative={(v.gross_margin_percentage ?? 0) <= 0}
              />
            </dl>

            <dl className="space-y-1 border-t pt-3">
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
                label="Preisvorteil"
                value={
                  v.discount_percentage === null
                    ? "Kein Vergleichspreis hinterlegt"
                    : formatPercentValue(v.discount_percentage)
                }
                negative={(v.discount_percentage ?? 1) < 0}
                muted={v.discount_percentage === null}
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

            {result.explanations.length > 0 ? (
              <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                {result.explanations.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {footer}
      </CardContent>
    </Card>
  );
}

function Help({ label }: { label: string }) {
  const text = HELP[label];
  if (!text) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Erklärung zu ${label}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 leading-snug">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Primary({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
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
