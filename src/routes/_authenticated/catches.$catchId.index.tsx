import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Scale, MessageSquare } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CalculationCard } from "@/components/catch/calculation-card";
import { InternalHandlingActions } from "@/components/catch/internal-handling-actions";
import { SampleCheckCard } from "@/components/catch/sample-check-card";
import { MountedDisclosure, revealSection } from "@/components/layout/mounted-disclosure";
import { QuantityPriceComparison } from "@/components/catch/quantity-price-comparison";
import { CompletedSummary } from "@/components/catch/completed-summary";
import { ReconciliationWorkspace } from "@/components/catch/reconciliation-workspace";
import { PublicationWorkspace } from "@/components/catch/publication-workspace";
import { PublishedPostCard } from "@/components/catch/published-post-card";
import { InstagramWorkspace } from "@/components/catch/instagram-workspace";
import { CatchImageGallery } from "@/components/catch/catch-image-gallery";
import { ProductLink } from "@/components/catch/product-link";
import { pickupSummary } from "@/lib/pickup-display";
import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UnsavedChangesDialog, useUnsavedChangesGuard } from "@/hooks/use-edit-session";
import { useRoles } from "@/hooks/use-role";
import { WHATSAPP_STATUS_LABELS, whatsappStatus } from "@/lib/whatsapp-status";
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
      { title: "Catch-Detail — Food Catch Cockpit" },
      {
        name: "description",
        content:
          "Alle Angaben zu einem Catch: Produkt, Beschaffung, Preise, Standorte, Verfügbarkeit und Handicap-Story.",
      },
      { property: "og:title", content: "Catch-Detail — Food Catch Cockpit" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Detailansicht eines Food Catch mit allen erfassten Angaben.",
      },
    ],
  }),
  component: CatchDetailPage,
});

