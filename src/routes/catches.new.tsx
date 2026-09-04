import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Fish,
  Image as ImageIcon,
  Truck,
  Tags,
  Megaphone,
  BookOpen,
  MessageCircle,
  Save,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/catches/new")({
  head: () => ({
    meta: [
      { title: "Neuer Catch — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Struktur zur Erfassung eines neuen Catches: Produkt, Bild, Beschaffung, Preis und Menge, Aktion, Handicap-Story und WhatsApp-Post.",
      },
      { property: "og:title", content: "Neuer Catch — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Erfassungsmaske für einen neuen Catch des Kundelfingerhofs.",
      },
    ],
  }),
  component: NewCatchPage,
});

const sections: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Produkt",
    description: "Produktname, Kategorie, Beschreibung, Verpackung und Haltbarkeit.",
    icon: Fish,
  },
  {
    title: "Bild",
    description: "Produktbild hochladen, zuschneiden und als Hauptbild festlegen.",
    icon: ImageIcon,
  },
  {
    title: "Beschaffung",
    description: "Lieferant, Standorte, Verfügbarkeitsfenster und Lieferkosten.",
    icon: Truck,
  },
  {
    title: "Preis und Menge",
    description: "Einkaufsmenge, Einheit, Einkaufspreis, Normalpreis und Catch-Preis.",
    icon: Tags,
  },
  {
    title: "Aktion",
    description: "Aktionsrahmen, Abholhinweise und interne Notizen.",
    icon: Megaphone,
  },
  {
    title: "Handicap-Story",
    description: "Warum ist dieser Fisch ein Catch? Ehrliche Begründung für die Kundschaft.",
    icon: BookOpen,
  },
  {
    title: "WhatsApp-Post",
    description: "Vorbereiteter Textentwurf zur manuellen Publikation über WhatsApp Desktop.",
    icon: MessageCircle,
  },
];

function NewCatchPage() {
  return (
    <>
      <PageHeader
        title="Neuer Catch"
        description="Schnell sein. Gut essen. Food Waste vermeiden."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/">Abbrechen</Link>
            </Button>
            <Button disabled>
              <Save />
              Als Entwurf speichern
            </Button>
          </>
        }
      />

      <p className="text-sm text-muted-foreground">
        Diese Maske zeigt die geplante Struktur. Eingabefelder und Berechnungen folgen im
        nächsten Schritt.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sections.map((section, index) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <section.icon className="size-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-sm">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </CardTitle>
                  <CardDescription className="text-xs">{section.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex h-20 items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground placeholder-hatch">
                Formularfelder folgen
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
