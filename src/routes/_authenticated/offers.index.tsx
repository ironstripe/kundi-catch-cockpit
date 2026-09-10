import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Inbox, Paperclip } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import {
  EXTRACTION_STATUS_LABELS,
  fetchOffers,
  needsAction,
  offerProductName,
  OFFER_FILTER_LABELS,
  type OfferFilter,
  type OfferListItem,
} from "@/lib/supplier-offers";

export const Route = createFileRoute("/_authenticated/offers/")({
  head: () => ({
    meta: [
      { title: "Angebotseingang — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Weitergeleitete Lieferantenangebote prüfen: Original-E-Mail, ausgelesene Angaben, Anhänge und Übernahme in einen Catch-Entwurf.",
      },
      { property: "og:title", content: "Angebotseingang — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Weitergeleitete Lieferantenangebote prüfen und in Catch-Entwürfe übernehmen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OffersPage,
});

function supplierLabel(offer: OfferListItem) {
  return (
    String(offer.extracted_data.supplier_name?.value ?? "") || (offer.original_sender_email ?? "—")
  );
}

function actionLabel(offer: OfferListItem) {
  return offer.status === "converted" ? "Ansehen" : "Prüfen";
}

function offerAriaLabel(offer: OfferListItem) {
  return `Angebot vom ${formatDateTime(offer.received_at)} von ${supplierLabel(offer)} öffnen`;
}

/** Klicks auf echte Bedienelemente oder auf markierten Text lösen keine Zeilennavigation aus. */
function shouldIgnoreRowActivation(event: MouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("a, button, input, textarea, select, [role='button']")) return true;
  if (window.getSelection()?.toString()) return true;
  return false;
}

function OffersPage() {
  const [filter, setFilter] = useState<OfferFilter>("open");
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-offers", filter],
    queryFn: () => fetchOffers(filter),
  });

  const offers = data ?? [];

  const open = (offerId: string) => {
    void navigate({ to: "/offers/$offerId", params: { offerId } });
  };

  const rowHandlers = (offer: OfferListItem) => ({
    role: "link" as const,
    tabIndex: 0,
    "aria-label": offerAriaLabel(offer),
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (shouldIgnoreRowActivation(event)) return;
      open(offer.id);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(offer.id);
      }
    },
  });

  return (
    <>
      <PageHeader
        title="Angebotseingang"
        description="Lieferantenangebote, die an die zentrale Adresse weitergeleitet wurden. Nichts wird automatisch bestellt oder publiziert."
      />

      <Tabs value={filter} onValueChange={(value) => setFilter(value as OfferFilter)}>
        <TabsList>
          {(Object.keys(OFFER_FILTER_LABELS) as OfferFilter[]).map((value) => (
            <TabsTrigger key={value} value={value}>
              {OFFER_FILTER_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : offers.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Inbox}
            title="Keine Angebote in dieser Ansicht"
            description="Sobald eine Kollegin oder ein Kollege ein Lieferantenangebot an die zentrale Adresse weiterleitet, erscheint es hier."
          />
        </div>
      ) : (
        <>
          {/* Desktop: Tabelle mit fixierter Aktionsspalte */}
          <Card className="mt-4 hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empfangen</TableHead>
                    <TableHead>Weitergeleitet von</TableHead>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Betreff</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Anhänge</TableHead>
                    <TableHead>Auswertung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="sticky right-0 bg-card text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((offer) => (
                    <TableRow
                      key={offer.id}
                      {...rowHandlers(offer)}
                      className="cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatDateTime(offer.received_at)}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                        {offer.forwarded_by_email ?? "unbekannt"}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-sm">
                        {supplierLabel(offer)}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-sm">
                        {offer.subject ?? "(kein Betreff)"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm">
                        {offerProductName(offer.extracted_data)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Paperclip className="size-3.5" aria-hidden />
                          {offer.attachment_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {EXTRACTION_STATUS_LABELS[offer.extraction_status] ??
                          offer.extraction_status}
                      </TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        <OfferStatusBadge status={offer.status} />
                        {needsAction(offer) ? <Badge variant="outline">Zu prüfen</Badge> : null}
                      </TableCell>
                      <TableCell className="sticky right-0 bg-card text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/offers/$offerId" params={{ offerId: offer.id }}>
                            {actionLabel(offer)}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobil: kompakte Karten ohne horizontales Scrollen */}
          <div className="mt-4 space-y-3 md:hidden">
            {offers.map((offer) => (
              <Card
                key={offer.id}
                {...rowHandlers(offer)}
                className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">
                      {formatDateTime(offer.received_at)}
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      <OfferStatusBadge status={offer.status} />
                      {needsAction(offer) ? <Badge variant="outline">Zu prüfen</Badge> : null}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="truncate">
                      <span className="text-muted-foreground">Lieferant: </span>
                      {supplierLabel(offer)}
                    </p>
                    <p className="truncate">
                      <span className="text-muted-foreground">Betreff: </span>
                      {offer.subject ?? "(kein Betreff)"}
                    </p>
                    <p className="truncate">
                      <span className="text-muted-foreground">Produkt: </span>
                      {offerProductName(offer.extracted_data)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="size-3.5" aria-hidden />
                      {offer.attachment_count}
                    </span>
                    <span>
                      {EXTRACTION_STATUS_LABELS[offer.extraction_status] ??
                        offer.extraction_status}
                    </span>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/offers/$offerId" params={{ offerId: offer.id }}>
                      {actionLabel(offer)}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
