import { Link } from "@tanstack/react-router";
import { Fish, MapPin, CalendarDays } from "lucide-react";

import { DecisionBadge } from "@/components/catch/decision-badge";
import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSignedImage } from "@/hooks/use-signed-image";
import { calculateCatch } from "@/lib/catch-calculation";
import { catchToCalculationInput, type CatchListItem } from "@/lib/catches";
import {
  formatCurrency,
  formatDateTime,
  formatPercentValue,
  formatQuantity,
} from "@/lib/format";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function CatchCard({ item }: { item: CatchListItem }) {
  const image = useSignedImage(item.image_path);
  const calculation = calculateCatch(catchToCalculationInput(item));
  const v = calculation.values;

  return (
    <Card className="overflow-hidden py-0 transition-colors hover:border-ring/50">
      <Link
        to="/catches/$catchId"
        params={{ catchId: item.id }}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="h-28 w-full shrink-0 overflow-hidden rounded-md border bg-muted/40 sm:h-24 sm:w-32">
            {image.data ? (
              <img
                src={image.data}
                alt={`Produktbild von ${item.product_name}`}
                className="size-full object-cover"
              />
            ) : (
              <div
                className="flex size-full items-center justify-center placeholder-hatch"
                role="img"
                aria-label="Kein Produktbild hinterlegt"
              >
                <Fish className="size-6 text-muted-foreground/60" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{item.catch_number}</p>
                <h3 className="truncate text-base font-semibold">{item.product_name}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <TemperatureBadge temperature={item.temperature} />
                <CatchStatusBadge status={item.status} />
                <DecisionBadge level={calculation.level} label={calculation.label} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {item.location_names.length > 0 ? item.location_names.join(", ") : "Kein Standort"}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {item.available_from ? `ab ${formatDateTime(item.available_from)}` : "Kein Datum"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3 xl:grid-cols-5">
              <Field
                label="Einkaufsmenge"
                value={
                  item.purchase_quantity
                    ? formatQuantity(item.purchase_quantity, item.quantity_unit)
                    : "—"
                }
              />
              <Field
                label="Catch-Preis"
                value={
                  item.catch_price === null
                    ? "—"
                    : `${formatCurrency(item.catch_price)} / ${item.quantity_unit}`
                }
              />
              <Field
                label="Maximaler DB"
                value={v ? formatCurrency(v.maximum_contribution_margin) : "—"}
              />
              <Field
                label="Rohmarge"
                value={
                  v?.gross_margin_percentage !== null && v?.gross_margin_percentage !== undefined
                    ? formatPercentValue(v.gross_margin_percentage)
                    : "—"
                }
              />
              <Field
                label="Break-even-Abverkauf"
                value={
                  v?.break_even_sell_through !== null && v?.break_even_sell_through !== undefined
                    ? formatPercentValue(v.break_even_sell_through)
                    : "—"
                }
              />
            </dl>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
