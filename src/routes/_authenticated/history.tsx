import { createFileRoute } from "@tanstack/react-router";
import { History as HistoryIcon, Search, SlidersHorizontal } from "lucide-react";

import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { closedCatches } from "@/data/sample-catches";
import { formatCurrency, formatDate, formatPercent, formatQuantity } from "@/lib/format";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historie — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Archiv aller Catches des Kundelfingerhofs mit Suche und Filtern nach Zeitraum, Frische, Produkt, Lieferant, Standort und Status.",
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

const filters = ["Zeitraum", "Frisch / TK", "Produkt", "Lieferant", "Standort", "Status"];

function HistoryPage() {
  const rows = closedCatches;

  return (
    <>
      <PageHeader
        title="Historie"
        description="Abgeschlossene und abgebrochene Catches im Überblick."
      />

      <Card className="py-0">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Catch-Nummer oder Produkt suchen"
              className="pl-8"
              aria-label="Historie durchsuchen"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
              <Button key={filter} variant="outline" size="sm" disabled className="gap-1.5">
                <SlidersHorizontal className="size-3.5" />
                {filter}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="Noch keine Catches in der Historie"
          description="Sobald ein Catch abgeschlossen oder abgebrochen wurde, erscheint er hier."
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catch</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Art</TableHead>
                    <TableHead>Standort</TableHead>
                    <TableHead>Verfügbar ab</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead className="text-right">Catch-Preis</TableHead>
                    <TableHead className="text-right">Abverkauf</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.catchNumber}</TableCell>
                      <TableCell className="font-medium">{row.productName}</TableCell>
                      <TableCell>
                        <TemperatureBadge temperature={row.temperature} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.location}</TableCell>
                      <TableCell>{formatDate(row.availableFrom)}</TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(row.purchaseQuantity, row.quantityUnit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.catchPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(row.expectedSellThrough)}
                      </TableCell>
                      <TableCell>
                        <CatchStatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Beispieldaten. Suche und Filter werden in einem späteren Schritt aktiviert.
      </p>
    </>
  );
}
