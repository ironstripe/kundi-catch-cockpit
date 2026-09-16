import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CatchForm } from "@/components/catch/catch-form";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAppSettings } from "@/lib/app-settings";
import { EMPTY_CATCH_FORM, withInternalHandlingDefault } from "@/lib/catches";

export const Route = createFileRoute("/_authenticated/catches/new")({
  head: () => ({
    meta: [
      { title: "Neuer Catch — Food Catch Cockpit" },
      {
        name: "description",
        content:
          "Neuen Catch erfassen: Produkt, Produktbild, Beschaffung, Verkaufspreis, Aktion und Handicap-Story.",
      },
      { property: "og:title", content: "Neuer Catch — Food Catch Cockpit" },
      {
        property: "og:description",
        content: "Erfassungsmaske für einen neuen Catch des Kundelfingerhofs.",
      },
    ],
  }),
  component: NewCatchPage,
});

function NewCatchPage() {
  const navigate = useNavigate();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });

  return (
    <>
      <PageHeader
        title="Neuer Catch"
        description="Produkt, Bild, Beschaffung und Aktionsrahmen erfassen."
      />
      {/* Erst nach dem Laden der Einstellungen rendern, damit der Standardwert
          keine bereits erfasste Eingabe überschreibt. */}
      {settings.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <CatchForm
          mode="create"
          initialValues={withInternalHandlingDefault(
            EMPTY_CATCH_FORM,
            settings.data?.calculation_defaults.internal_handling_cost_per_unit ?? null,
          )}
          initialImagePath={null}
          onSaved={(catchId, savedStatus) =>
            void navigate({
              to: "/catches/$catchId",
              params: { catchId },
              ...(savedStatus === "ready" ? { hash: "publikation" } : {}),
            })
          }
        />
      )}
    </>
  );
}
