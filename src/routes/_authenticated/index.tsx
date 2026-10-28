import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Fish, Percent, PlusCircle, TrendingUp, Wallet } from "lucide-react";

import { CatchCard } from "@/components/catch/catch-card";
import { CatchRow } from "@/components/catch/catch-row";
import { MountedDisclosure } from "@/components/layout/mounted-disclosure";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader, PageSection } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { aggregateCatches } from "@/lib/catch-calculation";
import { aggregateReconciliations } from "@/lib/catch-reconciliation";
import {
  catchToCalculationInput,
  catchToReconciliationInput,
  fetchClosedCatches,
  fetchHistoryCatches,
  fetchRunningCatches,
} from "@/lib/catches";
import { formatCurrency, formatPercentValue, formatQuantity } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Food Catch Cockpit" },
      {
        name: "description",
        content:
          "Übersicht über laufende und abgeschlossene Catches des Kundelfingerhofs: Mengen, Preise und Abverkauf auf einen Blick.",
      },
      { property: "og:title", content: "Dashboard — Food Catch Cockpit" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const closed = useQuery({
    queryKey: ["catches", "closed"],
    queryFn: () => fetchClosedCatches(5),
  });
  const runningCatches = running.data ?? [];
  const closedCatches = closed.data ?? [];
  const history = useQuery({ queryKey: ["history"], queryFn: fetchHistoryCatches });
  const historyTotals = aggregateReconciliations(
    (history.data ?? []).filter((item) => item.status === "closed").map(catchToReconciliationInput),
  );
  const sellThroughText =
    historyTotals.by_unit.length === 0
      ? "—"
      : historyTotals.by_unit
          .map((entry) =>
            entry.sell_through === null
              ? `— ${entry.unit}`
              : `${formatPercentValue(entry.sell_through)} (${entry.unit})`,
          )
          .join(" · ");

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
      label: "Durchschnittlicher Abverkauf",
      value: sellThroughText,
      hint:
        historyTotals.by_unit.length > 1
          ? "Getrennt je Einheit ausgewiesen"
          : "Abgeschlossene Catches, gewichtet",
      icon: Percent,
    },
    {
      label: "Effektiver Gesamt-DB",
      value: formatCurrency(historyTotals.contribution_margin),
      hint: "Alle abgeschlossenen Catches",
      icon: Wallet,
    },
  ];

  return (
    <>
      <PageHeader
        title="Food Catch Cockpit"
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

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          <strong>{runningCatches.length}</strong> aktive Catches
        </span>
        <span>
          Einkaufsmenge: <strong>{quantityText}</strong>
        </span>
        <span>
          Maximaler DB I: <strong>{formatCurrency(totals.contribution_margin)}</strong>
        </span>
      </div>

      <PageSection title="Laufende Catches" description="Status Entwurf, Bereit und Publiziert.">
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
          <div className="border-t">
            {runningCatches.map((item) => (
              <CatchRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </PageSection>

      <MountedDisclosure title="Gesamtkennzahlen" summary="Planung und abgeschlossene Catches">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <div key={kpi.label}>
              <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
              <dd className="text-base font-semibold">{kpi.value}</dd>
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </div>
          ))}
        </dl>
      </MountedDisclosure>

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
