import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WhatsappPreview } from "@/components/catch/whatsapp-preview";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { CatchDetail } from "@/lib/catches";
import { formatDateTime } from "@/lib/format";
import {
  catchToPostSource,
  ensureOptimizedImage,
  keepOutdatedPost,
  markCatchPublished,
  savePostVersion,
} from "@/lib/publication";
import {
  copyImageToClipboard,
  downloadBlob,
  optimizedFileName,
  supportsTextClipboard,
} from "@/lib/whatsapp-image";
import { generatePostText, postSourceSignature } from "@/lib/whatsapp-post";

const WHATSAPP_WEB_URL = "https://web.whatsapp.com";

const SEQUENCE = [
  "Bild kopieren",
  "In WhatsApp einfügen",
  "Text kopieren",
  "In WhatsApp einfügen",
  "Post senden",
  "Im Cockpit als publiziert markieren",
];

interface PublicationWorkspaceProps {
  item: CatchDetail;
  onChanged: () => void | Promise<unknown>;
}

export function PublicationWorkspace({ item, onChanged }: PublicationWorkspaceProps) {
  const source = useMemo(() => catchToPostSource(item), [item]);
  const generated = useMemo(() => generatePostText(source), [source]);
  const signature = useMemo(() => postSourceSignature(source), [source]);

  const [finalText, setFinalText] = useState(item.post_final_text ?? generated);
  const [confirm, setConfirm] = useState<null | "regenerate" | "reset" | "publish">(null);
  const [imageFallback, setImageFallback] = useState(false);
  const [textFallback, setTextFallback] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const catchId = item.id;

  useEffect(() => {
    setFinalText(item.post_final_text ?? generated);
  }, [item.post_final_text, generated, item.id]);

  const image = useQuery({
    queryKey: ["catch-post-image", catchId, item.image_path],
    queryFn: () => ensureOptimizedImage(catchId),
    staleTime: 1000 * 60 * 10,
  });

  const publisher = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 1000 * 60 * 10,
  });

  const storedGenerated = item.post_generated_text;
  const hasManualEdits = storedGenerated !== null && finalText.trim() !== storedGenerated.trim();
  const unsaved = finalText !== (item.post_final_text ?? "");
  const outdated =
    item.post_source_signature !== null &&
    item.post_source_signature !== signature &&
    item.post_outdated_decision !== "keep";

  const saveText = useMutation({
    mutationFn: async (args: { text: string; reason: "generated" | "edited" | "reset" }) => {
      await savePostVersion({
        catchId,
        generatedText: generated,
        finalText: args.text,
        signature,
        generatedAt: args.reason === "edited" ? undefined : new Date().toISOString(),
        reason: args.reason,
        imagePath: image.data?.path ?? null,
      });
    },
    onSuccess: async () => {
      await onChanged();
      toast.success("Post-Text gespeichert");
    },
    onError: (error: unknown) =>
      toast.error("Speichern fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  const keepText = useMutation({
    mutationFn: () => keepOutdatedPost(catchId, signature),
    onSuccess: async () => {
      await onChanged();
      toast.success("Bestehender Text bleibt bestehen");
    },
  });

  const publish = useMutation({
    mutationFn: () =>
      markCatchPublished({
        catchId,
        finalText,
        generatedText: generated,
        signature,
        imagePath: image.data?.path ?? null,
      }),
    onSuccess: async () => {
      await onChanged();
      toast.success("Catch ist publiziert", {
        description: "Zeitpunkt, Nutzer, Text und Bild wurden festgehalten.",
      });
    },
    onError: (error: unknown) =>
      toast.error("Publikation fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  function applyGenerated(reason: "generated" | "reset") {
    setFinalText(generated);
    saveText.mutate({ text: generated, reason });
  }

  async function handleCopyImage() {
    const prepared = image.data;
    if (!prepared) return;
    try {
      await copyImageToClipboard(prepared.blob);
      setCopiedImage(true);
      setImageFallback(false);
      toast.success("Bild kopiert ✓", {
        description: "Jetzt in WhatsApp einfügen. Danach den Text kopieren.",
      });
    } catch {
      setImageFallback(true);
      toast.error("Bild konnte nicht kopiert werden", {
        description:
          "Direktes Kopieren wird von diesem Browser nicht unterstützt. Lade das Bild herunter und füge es in WhatsApp ein.",
      });
    }
  }

  function handleDownloadImage() {
    const prepared = image.data;
    if (!prepared) return;
    const extension = prepared.blob.type === "image/png" ? "png" : "jpg";
    downloadBlob(prepared.blob, optimizedFileName(item.catch_number, item.product_name, extension));
  }

  async function handleCopyText(text: string) {
    if (!supportsTextClipboard()) {
      setTextFallback(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setTextFallback(false);
      toast.success("Text kopiert ✓", { description: "Jetzt in WhatsApp einfügen." });
    } catch {
      setTextFallback(true);
      toast.error("Text konnte nicht kopiert werden", {
        description: "Text markieren und manuell kopieren.",
      });
    }
  }

  useEffect(() => {
    if (textFallback) fallbackRef.current?.select();
  }, [textFallback]);

  const publishedByLabel =
    item.published_by && publisher.data?.id === item.published_by
      ? (publisher.data.email ?? "Du")
      : item.published_by
        ? `Nutzer ${item.published_by.slice(0, 8)}`
        : "—";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Linke Spalte: Inhalt und Text */}
        <div className="space-y-4">
          {outdated ? (
            <div
              role="alert"
              className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" />
                Die Catch-Daten wurden geändert. Der WhatsApp-Post ist möglicherweise nicht mehr
                aktuell.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => applyGenerated("generated")}>
                  <RefreshCw />
                  Post neu generieren
                </Button>
                <Button size="sm" variant="outline" onClick={() => keepText.mutate()}>
                  Bestehenden Text behalten
                </Button>
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Post-Inhalt</CardTitle>
              <CardDescription className="text-xs">
                Diese Catch-Daten fliessen in den Text ein.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Produkt" value={item.product_name} />
                <Fact
                  label="Catch-Preis"
                  value={
                    item.catch_price === null
                      ? "—"
                      : `CHF ${item.catch_price.toFixed(2)}/${item.quantity_unit}`
                  }
                />
                <Fact
                  label="Abholorte"
                  value={item.location_names.join(", ") || "—"}
                />
                <Fact
                  label="Verfügbar ab"
                  value={item.available_from ? formatDateTime(item.available_from) : "—"}
                />
              </dl>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Bild, das nach WhatsApp kopiert wird
                </Label>
                <div className="aspect-[4/3] w-full max-w-xs overflow-hidden rounded-md border bg-muted/30">
                  {image.isLoading ? (
                    <Skeleton className="size-full" />
                  ) : image.data ? (
                    <img
                      src={image.data.url}
                      alt={`WhatsApp-Bild von ${item.product_name}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground placeholder-hatch">
                      Kein Produktbild hinterlegt
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {image.data
                    ? image.data.optimized
                      ? "Für WhatsApp optimiert (max. 1080 px, ohne Metadaten). Das Original bleibt erhalten."
                      : "Optimierung nicht möglich — es wird das Originalbild verwendet."
                    : "Ohne Bild kann nur der Text kopiert werden."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">WhatsApp-Text</CardTitle>
              <CardDescription className="text-xs">
                Frei editierbar. Manuelle Änderungen werden nicht automatisch überschrieben.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                id="post_final_text"
                value={finalText}
                onChange={(event) => setFinalText(event.target.value)}
                rows={18}
                className="font-mono text-xs leading-relaxed"
                aria-label="WhatsApp-Post-Text"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => saveText.mutate({ text: finalText, reason: "edited" })}
                  disabled={saveText.isPending || !unsaved}
                >
                  {saveText.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  Text sichern
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    hasManualEdits || unsaved ? setConfirm("regenerate") : applyGenerated("generated")
                  }
                >
                  <RefreshCw />
                  Aus Catch-Daten neu generieren
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    hasManualEdits || unsaved ? setConfirm("reset") : applyGenerated("reset")
                  }
                  disabled={finalText === generated}
                >
                  <RotateCcw />
                  Auf generierte Version zurücksetzen
                </Button>
              </div>
              {unsaved ? (
                <p className="text-xs text-muted-foreground">
                  Ungesicherte Textänderungen — vor dem Publizieren sichern.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Rechte Spalte: Vorschau und Publikation */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">WhatsApp-Vorschau</CardTitle>
              <CardDescription className="text-xs">
                Aktualisiert sich sofort beim Bearbeiten des Textes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WhatsappPreview
                text={finalText}
                imageUrl={image.data?.url ?? null}
                imageAlt={`Produktbild von ${item.product_name}`}
                status={item.status}
              />

              <ol className="grid gap-1 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                {SEQUENCE.map((step, index) => (
                  <li key={`${index}-${step}`} className="flex gap-2">
                    <span className="font-mono">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleCopyImage}
                  disabled={!image.data || image.isLoading}
                >
                  {copiedImage ? <CheckCircle2 /> : <ImageIcon />}
                  Bild kopieren
                </Button>
                {imageFallback || !image.data ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadImage}
                    disabled={!image.data}
                  >
                    <Download />
                    Bild herunterladen
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void handleCopyText(finalText)}>
                  <Copy />
                  Text kopieren
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={WHATSAPP_WEB_URL} target="_blank" rel="noreferrer noopener">
                    <ExternalLink />
                    WhatsApp öffnen
                  </a>
                </Button>
              </div>

              {imageFallback ? (
                <p className="text-xs text-muted-foreground">
                  Direktes Kopieren wird von diesem Browser nicht unterstützt. Lade das Bild
                  herunter und füge es in WhatsApp ein.
                </p>
              ) : null}

              {textFallback ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Text markieren und manuell kopieren.
                  </p>
                  <Textarea
                    ref={fallbackRef}
                    readOnly
                    rows={10}
                    value={finalText}
                    className="font-mono text-xs"
                    aria-label="Text zum manuellen Kopieren"
                  />
                </div>
              ) : null}

              <div className="space-y-2 border-t pt-3">
                {item.status === "published" ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-foreground">
                      Dieser Catch wurde bereits publiziert. Änderungen im Cockpit aktualisieren den
                      WhatsApp-Post nicht automatisch.
                    </p>
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CheckCircle2 className="size-4" />
                      Publiziert am{" "}
                      {item.published_at ? formatDateTime(item.published_at) : "unbekannt"}
                    </p>
                    <p>Publiziert von: {publishedByLabel}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleCopyText(item.published_text ?? finalText)}
                      >
                        <Copy />
                        Erneut kopieren
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setConfirm("publish")}
                    disabled={publish.isPending}
                  >
                    {publish.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    Als publiziert markieren
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {item.status === "published" && item.published_text ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Publizierte Version</CardTitle>
                <CardDescription className="text-xs">
                  Unveränderter Text und Bild zum Zeitpunkt der Publikation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {item.published_text}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <AlertDialog open={confirm === "regenerate"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Text neu generieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Deine manuellen Änderungen werden durch einen neu generierten Text ersetzt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null);
                applyGenerated("generated");
              }}
            >
              Neu generieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "reset"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auf generierte Version zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deine manuellen Änderungen werden durch einen neu generierten Text ersetzt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null);
                applyGenerated("reset");
              }}
            >
              Zurücksetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "publish"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Als publiziert markieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Wurde dieser Catch in der Kundi Catch WhatsApp-Gruppe veröffentlicht?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Noch nicht</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null);
                publish.mutate();
              }}
            >
              Ja, als publiziert markieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
