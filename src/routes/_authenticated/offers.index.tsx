import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, Paperclip } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { Badge } from "@/components/ui/badge";
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

function OffersPage() {
  const [filter, setFilter] = useState<OfferFilter>("open");
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-offers", filter],
    queryFn: () => fetchOffers(filter),
  });

  const offers = data ?? [];

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
        <Card className="mt-4">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow key={offer.id} className="cursor-pointer">
                    <TableCell className="whitespace-nowrap">
                      <Link
                        to="/offers/$offerId"
                        params={{ offerId: offer.id }}
                        className="block font-medium"
                      >
                        {formatDateTime(offer.received_at)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                      {offer.forwarded_by_email ?? "unbekannt"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm">
                      {String(offer.extracted_data.supplier_name?.value ?? "") ||
                        (offer.original_sender_email ?? "—")}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
