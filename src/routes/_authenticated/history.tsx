import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Boxes,
  Clock,
  Fish,
  History as HistoryIcon,
  Percent,
  RotateCcw,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";

import { KpiCard } from "@/components/catch/kpi-card";
import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSignedImage } from "@/hooks/use-signed-image";
import { CATCH_STATUS_LABELS } from "@/lib/catch-domain";
import {
  aggregateReconciliations,
  durationMs,
  formatDuration,
  reconcileCatch,
} from "@/lib/catch-reconciliation";
import { catchToReconciliationInput, fetchHistoryCatches, type CatchListItem } from "@/lib/catches";
import { formatCurrency, formatDateTime, formatPercentValue, formatQuantity } from "@/lib/format";

const ALL = "alle";

interface HistorySearch {
  q?: string;
  period?: string;
  temperature?: string;
  product?: string;
  supplier?: string;
  location?: string;
  status?: string;
}

export const Route = createFileRoute("/_authenticated/history")({
  validateSearch: (search: Record<string, unknown>): HistorySearch => {
    const keys: (keyof HistorySearch)[] = [
      "q",
      "period",
      "temperature",
      "product",
      "supplier",
      "location",
      "status",
    ];
    const result: HistorySearch = {};
    for (const key of keys) {
      const value = search[key];
      if (typeof value === "string" && value) result[key] = value;
    }
    return result;
  },
  head: () => ({
    meta: [
      { title: "Historie — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Archiv aller abgeschlossenen und abgebrochenen Catches mit Suche, Filtern und Ergebniskennzahlen.",
      },
      { property: "og:title", content: "Historie — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Alle vergangenen Catches durchsuchen und auswerten.",
      },
    ],
  }),
  component: HistoryPage,
});

const PERIODS: { value: string; label: string; days: number | null }[] = [
  { value: ALL, label: "Alle Zeiträume", days: null },
  { value: "30", label: "Letzte 30 Tage", days: 30 },
  { value: "90", label: "Letzte 90 Tage", days: 90 },
  { value: "365", label: "Letzte 12 Monate", days: 365 },
];

function completionDate(item: CatchListItem): string | null {
  return item.closed_at ?? item.cancelled_at ?? null;
}

