import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Inbox, Mail, Paperclip } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CaseStatusBadge } from "@/components/offers/case-status-badge";
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
  CASE_FILTER_LABELS,
  caseNeedsAction,
  caseProductName,
  fetchCases,
  type CaseFilter,
  type CaseListItem,
} from "@/lib/offer-cases";
import { EXTRACTION_STATUS_LABELS } from "@/lib/supplier-offers";

export const Route = createFileRoute("/_authenticated/offers/")({
  head: () => ({
    meta: [
      { title: "Angebotseingang — Food Catch Cockpit" },
      {
        name: "description",
        content:
          "Angebotsdossiers prüfen: mehrere Lieferanten-E-Mails, Anhänge, konsolidierte Angaben und Übernahme in einen Catch-Entwurf.",
      },
      { property: "og:title", content: "Angebotseingang — Food Catch Cockpit" },
      {
        property: "og:description",
        content: "Angebotsdossiers aus Lieferanten-E-Mails prüfen und in Catch-Entwürfe übernehmen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfferCasesPage,
});

function actionLabel(item: CaseListItem) {
  return item.status === "converted" ? "Ansehen" : "Prüfen";
}

function ariaLabel(item: CaseListItem) {
  return `Angebotsdossier ${item.title} von ${item.supplier_name ?? "unbekanntem Lieferanten"} öffnen`;
}

/** Klicks auf echte Bedienelemente oder auf markierten Text lösen keine Zeilennavigation aus. */
function shouldIgnoreRowActivation(event: MouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("a, button, input, textarea, select, [role='button']")) return true;
  if (window.getSelection()?.toString()) return true;
  return false;
}

function dateRange(item: CaseListItem) {
  if (!item.first_received_at) return "—";
  const first = formatDateTime(item.first_received_at);
  if (!item.last_received_at || item.last_received_at === item.first_received_at) return first;
  return `${first} – ${formatDateTime(item.last_received_at)}`;
}

function OfferCasesPage() {
  const [filter, setFilter] = useState<CaseFilter>("open");
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["offer-cases", filter],
    queryFn: () => fetchCases(filter),
  });

  const cases = data ?? [];

  const open = (caseId: string) => {
    void navigate({ to: "/offers/$caseId", params: { caseId } });
  };

  const rowHandlers = (item: CaseListItem) => ({
    role: "link" as const,
    tabIndex: 0,
    "aria-label": ariaLabel(item),
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (shouldIgnoreRowActivation(event)) return;
      open(item.id);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(item.id);
      }
    },
  });

  return (
    <>
      <PageHeader
        title="Angebotseingang"
        description="Angebotsdossiers aus weitergeleiteten Lieferanten-E-Mails. Jede E-Mail startet in einem eigenen Dossier; zusammengelegt wird nur von Hand. Nichts wird automatisch bestellt oder publiziert."
      />

      <Tabs value={filter} onValueChange={(value) => setFilter(value as CaseFilter)}>
        <TabsList>
          {(Object.keys(CASE_FILTER_LABELS) as CaseFilter[]).map((value) => (
            <TabsTrigger key={value} value={value}>
              {CASE_FILTER_LABELS[value]}
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
      ) : cases.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Inbox}
            title="Keine Angebotsdossiers in dieser Ansicht"
            description="Sobald eine Kollegin oder ein Kollege ein Lieferantenangebot an die zentrale Adresse weiterleitet, erscheint es hier als eigenes Dossier."
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
                    <TableHead>Dossier</TableHead>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>E-Mails</TableHead>
                    <TableHead>Anhänge</TableHead>
                    <TableHead>Empfangen</TableHead>
                    <TableHead>Auswertung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="sticky right-0 bg-card text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((item) => (
                    <TableRow
                      key={item.id}
                      {...rowHandlers(item)}
                      className="cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <TableCell className="max-w-56 truncate font-medium">{item.title}</TableCell>
                      <TableCell className="max-w-40 truncate text-sm">
                        {item.supplier_name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm">
                        {caseProductName(item.consolidated_data)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="size-3.5" aria-hidden />
                          {item.email_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Paperclip className="size-3.5" aria-hidden />
                          {item.attachment_count}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {dateRange(item)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {EXTRACTION_STATUS_LABELS[item.extraction_status] ?? item.extraction_status}
                      </TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        <CaseStatusBadge status={item.status} />
                        {caseNeedsAction(item) ? <Badge variant="outline">Zu prüfen</Badge> : null}
                      </TableCell>
                      <TableCell className="sticky right-0 bg-card text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/offers/$caseId" params={{ caseId: item.id }}>
                            {actionLabel(item)}
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
            {cases.map((item) => (
              <Card
                key={item.id}
                {...rowHandlers(item)}
                className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="flex flex-wrap justify-end gap-1">
                      <CaseStatusBadge status={item.status} />
                      {caseNeedsAction(item) ? <Badge variant="outline">Zu prüfen</Badge> : null}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="truncate">
                      <span className="text-muted-foreground">Lieferant: </span>
                      {item.supplier_name ?? "—"}
                    </p>
                    <p className="truncate">
                      <span className="text-muted-foreground">Produkt: </span>
                      {caseProductName(item.consolidated_data)}
                    </p>
                    <p className="truncate">
                      <span className="text-muted-foreground">Empfangen: </span>
                      {dateRange(item)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3.5" aria-hidden />
                      {item.email_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="size-3.5" aria-hidden />
                      {item.attachment_count}
                    </span>
                    <span>
                      {EXTRACTION_STATUS_LABELS[item.extraction_status] ?? item.extraction_status}
                    </span>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/offers/$caseId" params={{ caseId: item.id }}>
                      {actionLabel(item)}
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
