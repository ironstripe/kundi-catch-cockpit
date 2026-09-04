import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CatchForm } from "@/components/catch/catch-form";
import { PageHeader } from "@/components/layout/page-header";
import { EMPTY_CATCH_FORM } from "@/lib/catches";

export const Route = createFileRoute("/_authenticated/catches/new")({
  head: () => ({
    meta: [
      { title: "Neuer Catch — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Neuen Catch erfassen: Produkt, Produktbild, Beschaffung, Verkaufspreis, Aktion und Handicap-Story.",
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

function NewCatchPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Neuer Catch"
        description="Schnell sein. Gut essen. Food Waste vermeiden."
      />
      <CatchForm
        mode="create"
        initialValues={EMPTY_CATCH_FORM}
        initialImagePath={null}
        onSaved={(catchId) => void navigate({ to: "/catches/$catchId", params: { catchId } })}
      />
    </>
  );
}
