import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  FileDown,
  FolderInput,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { CaseAssignDialog } from "@/components/offers/case-assign-dialog";
import { CaseEmailPanel } from "@/components/offers/case-email-panel";
import { CaseStatusBadge } from "@/components/offers/case-status-badge";
import {
  OfferFieldsForm,
  formValuesToExtraction,
  offerToFormValues,
  useUnsavedGuard,
  type OfferFormValues,
} from "@/components/offers/offer-fields-form";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import { formatDateTime } from "@/lib/format";
import { fetchCase } from "@/lib/offer-cases";
import {
  assignEmailToCase,
  convertCaseToCatch,
  createCaseFromEmail,
  mergeCases,
  renameCase,
  retryCaseExtraction,
  saveCaseFields,
  setCaseIgnored,
} from "@/lib/offer-cases.functions";
import {
  extractionWarnings,
  MANUAL_EDIT_MARKER,
  missingRequiredFields,
  normaliseExtraction,
  OFFER_FIELD_LABELS,
} from "@/lib/supplier-offer-extraction";
import { retryOfferRetrieval } from "@/lib/supplier-offers.functions";

export const Route = createFileRoute("/_authenticated/offers/$caseId")({
  head: () => ({
    meta: [
      { title: "Angebotsdossier prüfen — Food Catch Cockpit" },
      {
        name: "description",
        content:
          "Angebotsdossier prüfen: alle Lieferanten-E-Mails, Anhänge, konsolidierte Angaben mit Quellenangabe und Übernahme als Catch-Entwurf.",
      },
      { property: "og:title", content: "Angebotsdossier prüfen — Food Catch Cockpit" },
      {
        property: "og:description",
        content: "Mehrere Lieferanten-E-Mails gemeinsam prüfen und als Catch-Entwurf übernehmen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfferCaseDetailPage,
});

function OfferCaseDetailPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const { canEdit } = useRoles();

  const {
    data: dossier,
    isLoading,
    refetch,
  } = useQuery({ queryKey: ["offer-case", caseId], queryFn: () => fetchCase(caseId) });

  const [values, setValues] = useState<OfferFormValues>({});
  const [initial, setInitial] = useState<OfferFormValues>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [imageChoice, setImageChoice] = useState<ImageChoice>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    if (!dossier) return;
    const next = offerToFormValues(dossier.consolidated_data);
    setValues(next);
    setInitial(next);
  }, [dossier]);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );
  useUnsavedGuard(dirty);

  const locked = dossier?.status === "converted";
  const editable = canEdit && !locked;

  const liveExtraction = useMemo(
    () =>
      dossier
        ? normaliseExtraction(formValuesToExtraction(values, dossier.consolidated_data))
        : null,
    [dossier, values],
  );
  const fieldWarnings = liveExtraction ? extractionWarnings(liveExtraction) : [];
  const warnings = useMemo(
    () => Array.from(new Set([...(dossier?.warnings ?? []), ...fieldWarnings])),
    [dossier?.warnings, fieldWarnings],
  );
  const missing = liveExtraction ? missingRequiredFields(liveExtraction) : [];

  const images = useMemo(
    () =>
      (dossier?.emails ?? []).flatMap((email) =>
        email.attachments.filter((attachment) => attachment.mime_type.startsWith("image/")),
      ),
    [dossier],
  );
  useEffect(() => {
    if (imageChoice !== null) return;
    const flagged = images.find((image) => image.is_primary_image);
    if (flagged) setImageChoice(flagged.id);
  }, [images, imageChoice]);
  const chosenImage = images.find((image) => image.id === imageChoice) ?? null;
  const needsImageDecision = images.length > 0 && imageChoice === null;

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

  async function runExtraction(overwrite: boolean) {
    setBusy("extract");
    try {
      const result = await retryCaseExtraction({ data: { caseId, confirmOverwrite: overwrite } });
      toast.success(result.message);
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen.";
      if (message.includes(MANUAL_EDIT_MARKER)) setConfirmOverwrite(true);
      else toast.error(message);
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

  if (!dossier) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <p>Dieses Angebotsdossier existiert nicht mehr.</p>
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
        title={dossier.title}
        description={`${dossier.emails.length} E-Mail(s) · Lieferant: ${dossier.supplier_name ?? "unbekannt"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CaseStatusBadge status={dossier.status} />
            {dossier.converted_catch_id ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/catches/$catchId" params={{ catchId: dossier.converted_catch_id }}>
                  Zum Catch-Entwurf
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {dossier.extraction_error ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Die Auswertung ist fehlgeschlagen: {dossier.extraction_error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <OfferFieldsForm
            offer={dossier.consolidated_data}
            values={values}
            onChange={setValues}
            disabled={!editable}
            warnings={warnings}
          />
          <CaseImagePicker
            images={images}
            choice={imageChoice}
            onChoose={setImageChoice}
            disabled={!canEdit || (locked && !dossier.converted_catch_id)}
            footer={
              locked && dossier.converted_catch_id && canEdit ? (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    disabled={!chosenImage || busy !== null}
                    onClick={() => void transferImage(false)}
                  >
                    <ImageUp className="mr-2 size-4" aria-hidden />
                    Gewähltes Bild in den Catch übernehmen
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Ein vorhandenes Catch-Bild wird nur nach Bestätigung ersetzt.
                  </span>
                </div>
              ) : null
            }
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              {editable ? (
                titleDraft === null ? (
                  <Button variant="ghost" size="sm" onClick={() => setTitleDraft(dossier.title)}>
                    <Pencil className="mr-2 size-4" aria-hidden />
                    Titel ändern
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={titleDraft}
                      aria-label="Titel des Angebotsdossiers"
                      onChange={(event) => setTitleDraft(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        onClick={async () => {
                          const title = titleDraft;
                          setTitleDraft(null);
                          await run("rename", () => renameCase({ data: { caseId, title } }));
                        }}
                      >
                        Speichern
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setTitleDraft(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )
              ) : null}

              <Button
                disabled={!editable || !dirty || busy !== null}
                onClick={() =>
                  run("save", () =>
                    saveCaseFields({
                      data: {
                        caseId,
                        values: formValuesToExtraction(values, dossier.consolidated_data),
                      },
                    }),
                  )
                }
              >
                <Save className="mr-2 size-4" aria-hidden />
                Änderungen speichern
              </Button>

              <Button
                disabled={!editable || busy !== null || missing.length > 0}
                onClick={() => setConfirmConvert(true)}
              >
                <FileDown className="mr-2 size-4" aria-hidden />
                Als Catch-Entwurf übernehmen
              </Button>
              {editable && missing.length ? (
                <p className="text-xs text-muted-foreground">
                  Noch nötig:{" "}
                  {missing.map((key, index) => (
                    <span key={key}>
                      {index > 0 ? ", " : ""}
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-foreground"
                        onClick={() => {
                          const target = document.getElementById(`offer-${key}`);
                          target?.scrollIntoView({ behavior: "smooth", block: "center" });
                          target?.focus({ preventScroll: true });
                        }}
                      >
                        {OFFER_FIELD_LABELS[key]}
                      </button>
                    </span>
                  ))}
                  . Werte eintragen und speichern, dann wird die Übernahme aktiv.
                </p>
              ) : null}

              {convertError ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs"
                >
                  {convertError}
                </p>
              ) : null}

              <Button
                variant="outline"
                disabled={!editable || busy !== null}
                onClick={() => void runExtraction(false)}
              >
                <Sparkles className="mr-2 size-4" aria-hidden />
                Auswertung wiederholen
              </Button>

              <Button
                variant="outline"
                disabled={!canEdit || busy !== null}
                onClick={() =>
                  run("retrieve", async () => {
                    const results = await Promise.all(
                      dossier.emails.map((email) =>
                        retryOfferRetrieval({ data: { offerId: email.id } }),
                      ),
                    );
                    return { message: results[results.length - 1]?.message ?? "Neu geladen." };
                  })
                }
              >
                <RefreshCw className="mr-2 size-4" aria-hidden />
                E-Mails und Anhänge neu laden
              </Button>

              <Button
                variant="outline"
                disabled={!editable || busy !== null}
                onClick={() => setMergeOpen(true)}
              >
                <FolderInput className="mr-2 size-4" aria-hidden />
                Mit anderem Angebotsdossier zusammenführen
              </Button>

              {dossier.status === "ignored" ? (
                <Button
                  variant="ghost"
                  disabled={!canEdit || busy !== null}
                  onClick={() =>
                    run("reopen", () => setCaseIgnored({ data: { caseId, ignored: false } }))
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
                    run("ignore", () => setCaseIgnored({ data: { caseId, ignored: true } }))
                  }
                >
                  <Archive className="mr-2 size-4" aria-hidden />
                  Dossier ablegen
                </Button>
              )}

              {locked ? (
                <p className="text-xs text-muted-foreground">
                  Dieses Dossier wurde am{" "}
                  {dossier.converted_at ? formatDateTime(dossier.converted_at) : "—"} übernommen und
                  ist schreibgeschützt.
                </p>
              ) : null}
              {!canEdit ? (
                <p className="text-xs text-muted-foreground">
                  Als Viewer siehst du das Dossier nur lesend.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <CaseEmailPanel
          caseId={caseId}
          emails={dossier.emails}
          canEdit={canEdit}
          locked={Boolean(locked)}
          busy={busy !== null}
          onChanged={() => void refetch()}
          onAssign={(emailId, targetCaseId) =>
            void run("assign", () => assignEmailToCase({ data: { emailId, targetCaseId } }))
          }
          onSplit={(emailId) => void run("split", () => createCaseFromEmail({ data: { emailId } }))}
        />
      </div>

      <CaseAssignDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        title="Dossiers zusammenführen"
        description={`Alle ${dossier.emails.length} E-Mail(s) dieses Dossiers werden in das gewählte Dossier verschoben. Quellen und Anhänge bleiben erhalten.`}
        excludeCaseId={caseId}
        confirmLabel="Zusammenführen"
        busy={busy !== null}
        onConfirm={async (targetCaseId) => {
          setMergeOpen(false);
          setBusy("merge");
          try {
            const result = await mergeCases({ data: { sourceCaseId: caseId, targetCaseId } });
            toast.success(result.message);
            await navigate({ to: "/offers/$caseId", params: { caseId: targetCaseId } });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
          } finally {
            setBusy(null);
          }
        }}
      />

      <AlertDialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Geprüfte Werte überschreiben?</AlertDialogTitle>
            <AlertDialogDescription>
              In diesem Dossier wurden Werte von Hand geändert. Eine neue Auswertung ersetzt sie
              durch die Angaben aus den E-Mails und Anhängen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOverwrite(false);
                void runExtraction(true);
              }}
            >
              Neu auswerten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmConvert} onOpenChange={setConfirmConvert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Als Catch-Entwurf übernehmen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Aus diesem Dossier entsteht genau ein Catch im Status «Entwurf». Nichts wird
                  bestellt, publiziert oder an den Lieferanten gemeldet. Eine Übernahme ist pro
                  Dossier nur einmal möglich.
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
                  {chosenImage
                    ? chosenImage.file_name
                    : "keines gewählt — der Catch bleibt ohne Bild."}
                </p>
                {missing.length ? (
                  <p>Es fehlen noch: {missing.map((key) => OFFER_FIELD_LABELS[key]).join(", ")}.</p>
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
                  const result = await convertCaseToCatch({
                    data: {
                      caseId,
                      values: formValuesToExtraction(values, dossier.consolidated_data),
                      imageAttachmentId: chosenImage?.id ?? null,
                    },
                  });
                  toast.success(result.message);
                  await navigate({ to: "/catches/$catchId", params: { catchId: result.catchId } });
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
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
