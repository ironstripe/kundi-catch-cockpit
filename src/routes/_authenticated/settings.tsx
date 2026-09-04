import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Truck, Tags, Users, MessageSquareText, ImageIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KundiCatchLogo } from "@/components/brand/kundi-catch-logo";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Einstellungen — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Stammdaten für Kundi Catch: Standorte, Lieferanten, Kategorien, Nutzer und Rollen, WhatsApp-Textvorlage und Markenasset.",
      },
      { property: "og:title", content: "Einstellungen — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Stammdaten und Vorlagen für das Kundi Catch Cockpit verwalten.",
      },
    ],
  }),
  component: SettingsPage,
});

const sections: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Standorte",
    description: "Abholorte mit Adresse, Abholhinweis und Aktiv-Status.",
    icon: MapPin,
  },
  {
    title: "Lieferanten",
    description: "Lieferanten mit Kontaktnotiz und Aktiv-Status.",
    icon: Truck,
  },
  {
    title: "Kategorien",
    description: "Produktkategorien für Catches und Auswertungen.",
    icon: Tags,
  },
  {
    title: "Nutzer und Rollen",
    description: "Zugriff für Mitarbeitende der Kundelfingerhof AG.",
    icon: Users,
  },
  {
    title: "WhatsApp-Textvorlage",
    description: "Grundgerüst für den Post-Text inklusive Platzhaltern.",
    icon: MessageSquareText,
  },
];

function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Stammdaten und Vorlagen für Kundi Catch."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <section.icon className="size-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                  <CardDescription className="text-xs">{section.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex h-16 items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground placeholder-hatch">
                Verwaltung folgt
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <ImageIcon className="size-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-sm">Markenasset</CardTitle>
                <CardDescription className="text-xs">
                  Offizielles Kundi-Catch-Logo für Posts und Bildvorlagen.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 rounded-md border bg-card p-3">
              <KundiCatchLogo className="size-20" />
              <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                <p className="text-sm font-medium text-foreground">Kundi Catch Logo</p>
                <p>Guter Fisch. Kleines Handicap. Grosser Fang.</p>
                <p>Schnell sein. Gut essen. Food Waste vermeiden.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Logo ersetzen
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
