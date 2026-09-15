/**
 * Review-Seite für das interne Sounding. Geschützter Deep-Link aus der
 * Teams-Nachricht: Anmeldung erforderlich, keine öffentliche Vorschau.
 * Mobil optimiert, weil die Seite meist aus Teams geöffnet wird.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CalculationCard } from "@/components/catch/calculation-card";
import { CatchStatusBadge, TemperatureBadge } from "@/components/catch/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-role";
import { useSignedImage } from "@/hooks/use-signed-image";
import { calculateCatch } from "@/lib/catch-calculation";
import { catchToCalculationInput, fetchCatch } from "@/lib/catches";
import { formatDateTime, formatQuantity } from "@/lib/format";
import {
  REVIEW_DECISIONS,
  REVIEW_DECISION_LABELS,
  REVIEW_ROUND_STATUS_LABELS,
  SAMPLE_CHECK_LABELS,
  currentRound,
  fetchReviewRounds,
  responseCommentRequired,
  submitReviewResponse,
  validateResponse,
  type ReviewDecision,
} from "@/lib/sounding";

export const Route = createFileRoute("/_authenticated/catches/$catchId/review")({
  head: () => ({
    meta: [
      { title: "Sounding-Review — Food Catch Cockpit" },
      {
        name: "description",
        content:
          "Interne Beurteilung eines Food Catch: Produkt, Musterprüfung und Kalkulation prüfen und strukturierte Rückmeldung erfassen.",
      },
      { property: "og:title", content: "Sounding-Review — Food Catch Cockpit" },
      {
        property: "og:description",
        content: "Interne Beurteilung eines Food Catch mit strukturierter Rückmeldung.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { catchId } = Route.useParams();
  const { profile } = useRoles();
  const catchQuery = useQuery({ queryKey: ["catch", catchId], queryFn: () => fetchCatch(catchId) });
  const roundsQuery = useQuery({
    queryKey: ["review-rounds", catchId],
    queryFn: () => fetchReviewRounds(catchId),
  });
  const image = useSignedImage(catchQuery.data?.image_path);

  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [comment, setComment] = useState("");

  const round = roundsQuery.data ? currentRound(roundsQuery.data) : null;
  const own = round?.responses.find((response) => response.user_id === profile?.id) ?? null;

  useEffect(() => {
    if (own) {
      setDecision(own.decision);
      setComment(own.comment ?? "");
    }
  }, [own?.id, own?.decision, own?.comment, own]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!round || !decision || !profile) throw new Error("Rückmeldung nicht möglich.");
      await submitReviewResponse(round.id, profile.id, decision, comment, own?.id);
    },
    onSuccess: async () => {
      toast.success("Rückmeldung gespeichert");
      await roundsQuery.refetch();
    },
    onError: (error: unknown) =>
      toast.error("Rückmeldung fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  if (catchQuery.isLoading || roundsQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  const item = catchQuery.data;
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
  const isRecipient = Boolean(
    round?.recipients.some((recipient) => recipient.user_id === profile?.id),
  );
  const roundOpen = round?.status === "requested" || round?.status === "feedback_received";
  const problem = decision ? validateResponse(decision, comment) : null;

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
              <CardTitle className="text-sm">Produkt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted/30">
                {image.data ? (
                  <img
                    src={image.data}
                    alt={`Produktbild von ${item.product_name}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    Kein Bild hinterlegt
                  </div>
                )}
              </div>
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
              <Row
                label="Abholort"
                value={item.location_names.length > 0 ? item.location_names.join(", ") : null}
              />
              <Row label="Handicap-Story" value={item.handicap_story} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Musterprüfung</CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Deine Rückmeldung</CardTitle>
              <CardDescription className="text-xs">
                Die Diskussion kann in Teams laufen; verbindlich ist die Rückmeldung hier.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!round ? (
                <p className="text-sm text-muted-foreground">
                  Für diesen Catch läuft aktuell kein Sounding.
                </p>
              ) : !isRecipient ? (
                <p className="text-sm text-muted-foreground">
                  Du bist für dieses Sounding nicht als prüfende Person ausgewählt und siehst die
                  Angaben nur lesend.
                </p>
              ) : !roundOpen ? (
                <p className="text-sm text-muted-foreground">
                  Diese Sounding-Runde ist nicht mehr offen.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {REVIEW_DECISIONS.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={decision === option ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setDecision(option)}
                      >
                        {REVIEW_DECISION_LABELS[option]}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comment" className="text-xs">
                      Kommentar
                      {decision && responseCommentRequired(decision)
                        ? " (erforderlich)"
                        : " (optional)"}
                    </Label>
                    <Textarea
                      id="comment"
                      rows={4}
                      maxLength={600}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
                    {problem ? (
                      <p role="alert" className="text-xs font-medium text-destructive">
                        {problem}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    className="w-full"
                    disabled={!decision || Boolean(problem) || submit.isPending}
                    onClick={() => submit.mutate()}
                  >
                    {submit.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    {own ? "Rückmeldung aktualisieren" : "Rückmeldung senden"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Erfasste Rückmeldungen</CardTitle>
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
