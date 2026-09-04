import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Instagram,
  Loader2,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-role";
import { fetchAppSettings } from "@/lib/app-settings";
import { CATCH_IMAGE_BUCKET, type CatchDetail } from "@/lib/catches";
import { formatDateTime, zurichLocalToIso } from "@/lib/format";
import { cropToPortrait, signedPreviewUrl, uploadPortraitAsset } from "@/lib/instagram-image";
import { generateInstagramCaption } from "@/lib/instagram-post";
import {
  approveAndPublishInstagram,
  retryInstagramPublish,
  saveInstagramCaption,
  selectForInstagram,
  unselectForInstagram,
} from "@/lib/instagram.functions";

const STATUS_LABELS: Record<string, string> = {
  not_selected: "Nicht ausgewählt",
  draft: "Entwurf",
  ready: "Bereit zur Freigabe",
  publishing: "Veröffentlichung läuft",
  published: "Veröffentlicht",
  failed: "Fehlgeschlagen",
};

/** Nächster Zeitpunkt für die konfigurierte Standardzeit (Europe/Zurich). */
function nextPublishAt(hour: string): string | null {
  const [h, m] = hour.split(":");
  if (!h || !m) return null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const iso = zurichLocalToIso(`${today}T${h}:${m}`);
  if (!iso) return null;
  if (new Date(iso).getTime() > now.getTime()) return iso;
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(
    tomorrow.getDate(),
  ).padStart(2, "0")}`;
  return zurichLocalToIso(`${day}T${h}:${m}`);
}

interface Props {
  item: CatchDetail;
  onChanged: () => void | Promise<unknown>;
}

export function InstagramWorkspace({ item, onChanged }: Props) {
  const { canEdit } = useRoles();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const instagram = settings.data?.instagram;

  const select = useServerFn(selectForInstagram);
  const unselect = useServerFn(unselectForInstagram);
  const saveCaption = useServerFn(saveInstagramCaption);
  const approve = useServerFn(approveAndPublishInstagram);
  const retry = useServerFn(retryInstagramPublish);

  const generated = useMemo(
    () =>
      generateInstagramCaption(
        {
          product_name: item.product_name,
          handicap_reason: item.handicap_reason,
          handicap_story: item.handicap_story,
        },
        instagram?.call_to_action,
      ),
    [item.product_name, item.handicap_reason, item.handicap_story, instagram?.call_to_action],
  );

  const [caption, setCaption] = useState(item.instagram_caption ?? generated);
  useEffect(() => {
    setCaption(item.instagram_caption ?? generated);
  }, [item.instagram_caption, generated]);

  const preview = useQuery({
    queryKey: ["instagram-asset", item.instagram_asset_path],
    queryFn: () => signedPreviewUrl(item.instagram_asset_path!),
    enabled: Boolean(item.instagram_asset_path),
    staleTime: 1000 * 60 * 30,
  });

  const publishedOnWhatsapp = Boolean(item.published_at);
  const status = item.instagram_status;
  const locked = status === "publishing" || status === "published";
  const publishAt =
    instagram?.default_publish_time === "scheduled"
      ? nextPublishAt(instagram.default_publish_hour)
      : null;

  const toggle = useMutation({
    mutationFn: async (checked: boolean) => {
      if (!checked) return unselect({ data: { catchId: item.id } });
      let assetPath = item.instagram_asset_path;
      if (!assetPath && item.image_path) {
        const { data: blob, error } = await supabase.storage
          .from(CATCH_IMAGE_BUCKET)
          .download(item.image_path);
        if (error) throw error;
        const cropped = await cropToPortrait(blob);
        if (cropped) assetPath = await uploadPortraitAsset(cropped);
      }
      return select({ data: { catchId: item.id, caption, assetPath: assetPath ?? null } });
    },
    onSuccess: async () => {
      await onChanged();
    },
    onError: (error: unknown) =>
      toast.error("Aktion fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  const persistCaption = useMutation({
    mutationFn: () => saveCaption({ data: { catchId: item.id, caption } }),
    onSuccess: async () => {
      await onChanged();
      toast.success("Instagram-Text gespeichert");
    },
    onError: (error: unknown) =>
      toast.error("Speichern fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  const publish = useMutation({
    mutationFn: (isRetry: boolean) =>
      isRetry
        ? retry({ data: { catchId: item.id, publishAt } })
        : approve({ data: { catchId: item.id, publishAt } }),
    onSuccess: async (result) => {
      await onChanged();
      toast.success(result.message);
    },
    onError: (error: unknown) =>
      toast.error("Veröffentlichung fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  if (settings.isLoading) return <Skeleton className="h-40 w-full" />;

  const disabledReason = !publishedOnWhatsapp
    ? "Der Catch muss zuerst auf WhatsApp publiziert und im Cockpit bestätigt werden."
    : !instagram?.enabled
      ? "Die Instagram-Automatisierung ist in den Einstellungen nicht aktiv."
      : !canEdit
        ? "Als Viewer siehst du diesen Bereich nur lesend."
        : null;

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Instagram className="size-4" />
            Instagram (optional)
          </CardTitle>
          <CardDescription className="text-xs">
            Zweitkanal für Reichweite. Auswählen, freigeben — der Rest läuft automatisch.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {STATUS_LABELS[status] ?? status}
          </Badge>
          <Switch
            aria-label="Diesen Catch für Instagram nutzen"
            checked={item.instagram_selected}
            disabled={Boolean(disabledReason) || locked || toggle.isPending}
            onCheckedChange={(checked) => toggle.mutate(checked)}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {disabledReason ? (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        ) : !item.instagram_selected ? (
          <p className="text-xs text-muted-foreground">
            Standard ist aus. Beim Einschalten werden Text, Bild im Hochformat und Vorschau
            automatisch erzeugt.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
            <div className="space-y-2">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-md border bg-muted/30">
                {preview.data ? (
                  <img
                    src={preview.data}
                    alt={`Instagram-Bild von ${item.product_name}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                    Kein Bild im Hochformat verfügbar.
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Konto: Kundelfingerhof · Zeitpunkt:{" "}
                {publishAt ? formatDateTime(publishAt) : "sofort"}
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Instagram-Text</Label>
                <Textarea
                  rows={9}
                  value={caption}
                  disabled={locked || !canEdit}
                  onChange={(event) => setCaption(event.target.value)}
                />
              </div>

              {status === "published" ? (
                <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-xs">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>
                    Veröffentlicht am{" "}
                    {item.instagram_published_at
                      ? formatDateTime(item.instagram_published_at)
                      : "—"}
                  </span>
                  {item.instagram_permalink ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={item.instagram_permalink} target="_blank" rel="noreferrer">
                        <ExternalLink />
                        Beitrag ansehen
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {status === "failed" && item.instagram_error ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{item.instagram_error}</span>
                </div>
              ) : null}

              {status === "publishing" ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Die Veröffentlichung läuft. Das Ergebnis erscheint hier automatisch.
                </p>
              ) : null}

              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={locked || persistCaption.isPending}
                    onClick={() => persistCaption.mutate()}
                  >
                    <Save />
                    Text speichern
                  </Button>
                  {status === "failed" ? (
                    <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate(true)}>
                      {publish.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      Veröffentlichung erneut versuchen
                    </Button>
                  ) : status === "published" ? null : (
                    <Button
                      size="sm"
                      disabled={publish.isPending || locked}
                      onClick={() => publish.mutate(false)}
                    >
                      {publish.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                      Freigeben und auf Instagram veröffentlichen
                    </Button>
                  )}
                </div>
              ) : null}

              {item.instagram_approved_at ? (
                <p className="text-xs text-muted-foreground">
                  Freigegeben am {formatDateTime(item.instagram_approved_at)}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
