import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Fish, Percent, PlusCircle, TrendingUp } from "lucide-react";

import { CatchCard } from "@/components/catch/catch-card";
import { KpiCard } from "@/components/catch/kpi-card";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader, PageSection } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { aggregateCatches } from "@/lib/catch-calculation";
import { catchToCalculationInput, fetchClosedCatches, fetchRunningCatches } from "@/lib/catches";
import { formatCurrency, formatPercentValue, formatQuantity } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Übersicht über laufende und abgeschlossene Catches des Kundelfingerhofs: Mengen, Preise und Abverkauf auf einen Blick.",
      },
      { property: "og:title", content: "Dashboard — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Laufende Catches, Kennzahlen und Abverkauf des Kundelfingerhofs.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const running = useQuery({ queryKey: ["catches", "running"], queryFn: fetchRunningCatches });
  const closed = useQuery({ queryKey: ["catches", "closed"], queryFn: fetchClosedCatches });
  const runningCatches = running.data ?? [];
  const closedCatches = closed.data ?? [];

  const totals = aggregateCatches(runningCatches.map(catchToCalculationInput));
  const quantityText =
    totals.quantity_by_unit.length === 0
      ? "—"
      : totals.quantity_by_unit
          .map((entry) => formatQuantity(entry.quantity, entry.unit))
          .join(" · ");

  const kpis = [
    {
      label: "Aktive Catches",
      value: String(runningCatches.length),
      hint: "Entwurf, Bereit und Publiziert",
      icon: Fish,
    },
    {
      label: "Geplante Einkaufsmenge",
      value: quantityText,
      hint:
        totals.quantity_by_unit.length > 1
          ? "Getrennt je Einheit ausgewiesen"
          : "Summe aktiver Catches",
      icon: Boxes,
    },
    {
      label: "Erwarteter Deckungsbeitrag",
      value: formatCurrency(totals.contribution_margin),
      hint: "Maximaler DB der aktiven Catches",
      icon: TrendingUp,
    },
    {
      label: "Durchschnittliche geplante Rohmarge",
      value:
        totals.weighted_margin === null ? "—" : formatPercentValue(totals.weighted_margin),
      hint: "Gewichtet über den maximalen Umsatz",
      icon: Percent,
    },
  ];


  return (
    <>
      <PageHeader
        title="Kundi Catch Cockpit"
        description="Guter Fisch. Kleines Handicap. Grosser Fang."
        actions={
          <Button asChild>
            <Link to="/catches/new">
              <PlusCircle />
              Neuer Catch
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <PageSection
        title="Laufende Catches"
        description="Status Entwurf, Bereit und Publiziert."
      >
        {running.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : runningCatches.length === 0 ? (
          <EmptyState
            icon={Fish}
            title="Keine laufenden Catches"
            description="Sobald ein Catch geplant ist, erscheint er hier."
            action={
              <Button asChild size="sm">
                <Link to="/catches/new">Neuer Catch</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {runningCatches.map((item) => (
              <CatchCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </PageSection>

      <PageSection
        title="Letzte abgeschlossene Catches"
        description="Grundlage für spätere Auswertungen und Learnings."
      >
        {closed.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : closedCatches.length === 0 ? (
          <EmptyState
            icon={Fish}
            title="Noch keine abgeschlossenen Catches"
            description="Abgeschlossene und abgebrochene Catches erscheinen hier."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {closedCatches.map((item) => (
              <CatchCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </PageSection>
    </>
  );
}
