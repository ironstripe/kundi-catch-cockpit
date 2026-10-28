/**
 * Review-Seite für das interne Sounding. Geschützter Deep-Link aus der
 * Teams-Nachricht: Anmeldung erforderlich, keine öffentliche Vorschau.
 * Mobil optimiert, weil die Seite meist aus Teams geöffnet wird.
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { CalculationCard } from "@/components/catch/calculation-card";
import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductLink } from "@/components/catch/product-link";
import { pickupSummary } from "@/lib/pickup-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CatchImageGallery } from "@/components/catch/catch-image-gallery";
import { calculateCatch } from "@/lib/catch-calculation";
import { catchToCalculationInput, fetchCatch } from "@/lib/catches";
import { formatDateTime, formatQuantity } from "@/lib/format";
import {
  REVIEW_DECISION_LABELS,
  REVIEW_ROUND_STATUS_LABELS,
  SAMPLE_CHECK_LABELS,
  fetchReviewRounds,
} from "@/lib/sounding";

export const Route = createFileRoute("/_authenticated/catches/$catchId/review")({
  head: () => ({
    meta: [
      { title: "Sounding-Historie — Food Catch Cockpit" },
      {
        name: "description",
        content:
          "Historische Qualitätsaufzeichnungen und Sounding-Rückmeldungen eines Food Catch, nur lesbar.",
      },
      { property: "og:title", content: "Sounding-Historie — Food Catch Cockpit" },
      {
        property: "og:description",
        content: "Historische Sounding-Runden und Rückmeldungen, nur lesbar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { catchId } = Route.useParams();
  const catchQuery = useQuery({ queryKey: ["catch", catchId], queryFn: () => fetchCatch(catchId) });
  const roundsQuery = useQuery({
    queryKey: ["review-rounds", catchId],
    queryFn: () => fetchReviewRounds(catchId),
  });

  if (catchQuery.isLoading || roundsQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  const item = catchQuery.data;
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
  const round = roundsQuery.data?.[0] ?? null;
  return (
    <>
      <PageHeader
        title={`Sounding: ${item.product_name}`}
        description={`${item.catch_number ?? "ohne Nummer"} · interne Beurteilung`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/catches/$catchId" params={{ catchId }}>
              <ArrowLeft />
              Zum Catch
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CatchStatusBadge status={item.status} />
        <TemperatureBadge temperature={item.temperature} />
        {round ? (
          <Badge variant="outline">
            Runde {round.round_number} · {REVIEW_ROUND_STATUS_LABELS[round.status]}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-section-title">Produkt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CatchImageGallery
                images={item.images}
                alt={`Produktbild von ${item.product_name}`}
              />
              <Row label="Produkt" value={item.product_name} />
              <Row label="Artikelnummer" value={item.article_number} />
              <Row label="Lieferant" value={item.supplier_name} />
              <Row
                label="Menge"
                value={formatQuantity(item.purchase_quantity, item.quantity_unit)}
              />
              <Row
                label="Verfügbar ab"
                value={item.available_from ? formatDateTime(item.available_from) : null}
              />
              <Row
                label="Verfügbar bis"
                value={item.available_until ? formatDateTime(item.available_until) : null}
              />
              <Row label="Abholort" value={pickupSummary(item.locations)} />
              <Row label="Handicap-Story" value={item.handicap_story} />
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs text-muted-foreground">Onlineshop</span>
                <ProductLink url={item.online_shop_url} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-section-title">Musterprüfung</CardTitle>
              <CardDescription className="text-xs">
                Das Produktmuster wird offline aufgetaut und geprüft.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Row label="Ergebnis" value={SAMPLE_CHECK_LABELS[item.sample_check_status]} />
              <Row
                label="Geprüft am"
                value={item.sample_checked_at ? formatDateTime(item.sample_checked_at) : null}
              />
              <Row label="Bemerkung" value={item.sample_check_note} />
            </CardContent>
          </Card>

          <CalculationCard
            result={calculation}
            description="Diese Werte werden im Sounding beurteilt."
          />
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Sounding ist inaktiv. Historische Runden und Rückmeldungen sind nur lesbar.</p>
          {roundsQuery.error ? <p role="alert">Historische Runden konnten nicht geladen werden.</p> : null}
          {(roundsQuery.data ?? []).map((historyRound) => (
            <details key={historyRound.id} className="border-b py-3">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Runde {historyRound.round_number} · {REVIEW_ROUND_STATUS_LABELS[historyRound.status]}</summary>
              <div className="space-y-2 pt-2 text-sm">
                <p>{formatDateTime(historyRound.requested_at)}</p>
                {historyRound.snapshot ? <>
                  <Row label="Produkt damals" value={historyRound.snapshot.product_name} />
                  <Row label="Prüfnotiz damals" value={historyRound.snapshot.sample_check_note} />
                </> : null}
                {historyRound.responses.map((response) => <div key={response.id} className="border-t py-2"><p>{response.user_name ?? "Unbekannt"} · {REVIEW_DECISION_LABELS[response.decision]}</p><p className="whitespace-pre-line">{response.comment}</p></div>)}
              </div>
            </details>
          ))}
          <Card>
            <CardHeader>
              <CardTitle className="text-section-title">Erfasste Rückmeldungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(round?.responses ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Rückmeldung erfasst.</p>
              ) : (
                (round?.responses ?? []).map((response) => (
                  <div key={response.id} className="rounded-md border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{response.user_name ?? "Unbekannt"}</span>
                      <Badge variant="outline">{REVIEW_DECISION_LABELS[response.decision]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(response.updated_at)}
                      </span>
                    </div>
                    {response.comment ? (
                      <p className="mt-1 whitespace-pre-line text-muted-foreground">
                        {response.comment}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr] items-start gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line text-sm">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}