/** Filtert die vollständige Historie clientseitig — Suche gilt für alle Datensätze. */
export function filterHistory(rows: CatchListItem[], search: HistorySearch): CatchListItem[] {
  const term = (search.q ?? "").trim().toLowerCase();
  const period = PERIODS.find((entry) => entry.value === search.period)?.days ?? null;
  const cutoff = period === null ? null : Date.now() - period * 86_400_000;

  return rows.filter((row) => {
    if (search.temperature && search.temperature !== ALL && row.temperature !== search.temperature)
      return false;
    if (search.product && search.product !== ALL && row.product_name !== search.product)
      return false;
    if (search.supplier && search.supplier !== ALL && row.supplier_name !== search.supplier)
      return false;
    if (
      search.location &&
      search.location !== ALL &&
      !row.location_names.includes(search.location)
    )
      return false;
    if (search.status && search.status !== ALL && row.status !== search.status) return false;
    if (cutoff !== null) {
      const date = completionDate(row);
      if (!date || new Date(date).getTime() < cutoff) return false;
    }
    if (term) {
      const haystack = [
        row.catch_number ?? "",
        row.product_name,
        row.supplier_name ?? "",
        row.location_names.join(" "),
        row.learning ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function HistoryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery({ queryKey: ["history"], queryFn: fetchHistoryCatches });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => filterHistory(rows, search), [rows, search]);
  const closedOnly = useMemo(
    () => filtered.filter((row) => row.status === "closed"),
    [filtered],
  );
  const totals = useMemo(
    () => aggregateReconciliations(closedOnly.map(catchToReconciliationInput)),
    [closedOnly],
  );

  const setFilter = (key: keyof HistorySearch, value: string | undefined) => {
    void navigate({
      search: (prev: HistorySearch) => ({
        ...prev,
        [key]: value && value !== ALL ? value : undefined,
      }),
      replace: true,
    });
  };

  const options = useMemo(() => {
    const products = new Set<string>();
    const suppliers = new Set<string>();
    const locations = new Set<string>();
    for (const row of rows) {
      products.add(row.product_name);
      if (row.supplier_name) suppliers.add(row.supplier_name);
      for (const name of row.location_names) locations.add(name);
    }
    return {
      products: [...products].sort(),
      suppliers: [...suppliers].sort(),
      locations: [...locations].sort(),
    };
  }, [rows]);

  const hasFilters = Boolean(
    search.q ||
      search.period ||
      search.temperature ||
      search.product ||
      search.supplier ||
      search.location ||
      search.status,
  );

  const quantityText = (key: "purchase_quantity" | "sold_quantity") =>
    totals.by_unit.length === 0
      ? "—"
      : totals.by_unit.map((entry) => formatQuantity(entry[key], entry.unit)).join(" · ");

  const sellThroughText =
    totals.by_unit.length === 0
      ? "—"
      : totals.by_unit
          .map((entry) =>
            entry.sell_through === null
              ? `— ${entry.unit}`
              : `${formatPercentValue(entry.sell_through)} (${entry.unit})`,
          )
          .join(" · ");

  const kpis = [
    { label: "Anzahl Catches", value: String(filtered.length), hint: "Gefilterte Auswahl", icon: Fish },
    {
      label: "Gesamte Einkaufsmenge",
      value: quantityText("purchase_quantity"),
      hint: totals.by_unit.length > 1 ? "Getrennt je Einheit" : "Abgeschlossene Catches",
      icon: Boxes,
    },
    {
      label: "Gesamte verkaufte Menge",
      value: quantityText("sold_quantity"),
      hint: totals.by_unit.length > 1 ? "Getrennt je Einheit" : "Abgeschlossene Catches",
      icon: Boxes,
    },
    {
      label: "Durchschnittlicher Abverkauf",
      value: sellThroughText,
      hint: "Gewichtet je Einheit",
      icon: Percent,
    },
    {
      label: "Effektiver Gesamtumsatz",
      value: formatCurrency(totals.revenue),
      hint: "Nur abgeschlossene Catches",
      icon: Wallet,
    },
    {
      label: "Effektiver Gesamt-DB",
      value: formatCurrency(totals.contribution_margin),
      hint: "Nur abgeschlossene Catches",
      icon: TrendingUp,
    },
    {
      label: "Durchschnittliche Aktionsdauer",
      value: formatDuration(totals.average_duration_ms),
      hint: "Publikation bis Bestandszählung",
      icon: Clock,
    },
  ];

  return (
    <>
      <PageHeader
        title="Historie"
        description="Abgeschlossene und abgebrochene Catches im Überblick."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <Card className="py-0">
        <CardContent className="space-y-3 p-4">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search.q ?? ""}
              onChange={(event) => setFilter("q", event.target.value)}
              placeholder="Catch-Nummer, Produkt, Lieferant, Standort, Learning"
              className="pl-8"
              aria-label="Historie durchsuchen"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <FilterSelect
              label="Zeitraum"
              value={search.period ?? ALL}
              onChange={(value) => setFilter("period", value)}
              options={PERIODS.map((entry) => ({ value: entry.value, label: entry.label }))}
            />
            <FilterSelect
              label="Frisch / TK"
              value={search.temperature ?? ALL}
              onChange={(value) => setFilter("temperature", value)}
              options={[
                { value: ALL, label: "Alle" },
                { value: "fresh", label: "Frisch" },
                { value: "frozen", label: "TK" },
              ]}
            />
            <FilterSelect
              label="Produkt"
              value={search.product ?? ALL}
              onChange={(value) => setFilter("product", value)}
              options={[
                { value: ALL, label: "Alle Produkte" },
                ...options.products.map((name) => ({ value: name, label: name })),
              ]}
            />
            <FilterSelect
              label="Lieferant"
              value={search.supplier ?? ALL}
              onChange={(value) => setFilter("supplier", value)}
              options={[
                { value: ALL, label: "Alle Lieferanten" },
                ...options.suppliers.map((name) => ({ value: name, label: name })),
              ]}
            />
            <FilterSelect
              label="Standort"
              value={search.location ?? ALL}
              onChange={(value) => setFilter("location", value)}
              options={[
                { value: ALL, label: "Alle Standorte" },
                ...options.locations.map((name) => ({ value: name, label: name })),
              ]}
            />
            <FilterSelect
              label="Status"
              value={search.status ?? ALL}
              onChange={(value) => setFilter("status", value)}
              options={[
                { value: ALL, label: "Alle" },
                { value: "closed", label: CATCH_STATUS_LABELS.closed },
                { value: "cancelled", label: CATCH_STATUS_LABELS.cancelled },
              ]}
            />
          </div>

          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate({ search: {}, replace: true })}
            >
              <RotateCcw />
              Filter zurücksetzen
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {query.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={rows.length === 0 ? "Noch keine Catches in der Historie" : "Keine Treffer"}
          description={
            rows.length === 0
              ? "Sobald ein Catch abgeschlossen oder abgebrochen wurde, erscheint er hier."
              : "Für die aktuelle Auswahl gibt es keine Catches. Filter anpassen oder zurücksetzen."
          }
          action={
            rows.length === 0 ? undefined : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigate({ search: {}, replace: true })}
              >
                Filter zurücksetzen
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden py-0 lg:block">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catch</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Art</TableHead>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Standort</TableHead>
                    <TableHead>Publiziert</TableHead>
                    <TableHead>Dauer</TableHead>
                    <TableHead className="text-right">Einkauf</TableHead>
                    <TableHead className="text-right">Verkauft</TableHead>
                    <TableHead className="text-right">Rest</TableHead>
                    <TableHead className="text-right">Catch-Preis</TableHead>
                    <TableHead className="text-right">Abverkauf</TableHead>
                    <TableHead className="text-right">Umsatz</TableHead>
                    <TableHead className="text-right">Effektiver DB</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <HistoryRow key={row.id} row={row} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
            {filtered.map((row) => (
              <HistoryCard key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function useRowValues(row: CatchListItem) {
  const result = reconcileCatch(catchToReconciliationInput(row));
  const duration = durationMs(row.published_at, row.inventory_counted_at);
  return { v: result.values, duration };
}

function Thumb({ row }: { row: CatchListItem }) {
  const image = useSignedImage(row.image_path);
  return (
    <div className="size-10 shrink-0 overflow-hidden rounded border bg-muted/40">
      {image.data ? (
        <img src={image.data} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center placeholder-hatch">
          <Fish className="size-4 text-muted-foreground/60" />
        </div>
      )}
    </div>
  );
}

function HistoryRow({ row }: { row: CatchListItem }) {
  const { v, duration } = useRowValues(row);
  return (
    <TableRow className="cursor-pointer">
      <TableCell>
        <Link
          to="/catches/$catchId"
          params={{ catchId: row.id }}
          className="flex items-center gap-2 font-mono text-xs"
        >
          <Thumb row={row} />
          {row.catch_number ?? "—"}
        </Link>
      </TableCell>
      <TableCell className="font-medium">
        <Link to="/catches/$catchId" params={{ catchId: row.id }}>
          {row.product_name}
        </Link>
      </TableCell>
      <TableCell>
        <TemperatureBadge temperature={row.temperature} />
      </TableCell>
      <TableCell className="text-muted-foreground">{row.supplier_name ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">
        {row.location_names.length > 0 ? row.location_names.join(", ") : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {row.published_at ? formatDateTime(row.published_at) : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {duration === null ? "—" : formatDuration(duration)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatQuantity(row.purchase_quantity, row.quantity_unit)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {v ? formatQuantity(v.sold_quantity, v.quantity_unit) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.remaining_quantity === null
          ? "—"
          : formatQuantity(row.remaining_quantity, row.quantity_unit)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.catch_price === null ? "—" : formatCurrency(row.catch_price)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {v?.sell_through_percentage != null ? formatPercentValue(v.sell_through_percentage) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {v ? formatCurrency(v.effective_revenue) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {v ? formatCurrency(v.effective_contribution_margin) : "—"}
      </TableCell>
      <TableCell>
        <CatchStatusBadge status={row.status} />
      </TableCell>
    </TableRow>
  );
}

function HistoryCard({ row }: { row: CatchListItem }) {
  const { v, duration } = useRowValues(row);
  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <Link to="/catches/$catchId" params={{ catchId: row.id }} className="block space-y-3">
          <div className="flex items-start gap-3">
            <Thumb row={row} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-muted-foreground">{row.catch_number ?? "—"}</p>
              <p className="truncate font-medium">{row.product_name}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <CatchStatusBadge status={row.status} />
              <TemperatureBadge temperature={row.temperature} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase text-muted-foreground">Verkauft</dt>
              <dd>{v ? formatQuantity(v.sold_quantity, v.quantity_unit) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted-foreground">Abverkauf</dt>
              <dd>
                {v?.sell_through_percentage != null
                  ? formatPercentValue(v.sell_through_percentage)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted-foreground">Effektiver DB</dt>
              <dd>{v ? formatCurrency(v.effective_contribution_margin) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted-foreground">Aktionsdauer</dt>
              <dd>{duration === null ? "—" : formatDuration(duration)}</dd>
            </div>
          </dl>
        </Link>
      </CardContent>
    </Card>
  );
}
