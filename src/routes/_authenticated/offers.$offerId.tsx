import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  FileDown,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { OfferAttachments } from "@/components/offers/offer-attachments";
import {
  OfferFieldsForm,
  formValuesToExtraction,
  offerToFormValues,
  useUnsavedGuard,
  type OfferFormValues,
} from "@/components/offers/offer-fields-form";
import { OfferSourceEmail } from "@/components/offers/offer-source-email";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import { formatDateTime } from "@/lib/format";
import {
  extractionWarnings,
  missingRequiredFields,
  normaliseExtraction,
  OFFER_FIELD_LABELS,
} from "@/lib/supplier-offer-extraction";
import { fetchOffer } from "@/lib/supplier-offers";
import {
  convertOfferToCatch,
  retryOfferExtraction,
  retryOfferRetrieval,
  saveOfferFields,
  setOfferIgnored,
} from "@/lib/supplier-offers.functions";

export const Route = createFileRoute("/_authenticated/offers/$offerId")({
  head: () => ({
    meta: [
      { title: "Angebot prüfen — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Weitergeleitetes Lieferantenangebot prüfen: Original-E-Mail, ausgelesene Angaben, Anhänge und Übernahme als Catch-Entwurf.",
      },
      { property: "og:title", content: "Angebot prüfen — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Angaben aus einem Lieferantenangebot prüfen und als Catch-Entwurf übernehmen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfferDetailPage,
});

function OfferDetailPage() {
  const { offerId } = Route.useParams();
  const navigate = useNavigate();
  const { canEdit } = useRoles();

  const { data: offer, isLoading, refetch } = useQuery({
    queryKey: ["supplier-offer", offerId],
    queryFn: () => fetchOffer(offerId),
  });

  const [values, setValues] = useState<OfferFormValues>({});
  const [initial, setInitial] = useState<OfferFormValues>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);

  useEffect(() => {
    if (!offer) return;
    const next = offerToFormValues(offer.extracted_data);
    setValues(next);
    setInitial(next);
  }, [offer]);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );
  useUnsavedGuard(dirty);

  const locked = offer?.status === "converted";
  const editable = canEdit && !locked;

  const liveExtraction = useMemo(
    () => (offer ? normaliseExtraction(formValuesToExtraction(values, offer.extracted_data)) : null),
    [offer, values],
  );
  const warnings = liveExtraction ? extractionWarnings(liveExtraction) : [];
  const missing = liveExtraction ? missingRequiredFields(liveExtraction) : [];

  const primaryImage = offer?.attachments.find((item) => item.is_primary_image) ?? null;

  async function run(key: string, action: () => Promise<{ message: string }>) {
    setBusy(key);
    try {
      const result = await action();
      toast.success(result.message);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!offer) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <p>Dieses Angebot existiert nicht mehr.</p>
          <Button asChild variant="outline">
            <Link to="/offers">Zurück zum Angebotseingang</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/offers">
            <ArrowLeft className="mr-1 size-4" aria-hidden />
            Angebotseingang
          </Link>
        </Button>
      </div>

      <PageHeader
        title={offer.subject ?? "Angebot ohne Betreff"}
        description={`Empfangen am ${formatDateTime(offer.received_at)} · weitergeleitet von ${offer.forwarded_by_email ?? "unbekannt"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusBadge status={offer.status} />
            {offer.converted_catch_id ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/catches/$catchId" params={{ catchId: offer.converted_catch_id }}>
                  Zum Catch-Entwurf
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {offer.extraction_error ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Die Auswertung ist fehlgeschlagen: {offer.extraction_error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <OfferFieldsForm
            offer={offer.extracted_data}
            values={values}
            onChange={setValues}
            disabled={!editable}
            warnings={warnings}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <Button
                disabled={!editable || !dirty || busy !== null}
                onClick={() =>
                  run("save", () =>
                    saveOfferFields({
                      data: {
                        offerId,
                        values: formValuesToExtraction(values, offer.extracted_data),
                      },
                    }),
                  )
                }
              >
                <Save className="mr-2 size-4" aria-hidden />
                Änderungen speichern
              </Button>
              <Button
                variant="default"
                disabled={!editable || busy !== null || missing.length > 0}
                onClick={() => setConfirmConvert(true)}
              >
                <FileDown className="mr-2 size-4" aria-hidden />
                Als Catch-Entwurf übernehmen
              </Button>
              <Button
                variant="outline"
                disabled={!editable || busy !== null}
                onClick={() => run("extract", () => retryOfferExtraction({ data: { offerId } }))}
              >
                <Sparkles className="mr-2 size-4" aria-hidden />
                Auswertung wiederholen
              </Button>
              <Button
                variant="outline"
                disabled={!canEdit || busy !== null}
                onClick={() => run("retrieve", () => retryOfferRetrieval({ data: { offerId } }))}
              >
                <RefreshCw className="mr-2 size-4" aria-hidden />
                E-Mail und Anhänge neu laden
              </Button>
              {offer.status === "ignored" ? (
                <Button
                  variant="ghost"
                  disabled={!canEdit || busy !== null}
                  onClick={() =>
                    run("reopen", () => setOfferIgnored({ data: { offerId, ignored: false } }))
                  }
                >
                  <ArchiveRestore className="mr-2 size-4" aria-hidden />
                  Wieder in Bearbeitung nehmen
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  disabled={!editable || busy !== null}
                  onClick={() =>
                    run("ignore", () => setOfferIgnored({ data: { offerId, ignored: true } }))
                  }
                >
                  <Archive className="mr-2 size-4" aria-hidden />
                  Angebot ablegen
                </Button>
              )}
              {locked ? (
                <p className="text-xs text-muted-foreground">
                  Dieses Angebot wurde am{" "}
                  {offer.converted_at ? formatDateTime(offer.converted_at) : "—"} übernommen und ist
                  schreibgeschützt.
                </p>
              ) : null}
              {!canEdit ? (
                <p className="text-xs text-muted-foreground">
                  Als Viewer siehst du das Angebot nur lesend.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <OfferSourceEmail offer={offer} />
        </div>
      </div>

      <div className="mt-4">
        <OfferAttachments
          offerId={offerId}
          attachments={offer.attachments}
          canEdit={canEdit}
          locked={Boolean(locked)}
          onChanged={() => void refetch()}
        />
      </div>

      <AlertDialog open={confirmConvert} onOpenChange={setConfirmConvert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Als Catch-Entwurf übernehmen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Es entsteht ein Catch im Status «Entwurf». Nichts wird bestellt, publiziert oder
                  an den Lieferanten gemeldet. Eine Übernahme ist pro Angebot nur einmal möglich.
                </p>
                {warnings.length ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                <p>
                  Hauptbild:{" "}
                  {primaryImage ? primaryImage.file_name : "keines gewählt — der Catch bleibt ohne Bild."}
                </p>
                {missing.length ? (
                  <p>
                    Es fehlen noch: {missing.map((key) => OFFER_FIELD_LABELS[key]).join(", ")}.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmConvert(false);
                setBusy("convert");
                try {
                  const result = await convertOfferToCatch({
                    data: {
                      offerId,
                      values: formValuesToExtraction(values, offer.extracted_data),
                      imageAttachmentId: primaryImage?.id ?? null,
                    },
                  });
                  toast.success(result.message);
                  await navigate({
                    to: "/catches/$catchId",
                    params: { catchId: result.catchId },
                  });
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Die Übernahme ist fehlgeschlagen.",
                  );
                } finally {
                  setBusy(null);
                }
              }}
            >
              Entwurf erstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
