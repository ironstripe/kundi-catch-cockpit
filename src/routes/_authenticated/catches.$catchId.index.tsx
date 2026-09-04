import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Scale } from "lucide-react";
import type { ReactNode } from "react";

import { CalculationCard } from "@/components/catch/calculation-card";
import { PublicationWorkspace } from "@/components/catch/publication-workspace";
import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { PageHeader, PageSection } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedImage } from "@/hooks/use-signed-image";
import {
  HANDICAP_REASON_LABELS,
  QUANTITY_UNIT_LABELS,
  type HandicapReason,
} from "@/lib/catch-domain";
import { calculateCatch } from "@/lib/catch-calculation";
import { catchToCalculationInput, fetchCatch } from "@/lib/catches";
import { formatCurrency, formatDate, formatDateTime, formatQuantity } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/catches/$catchId/")({
  head: () => ({
    meta: [
      { title: "Catch-Detail — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Alle Angaben zu einem Catch: Produkt, Beschaffung, Preise, Standorte, Verfügbarkeit und Handicap-Story.",
      },
      { property: "og:title", content: "Catch-Detail — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Detailansicht eines Kundi Catch mit allen erfassten Angaben.",
      },
    ],
  }),
  component: CatchDetailPage,
});

function CatchDetailPage() {
  const { catchId } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["catch", catchId], queryFn: () => fetchCatch(catchId) });
  const image = useSignedImage(query.data?.image_path);

  if (query.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

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

  const calculation = calculateCatch(catchToCalculationInput(item));

  const deliveryText = item.delivery_included
    ? "Im Einkaufspreis enthalten"
    : formatCurrency(item.delivery_cost);

  return (
    <>
      <PageHeader
        title={item.product_name}
        description={`${item.catch_number ?? "ohne Nummer"} · erstellt am ${formatDateTime(item.created_at)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft />
                Zurück zum Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link to="/catches/$catchId/edit" params={{ catchId }}>
                <Pencil />
                Bearbeiten
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CatchStatusBadge status={item.status} />
        <TemperatureBadge temperature={item.temperature} />
        <span className="font-mono text-xs text-muted-foreground">{item.catch_number}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CalculationCard
            result={calculation}
            description={`Berechnete Werte aus den gespeicherten Eingaben · Stand ${formatDateTime(item.updated_at)}`}
            footer={
              <Button variant="outline" size="sm" asChild>
                <Link to="/catches/$catchId/edit" params={{ catchId }}>
                  <Pencil />
                  Catch bearbeiten
                </Link>
              </Button>
            }
          />

          <Section title="Produkt">
            <Row label="Produktname" value={item.product_name} />
            <Row label="Produktart" value={item.temperature === "frozen" ? "TK" : "Frisch"} />
            <Row label="Beschreibung" value={item.description} />
            <Row label="Verpackung" value={item.packaging} />
            <Row
              label="Mindesthaltbarkeitsdatum"
              value={item.expiry_date ? formatDate(item.expiry_date) : null}
            />
          </Section>

          <Section title="Beschaffung">
            <Row label="Lieferant" value={item.supplier_name} />
            <Row
              label="Einkaufsmenge"
              value={
                item.purchase_quantity
                  ? formatQuantity(item.purchase_quantity, item.quantity_unit)
                  : null
              }
            />
            <Row label="Einheit" value={QUANTITY_UNIT_LABELS[item.quantity_unit] ?? item.quantity_unit} />
            <Row
              label="Einkaufspreis pro Einheit"
              value={item.purchase_price === null ? null : formatCurrency(item.purchase_price)}
            />
            <Row label="Lieferkosten" value={deliveryText} />
          </Section>

          <Section title="Verkaufspreis">
            <Row
              label="Normalpreis"
              value={item.regular_price === null ? null : formatCurrency(item.regular_price)}
            />
            <Row
              label="Kundi-Catch-Preis"
              value={item.catch_price === null ? null : formatCurrency(item.catch_price)}
            />
          </Section>

          <Section title="Aktion">
            <Row
              label="Abholorte"
              value={item.location_names.length > 0 ? item.location_names.join(", ") : null}
            />
            <Row
              label="Verfügbar ab"
              value={item.available_from ? formatDateTime(item.available_from) : null}
            />
            <Row
              label="Verfügbar bis"
              value={item.available_until ? formatDateTime(item.available_until) : null}
            />
          </Section>

          <Section title="Handicap-Story">
            <Row
              label="Grund"
              value={
                item.handicap_reason
                  ? (HANDICAP_REASON_LABELS[item.handicap_reason as HandicapReason] ??
                    item.handicap_reason)
                  : null
              }
            />
            <Row label="Story" value={item.handicap_story} />
          </Section>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Produktbild</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted/30">
                {image.data ? (
                  <img
                    src={image.data}
                    alt={`Produktbild von ${item.product_name}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground placeholder-hatch">
                    Kein Bild hinterlegt
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Interne Notiz</CardTitle>
              <CardDescription className="text-xs">Nur intern sichtbar.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {item.internal_note || "Keine interne Notiz erfasst."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Zeitstempel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Row label="Erstellt" value={formatDateTime(item.created_at)} />
              <Row label="Zuletzt geändert" value={formatDateTime(item.updated_at)} />
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Reserved icon={<Scale className="size-4" />} title="Nachkalkulation" />
          </div>
        </div>
      </div>

      <PageSection
        id="publikation"
        title="WhatsApp-Post"
        description="Post vorbereiten, Bild und Text kopieren und den Catch manuell als publiziert markieren."
      >
        {item.status === "ready" || item.status === "published" ? (
          <PublicationWorkspace
            item={item}
            onChanged={async () => {
              await queryClient.invalidateQueries({ queryKey: ["catch", catchId] });
              await queryClient.invalidateQueries({ queryKey: ["catches"] });
            }}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <p className="text-sm text-muted-foreground">
                Der Catch muss vollständig und bereit sein, bevor der WhatsApp-Post vorbereitet
                werden kann.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/catches/$catchId/edit" params={{ catchId }}>
                  <Pencil />
                  Catch vervollständigen
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </PageSection>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] items-start gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line text-sm">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

function Reserved({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground placeholder-hatch">
      {icon}
      <span className="font-medium">{title}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wide">folgt</span>
    </div>
  );
}
