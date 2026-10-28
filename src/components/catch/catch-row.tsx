import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { Button } from "@/components/ui/button";
import { calculateCatch } from "@/lib/catch-calculation";
import { catchToCalculationInput, type CatchListItem } from "@/lib/catches";
import { formatCurrency, formatPercentValue, formatQuantity } from "@/lib/format";
import { netCost, resolveVatRate, DEFAULT_PURCHASE_VAT_RATE } from "@/lib/vat";

export function CatchRow({ item }: { item: CatchListItem }) {
  const navigate = useNavigate();
  const v = calculateCatch(catchToCalculationInput(item)).values;
  const ek =
    item.purchase_price === null
      ? null
      : netCost(
          item.purchase_price,
          item.purchase_price_includes_vat,
          resolveVatRate(item.purchase_vat_rate, DEFAULT_PURCHASE_VAT_RATE),
        );
  return (
    <div
      className="grid cursor-pointer grid-cols-2 items-start gap-x-4 gap-y-2 border-b py-3 transition-colors hover:bg-accent/40 focus-within:bg-accent/40 lg:grid-cols-[minmax(0,2fr)_minmax(0,.8fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1fr)_5rem] lg:items-center"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button,summary,details")) return;
        void navigate({ to: "/catches/$catchId", params: { catchId: item.id } });
      }}
    >
      <div className="col-span-2 min-w-0 space-y-1 lg:col-span-1">
        <Link
          to="/catches/$catchId"
          params={{ catchId: item.id }}
          className="block break-words text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.product_name}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{item.catch_number}</span>
          <CatchStatusBadge status={item.status} />
          <TemperatureBadge temperature={item.temperature} />
        </div>
      </div>
      <Value
        label="Einkaufsmenge"
        value={
          item.purchase_quantity > 0
            ? formatQuantity(item.purchase_quantity, item.quantity_unit)
            : "—"
        }
      />
      <Value
        label="EK netto"
        value={ek === null ? "—" : `${formatCurrency(ek)} / ${item.quantity_unit}`}
      />
      <Value
        label="VP inkl. MWST"
        value={
          item.catch_price === null
            ? "—"
            : `${formatCurrency(item.catch_price)} / ${item.quantity_unit}`
        }
      />
      <div className="text-sm lg:text-right">
        <p>
          <span className="text-xs text-muted-foreground">DB I </span>
          {v ? formatCurrency(v.db_i) : "—"}
        </p>
        <p>
          <span className="text-xs text-muted-foreground">DB II </span>
          {v?.db_ii === null || v?.db_ii === undefined ? "—" : formatCurrency(v.db_ii)}
        </p>
        <details
          onClick={(event) => event.stopPropagation()}
          className="text-xs text-muted-foreground"
        >
          <summary className="min-h-11 cursor-pointer content-center lg:min-h-9">
            Details netto
          </summary>
          <p>Maximal bei vollständigem Abverkauf</p>
          <p>
            DB-I-Marge:{" "}
            {v?.gross_margin_percentage == null
              ? "—"
              : formatPercentValue(v.gross_margin_percentage)}
          </p>
          <p>
            DB-II-Marge:{" "}
            {v?.db_ii_margin_percentage == null
              ? "—"
              : formatPercentValue(v.db_ii_margin_percentage)}
          </p>
          {v?.db_ii == null ? (
            <p>Interner Aufwand nicht erfasst oder Kalkulation unvollständig.</p>
          ) : null}
        </details>
      </div>
      <Button asChild size="sm" variant="ghost" className="justify-self-end">
        <Link to="/catches/$catchId" params={{ catchId: item.id }} hash="publikation">
          Post
          <ChevronRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-sm lg:text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words font-medium">{value}</p>
    </div>
  );
}
