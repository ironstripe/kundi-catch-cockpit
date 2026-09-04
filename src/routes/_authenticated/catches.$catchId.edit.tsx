import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { CatchForm } from "@/components/catch/catch-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { catchDetailToForm, fetchCatch } from "@/lib/catches";

export const Route = createFileRoute("/_authenticated/catches/$catchId/edit")({
  head: () => ({
    meta: [
      { title: "Catch bearbeiten — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Bestehenden Catch bearbeiten: Angaben ergänzen, Produktbild ersetzen und Status auf Bereit setzen.",
      },
      { property: "og:title", content: "Catch bearbeiten — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Bearbeitungsmaske für einen bestehenden Kundi Catch.",
      },
    ],
  }),
  component: EditCatchPage,
});

function EditCatchPage() {
  const { catchId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["catch", catchId], queryFn: () => fetchCatch(catchId) });

  if (query.isLoading) return <Skeleton className="h-64 w-full" />;

  const item = query.data;
  if (!item) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Catch nicht gefunden</CardTitle>
          <CardDescription className="text-xs">
            Dieser Catch existiert nicht oder wurde gelöscht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft />
              Zurück zum Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={`${item.catch_number ?? "Catch"} bearbeiten`}
        description={item.product_name}
      />
      {item.status === "published" ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Dieser Catch wurde bereits publiziert. Änderungen im Cockpit aktualisieren den
            WhatsApp-Post nicht automatisch.
          </span>
        </div>
      ) : null}

      <CatchForm
        mode="edit"
        catchId={catchId}
        initialValues={catchDetailToForm(item)}
        initialImagePath={item.image_path}
        currentStatus={item.status}
        onSaved={(id) => {
          void queryClient.invalidateQueries({ queryKey: ["catch", id] });
          void queryClient.invalidateQueries({ queryKey: ["catches"] });
          void navigate({ to: "/catches/$catchId", params: { catchId: id } });
        }}
      />
    </>
  );
}
