import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-role";
import {
  DEFAULT_INSTAGRAM_SETTINGS,
  SETTING_AUDIT_IDS,
  SETTING_KEYS,
  fetchAppSettings,
  saveSetting,
  type InstagramSettings,
} from "@/lib/app-settings";
import { recordAudit } from "@/lib/audit";
import { getInstagramConfigStatus, testInstagramWebhook } from "@/lib/instagram.functions";

export function InstagramSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const configFn = useServerFn(getInstagramConfigStatus);
  const testFn = useServerFn(testInstagramWebhook);
  const config = useQuery({
    queryKey: ["instagram-config"],
    queryFn: () => configFn({}),
    enabled: isAdmin,
  });

  const [values, setValues] = useState<InstagramSettings>(DEFAULT_INSTAGRAM_SETTINGS);

  useEffect(() => {
    if (settings.data) setValues(settings.data.instagram);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      await saveSetting(
        SETTING_KEYS.instagram,
        values as unknown as Record<string, unknown>,
        settings.data?.instagram_version ?? 1,
      );
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[SETTING_KEYS.instagram]!,
        action: "instagram_settings_updated",
        payload: { enabled: values.enabled },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Instagram-Einstellungen gespeichert");
    },
    onError: (error: unknown) =>
      toast.error("Speichern fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  const test = useMutation({
    mutationFn: () => testFn({}),
    onSuccess: (result) => toast.success(result.message),
    onError: (error: unknown) =>
      toast.error("Verbindungstest fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  if (!isAdmin) return <NoAccess />;
  if (settings.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <SectionShell
      title="Instagram"
      description="Optionaler Zweitkanal. Die Veröffentlichung läuft über den hinterlegten Automatisierungsdienst."
      action={
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          Speichern
        </Button>
      }
    >
      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Automatisierung aktiv</Label>
          <p className="text-xs text-muted-foreground">
            Steuert, ob der Instagram-Bereich auf der Catch-Detailseite bedienbar ist.
          </p>
        </div>
        <Switch
          checked={values.enabled}
          onCheckedChange={(checked) => setValues({ ...values, enabled: checked })}
        />
      </div>

      <div className="rounded-md border p-3 text-xs text-muted-foreground">
        {config.data?.webhook_configured ? (
          <span className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="size-4 text-success" />
            Verbindung zum Automatisierungsdienst ist hinterlegt (serverseitig, nie im Browser
            sichtbar).
          </span>
        ) : (
          <span>
            Es ist noch keine Verbindung hinterlegt. Die Adresse des Automatisierungsdienstes wird
            als geschütztes Servergeheimnis gespeichert.
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Link zur WhatsApp-Gruppe</Label>
          <Input
            value={values.whatsapp_group_url}
            placeholder="https://chat.whatsapp.com/…"
            onChange={(event) => setValues({ ...values, whatsapp_group_url: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">Für die Instagram-Bio.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Standardzeitpunkt</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={values.default_publish_time === "now" ? "default" : "outline"}
              onClick={() => setValues({ ...values, default_publish_time: "now" })}
            >
              Sofort
            </Button>
            <Button
              type="button"
              size="sm"
              variant={values.default_publish_time === "scheduled" ? "default" : "outline"}
              onClick={() => setValues({ ...values, default_publish_time: "scheduled" })}
            >
              Zur Standardzeit
            </Button>
            <Input
              type="time"
              className="w-32"
              value={values.default_publish_hour}
              onChange={(event) =>
                setValues({ ...values, default_publish_hour: event.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Aufruf im Instagram-Text</Label>
        <Textarea
          rows={3}
          value={values.call_to_action}
          onChange={(event) => setValues({ ...values, call_to_action: event.target.value })}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => test.mutate()}
        disabled={test.isPending || !config.data?.webhook_configured}
      >
        {test.isPending ? <Loader2 className="animate-spin" /> : <PlugZap />}
        Verbindung testen
      </Button>
    </SectionShell>
  );
}
