import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, MinusCircle, HelpCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BreakEvenResult, ReconciliationResult } from "@/lib/catch-reconciliation";
import { formatDuration } from "@/lib/catch-reconciliation";
import { formatCurrency, formatPercentValue, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

const HELP: Record<string, string> = {
  "Effektiver DB":
    "Der effektive DB stellt den Umsatz der verkauften Menge dem gesamten Einkauf der Partie gegenüber. Noch vorhandener Warenwert wird separat ausgewiesen.",
  "Verbleibender Warenwert":
    "Der Wert der Restmenge zum Einkaufspreis. Er zählt nicht als Umsatz und wird dem effektiven DB nicht hinzugerechnet.",
  Abverkaufsquote: "Anteil der Einkaufsmenge, der effektiv verkauft wurde.",
  Aktionsdauer: "Zeit zwischen der Publikation und der Bestandszählung.",
};

const BREAK_EVEN_ICONS: Record<BreakEvenResult, typeof CheckCircle2> = {
  reached: CheckCircle2,
  borderline: MinusCircle,
  missed: AlertTriangle,
  unknown: HelpCircle,
};

const BREAK_EVEN_CLASSES: Record<BreakEvenResult, string> = {
  reached: "border-success/40 bg-success/10 text-success",
  borderline: "border-warning/50 bg-warning/10 text-warning-foreground",
  missed: "border-destructive/40 bg-destructive/10 text-destructive",
  unknown: "border-border bg-muted/30 text-muted-foreground",
};

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const help = HELP[label];
  return (
    <div className="space-y-0.5">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
        {help ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={`Erklärung zu ${label}`}>
                  <HelpCircle className="size-3 text-muted-foreground/70" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{help}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </dt>
      <dd className={cn("text-sm font-medium", strong && "text-base font-semibold")}>{value}</dd>
    </div>
  );
}

interface Props {
  result: ReconciliationResult;
  title?: string;
  description?: string;
  footer?: ReactNode;
}

/** Live-Vorschau und fixiertes Ergebnis der Nachkalkulation. */
export function ReconciliationCard({
  result,
  title = "Nachkalkulation",
  description,
  footer,
}: Props) {
  const v = result.values;
  const planned = result.planned;
  const Icon = BREAK_EVEN_ICONS[result.break_even];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-xs">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!v ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
            {result.errors.length > 0
              ? result.errors.join(" ")
              : result.missing.length > 0
                ? `Für die Nachkalkulation fehlen noch Angaben: ${result.missing.join(", ")}.`
                : "Effektive Restmenge erfassen, um das Ergebnis zu berechnen."}
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric
                label="Verkaufte Menge"
                value={formatQuantity(v.sold_quantity, v.quantity_unit)}
                strong
              />
              <Metric
                label="Abverkaufsquote"
                value={
                  v.sell_through_percentage === null
                    ? "—"
                    : formatPercentValue(v.sell_through_percentage)
                }
                strong
              />
              <Metric label="Effektiver Umsatz" value={formatCurrency(v.effective_revenue)} />
              <Metric label="Gesamter Wareneinsatz" value={formatCurrency(v.total_investment)} />
              <Metric
                label="Effektiver DB"
                value={formatCurrency(v.effective_contribution_margin)}
                strong
              />
              <Metric
                label="Verbleibender Warenwert"
                value={formatCurrency(v.remaining_inventory_value)}
              />
              <Metric
                label="Aktionsdauer"
                value={
                  v.action_duration_ms === null
                    ? "Publikationszeitpunkt fehlt"
                    : formatDuration(v.action_duration_ms)
                }
              />
            </dl>

            <p className="text-xs text-muted-foreground">
              Der effektive DB stellt den Umsatz der verkauften Menge dem gesamten Einkauf der
              Partie gegenüber. Noch vorhandener Warenwert wird separat ausgewiesen.
            </p>

            <div
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                BREAK_EVEN_CLASSES[result.break_even],
              )}
            >
              <Icon className="size-4" />
              <span className="font-medium">{result.break_even_label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {v.sell_through_percentage === null
                  ? "—"
                  : `Abverkauf ${formatPercentValue(v.sell_through_percentage)}`}
                {v.break_even_sell_through === null
                  ? ""
                  : ` · Break-even ${formatPercentValue(v.break_even_sell_through)}`}
              </span>
            </div>

            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Kennzahl</th>
                    <th className="px-3 py-2 text-right font-medium">Geplant</th>
                    <th className="px-3 py-2 text-right font-medium">Effektiv</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    label="Menge"
                    planned={formatQuantity(v.purchase_quantity, v.quantity_unit)}
                    actual={formatQuantity(v.sold_quantity, v.quantity_unit)}
                  />
                  <ComparisonRow
                    label="Umsatz"
                    planned={planned ? formatCurrency(planned.maximum_revenue) : "—"}
                    actual={formatCurrency(v.effective_revenue)}
                  />
                  <ComparisonRow
                    label="Deckungsbeitrag"
                    planned={
                      planned ? formatCurrency(planned.maximum_contribution_margin) : "—"
                    }
                    actual={formatCurrency(v.effective_contribution_margin)}
                  />
                  <ComparisonRow
                    label="Abverkauf"
                    planned="100.0 %"
                    actual={
                      v.sell_through_percentage === null
                        ? "—"
                        : formatPercentValue(v.sell_through_percentage)
                    }
                  />
                  <ComparisonRow
                    label="Break-even-Abverkauf"
                    planned={
                      v.break_even_sell_through === null
                        ? "—"
                        : formatPercentValue(v.break_even_sell_through)
                    }
                    actual={
                      v.sell_through_percentage === null
                        ? "—"
                        : formatPercentValue(v.sell_through_percentage)
                    }
                  />
                </tbody>
              </table>
            </div>
          </>
        )}
        {footer ? <div className="flex flex-wrap gap-2 pt-1">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function ComparisonRow({
  label,
  planned,
  actual,
}: {
  label: string;
  planned: string;
  actual: string;
}) {
  return (
    <tr className="border-t">
      <td className="px-3 py-1.5 text-xs text-muted-foreground">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{planned}</td>
      <td className="px-3 py-1.5 text-right font-medium tabular-nums">{actual}</td>
    </tr>
  );
}
