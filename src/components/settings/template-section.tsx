import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-role";
import { useSyncedDraft } from "@/hooks/use-synced-draft";
import { recordAudit } from "@/lib/audit";
import {
  CATCH_MARKER,
  DEFAULT_TEMPLATE_SETTINGS,
  SETTING_AUDIT_IDS,
  SETTING_KEYS,
  TEMPLATE_TEXT_MAX,
  ensureCatchMarker,
  fetchAppSettings,
  saveSetting,
  validateTemplateText,
} from "@/lib/app-settings";

export function TemplateSection() {
  const { isAdmin } = useRoles();
  const readOnly = !isAdmin;
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const serverText = (settings.data?.template ?? DEFAULT_TEMPLATE_SETTINGS).text;
  // Lokale Bearbeitung; Refetch/Speicherantwort überschreibt keine ungespeicherten Änderungen.
  const draft = useSyncedDraft(settings.data ? "template" : "template:loading", serverText);
  const text = draft.value;
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (nextText: string) => {
      const current = settings.data;
      if (!current) throw new Error("Einstellungen noch nicht geladen.");
      // Gespeicherte Altwerte bleiben im Payload erhalten; massgeblich ist nur `text`.
      const next = { ...current.template, text: nextText };
      await saveSetting(SETTING_KEYS.template, next, current.template_version);
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[SETTING_KEYS.template]!,
        action: "template_updated",
        previous: { ...current.template },
        next,
        summary: "WhatsApp-Vorlage geändert",
      });
    },
    onSuccess: async (_r, nextText) => {
      draft.markSaved(nextText);
      toast.success("WhatsApp-Vorlage gespeichert.", {
        description: "Gilt für neu generierte Posts. Bestehende Texte bleiben unverändert.",
      });
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: unknown) =>
      toast.error("Die Vorlage konnte nicht gespeichert werden.", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  if (settings.isLoading) return <Skeleton className="h-64 w-full" />;
  if (settings.isError)
    return (
      <SectionShell title="WhatsApp-Vorlage" description="">
        <p role="alert" className="text-sm">
          Die Vorlage konnte nicht geladen werden.{" "}
          <Button size="sm" variant="outline" onClick={() => void settings.refetch()}>
            Erneut laden
          </Button>
        </p>
      </SectionShell>
    );

  function handleSave() {
    if (mutation.isPending || !draft.dirty) return;
    const message = validateTemplateText(text);
    if (message) {
      setError(message);
      return;
    }
    // Fehlt der Platzhalter, wird er sichtbar ergänzt; doppelte entfallen.
    const normalized = ensureCatchMarker(text);
    if (normalized !== text) draft.setValue(normalized);
    mutation.mutate(normalized);
  }

  return (
    <SectionShell
      title="WhatsApp-Vorlage"
      description="Ein Text für neu generierte Posts. Die Catch-Angaben werden automatisch eingefügt."
      contentClassName="space-y-4"
    >
      {readOnly ? (
        <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          Nur Administratoren können die Vorlage ändern. Du siehst die aktuelle Vorlage.
        </p>
      ) : null}
      <fieldset disabled={readOnly || mutation.isPending} className="min-w-0 max-w-3xl space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-text">Vorlagentext</Label>
          <Textarea
            id="tpl-text"
            value={text}
            rows={12}
            maxLength={TEMPLATE_TEXT_MAX}
            className="font-mono text-sm"
            onChange={(event) => {
              setError(null);
              draft.setValue(event.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            <code>{CATCH_MARKER}</code> steht für die Catch-Angaben (Produkt, Preis, MHD, Abholort,
            Verfügbarkeit, Shop-Link). Fehlt er, kommen sie ans Ende. WhatsApp-Formatierung:{" "}
            <code>*fett*</code>, <code>~durchgestrichen~</code>, Emojis direkt. Kein HTML.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={mutation.isPending || !draft.dirty}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Speichern
            </Button>
            <Button
              variant="outline"
              disabled={!draft.dirty}
              onClick={() => {
                setError(null);
                draft.setValue(draft.base);
              }}
            >
              Verwerfen
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                draft.setValue(DEFAULT_TEMPLATE_SETTINGS.text);
              }}
            >
              Standard wiederherstellen
            </Button>
          </div>
        )}
        {!readOnly && draft.dirty ? (
          <p className="text-xs text-muted-foreground">
            Ungespeicherte Änderungen. «Standard wiederherstellen» wirkt erst nach Speichern.
          </p>
        ) : null}
      </fieldset>
    </SectionShell>
  );
}
