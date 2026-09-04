import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Fish, Percent, PlusCircle, TrendingUp } from "lucide-react";

import { CatchCard } from "@/components/catch/catch-card";
import { KpiCard } from "@/components/catch/kpi-card";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader, PageSection } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { closedCatches, runningCatches } from "@/data/sample-catches";

export const Route = createFileRoute("/")({
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

const kpis = [
  {
    label: "Aktive Catches",
    value: "3",
    hint: "Entwurf, Bereit und Publiziert",
    icon: Fish,
  },
  {
    label: "Geplante Einkaufsmenge",
    value: "120 kg",
    hint: "Summe offener Catches",
    icon: Boxes,
  },
  {
    label: "Erwarteter Deckungsbeitrag",
    value: "CHF 1'240.00",
    hint: "Nach Beschaffung und Lieferkosten",
    icon: TrendingUp,
  },
  {
    label: "Durchschnittlicher Abverkauf",
    value: "78 %",
    hint: "Letzte 10 abgeschlossene Catches",
    icon: Percent,
  },
];

function DashboardPage() {
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
        description="Beispielinhalte — die Anbindung an die Datenbank folgt."
      >
        {runningCatches.length === 0 ? (
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
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {closedCatches.map((item) => (
            <CatchCard key={item.id} item={item} />
          ))}
        </div>
      </PageSection>
    </>
  );
}