function CatchDetailPage() {
  const { catchId } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["catch", catchId], queryFn: () => fetchCatch(catchId) });
  const { canEdit } = useRoles();
  const loaded = Boolean(query.data);
  // Ein gemeinsamer Guard für WhatsApp- und Instagram-Text (keine konkurrierenden Dialoge).
  const [publicationDirty, setPublicationDirty] = useState(false);
  const [instagramDirty, setInstagramDirty] = useState(false);
  const guard = useUnsavedChangesGuard(publicationDirty || instagramDirty);

  /** Springt nach dem Laden zuverlässig zum WhatsApp-Abschnitt. */
  useEffect(() => {
    if (!loaded) return;
    if (typeof window === "undefined" || !window.location.hash) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(window.location.hash.slice(1));
      revealSection(target);
      target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [loaded, catchId]);

  if (query.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const item = query.data;
  if (!item) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-section-title">Catch nicht gefunden</CardTitle>
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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["catch", catchId] });
    await queryClient.invalidateQueries({ queryKey: ["catches"] });
    await queryClient.invalidateQueries({ queryKey: ["history"] });
  };

  const deliveryText = item.delivery_included
    ? "Im Einkaufspreis enthalten"
    : formatCurrency(item.delivery_cost);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link to="/">
          <ArrowLeft />
          Dashboard
        </Link>
      </Button>
      <PageHeader
        className="sm:flex-col"
        title={item.product_name}
        description={`${item.catch_number ?? "ohne Nummer"}`}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/catches/$catchId/edit" params={{ catchId }}>
                <Pencil />
                Bearbeiten
              </Link>
            </Button>
            {item.status === "published" ? (
              <Button asChild>
                <a href="#nachkalkulation">
                  <Scale />
                  Catch abschliessen
                </a>
              </Button>
            ) : null}
            {canEdit && (item.status === "draft" || item.status === "ready") ? (
              <Button asChild>
                <a href="#publikation">
                  <MessageSquare />
                  WhatsApp-Post erstellen
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CatchStatusBadge status={item.status} />
        <TemperatureBadge temperature={item.temperature} />
        <SampleCheckCard item={item} onChanged={invalidate} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div id="interner-aufwand" className="scroll-mt-20">
            <CalculationCard
              result={calculation}
              description={`Berechnete Werte aus den gespeicherten Eingaben · Stand ${formatDateTime(item.updated_at)}`}
              footer={
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/catches/$catchId/edit" params={{ catchId }}>
                      <Pencil />
                      Catch bearbeiten
                    </Link>
                  </Button>
                  <InternalHandlingActions item={item} onChanged={invalidate} />
                </div>
              }
            />
          </div>
          <QuantityPriceComparison
            key={item.id}
            grossPrice={item.catch_price}
            quantityUnit={item.quantity_unit}
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
            <Row
              label="Einheit"
              value={QUANTITY_UNIT_LABELS[item.quantity_unit] ?? item.quantity_unit}
            />
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
              label="Food-Catch-Preis"
              value={item.catch_price === null ? null : formatCurrency(item.catch_price)}
            />
          </Section>

          <Section title="Aktion">
            <Row label="Abholorte" value={pickupSummary(item.locations)} />
            <Row
              label="Verfügbar ab"
              value={item.available_from ? formatDateTime(item.available_from) : null}
            />
            <Row
              label="Verfügbar bis"
              value={item.available_until ? formatDateTime(item.available_until) : null}
            />
            <div className="flex items-baseline justify-between gap-4 py-1">
              <span className="text-xs text-muted-foreground">Onlineshop</span>
              <ProductLink url={item.online_shop_url} />
            </div>
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
          <Section title="Produktbilder" summary={`${item.images.length} Fotos`}>
            <CatchImageGallery images={item.images} alt={`Produktbild von ${item.product_name}`} />
          </Section>
          <Section title="Interne Notiz und Zeitstempel">
            <p className="whitespace-pre-line text-sm">
              {item.internal_note || "Keine interne Notiz erfasst."}
            </p>
            <Row label="Erstellt" value={formatDateTime(item.created_at)} />
            <Row label="Zuletzt geändert" value={formatDateTime(item.updated_at)} />
            <Row label="Historische Prüfnotiz" value={item.sample_check_note} />
            <Row
              label="Geprüft am"
              value={item.sample_checked_at ? formatDateTime(item.sample_checked_at) : null}
            />
            <Link
              to="/catches/$catchId/review"
              params={{ catchId }}
              className="inline-block min-h-11 text-sm underline"
            >
              Historische Qualitätsaufzeichnungen
            </Link>
          </Section>
        </div>
      </div>

      {item.post_source_signature ? (
        <p className="text-xs text-muted-foreground">
          Gespeicherter WhatsApp-Text: Aktualität und allfällige Warnungen in{" "}
          <a href="#publikation" className="underline">
            WhatsApp-Post prüfen
          </a>
          .
        </p>
      ) : null}
      <MountedDisclosure
        id="publikation"
        title="WhatsApp-Post"
        summary={WHATSAPP_STATUS_LABELS[whatsappStatus(item)]}
      >
        <p className="text-xs text-muted-foreground">
          WhatsApp-Status:{" "}
          <span className="font-medium text-foreground">
            {WHATSAPP_STATUS_LABELS[whatsappStatus(item)]}
          </span>
        </p>

        {item.status === "closed" || item.status === "cancelled" ? (
          <PublishedPostCard item={item} />
        ) : canEdit ? (
          <PublicationWorkspace
            key={item.id}
            item={item}
            onChanged={invalidate}
            onDirtyChange={setPublicationDirty}
          />
        ) : item.published_text ? (
          <PublishedPostCard item={item} />
        ) : (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Der WhatsApp-Post wird von der Redaktion vorbereitet. Sobald er publiziert ist, kannst
              du ihn hier ansehen und kopieren.
            </CardContent>
          </Card>
        )}
      </MountedDisclosure>

      {item.status === "closed" || item.status === "cancelled" ? (
        <MountedDisclosure id="ergebnis" title="Ergebnis" summary="Fixiertes Ergebnis">
          <CompletedSummary item={item} onChanged={invalidate} />
        </MountedDisclosure>
      ) : null}

      {item.status === "published" ? (
        <MountedDisclosure
          id="nachkalkulation"
          title="Nachkalkulation"
          summary="Restmenge erfassen / manuell abschliessen"
        >
          <ReconciliationWorkspace item={item} onChanged={invalidate} />
        </MountedDisclosure>
      ) : null}

      {item.status === "closed" || item.status === "cancelled" ? null : (
        <MountedDisclosure id="instagram" title="Instagram" summary={item.instagram_status}>
          <InstagramWorkspace
            key={item.id}
            item={item}
            onChanged={invalidate}
            onDirtyChange={setInstagramDirty}
          />
        </MountedDisclosure>
      )}
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}

function Section({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <MountedDisclosure title={title} summary={summary}>
      {children}
    </MountedDisclosure>
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
