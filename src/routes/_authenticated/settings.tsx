import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { AuditSection } from "@/components/settings/audit-section";
import { BrandSection } from "@/components/settings/brand-section";
import { ExportSection } from "@/components/settings/export-section";
import { CategoriesSection } from "@/components/settings/categories-section";
import { LocationsSection } from "@/components/settings/locations-section";
import { SuppliersSection } from "@/components/settings/suppliers-section";
import { TemplateSection } from "@/components/settings/template-section";
import { ThresholdsSection } from "@/components/settings/thresholds-section";
import { UsersSection } from "@/components/settings/users-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Einstellungen — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Stammdaten für Kundi Catch: Standorte, Lieferanten, Kategorien, Nutzer und Rollen, Kalkulationsregeln, WhatsApp-Textvorlage und Markenasset.",
      },
      { property: "og:title", content: "Einstellungen — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Stammdaten, Rollen und Vorlagen für das Kundi Catch Cockpit verwalten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, canEdit } = useRoles();

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Stammdaten, Kalkulationsregeln, Vorlagen und Zugriffsrechte für Kundi Catch."
      />

      <Tabs defaultValue="master-data" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="master-data">Stammdaten</TabsTrigger>
          <TabsTrigger value="calculation">Kalkulation</TabsTrigger>
          <TabsTrigger value="template">WhatsApp-Vorlage</TabsTrigger>
          {isAdmin ? <TabsTrigger value="users">Nutzer und Rollen</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="brand">Marke</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="export">Datenexport und Backup</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="audit">Änderungsprotokoll</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="master-data" className="space-y-4">
          {!canEdit ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Als Viewer siehst du die Stammdaten nur lesend.
            </p>
          ) : null}
          <SuppliersSection />
          <LocationsSection />
          <CategoriesSection />
        </TabsContent>

        <TabsContent value="calculation">
          <ThresholdsSection />
        </TabsContent>

        <TabsContent value="template">
          <TemplateSection />
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="users">
            <UsersSection />
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="brand">
            <BrandSection />
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="export">
            <ExportSection />
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="audit">
            <AuditSection />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}
