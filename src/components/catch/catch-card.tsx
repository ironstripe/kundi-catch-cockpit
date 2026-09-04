import { Fish, MapPin, CalendarDays } from "lucide-react";

import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatPercent, formatQuantity } from "@/lib/format";
import type { SampleCatch } from "@/data/sample-catches";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function CatchCard({ item }: { item: SampleCatch }) {
  return (
    <Card className="overflow-hidden py-0 transition-colors hover:border-ring/50">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
        {/* Produktbild-Platzhalter — Bildverwaltung folgt in einem späteren Schritt */}
        <div
          className="flex h-28 w-full shrink-0 items-center justify-center rounded-md border bg-muted/40 placeholder-hatch sm:h-24 sm:w-32"
          role="img"
          aria-label="Produktbild-Platzhalter"
        >
          <Fish className="size-6 text-muted-foreground/60" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{item.catchNumber}</p>
              <h3 className="truncate text-base font-semibold">{item.productName}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <TemperatureBadge temperature={item.temperature} />
              <CatchStatusBadge status={item.status} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {item.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" /> ab {formatDate(item.availableFrom)}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3">
            <Field
              label="Einkaufsmenge"
              value={formatQuantity(item.purchaseQuantity, item.quantityUnit)}
            />
            <Field label="Catch-Preis" value={`${formatCurrency(item.catchPrice)} / ${item.quantityUnit}`} />
            <Field label="Erw. Abverkauf" value={formatPercent(item.expectedSellThrough)} />
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
