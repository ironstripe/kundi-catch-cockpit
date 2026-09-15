/**
 * Einstellungen für das interne Sounding: Microsoft-Teams-Gruppenchat und
 * standardmässig vorausgewählte prüfende Personen.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import {
  DEFAULT_SOUNDING_SETTINGS,
  SETTING_AUDIT_IDS,
  SETTING_KEYS,
  fetchAppSettings,
  saveSetting,
  type SoundingSettings,
} from "@/lib/app-settings";
import { recordAudit } from "@/lib/audit";
import { fetchActiveUsers, looksLikeTeamsUrl, validateTeamsUrl } from "@/lib/sounding";

export function SoundingSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const users = useQuery({ queryKey: ["active-users"], queryFn: fetchActiveUsers });
  const [values, setValues] = useState<SoundingSettings>(DEFAULT_SOUNDING_SETTINGS);

  useEffect(() => {
    if (settings.data) setValues(settings.data.sounding);
  }, [settings.data]);

  const urlError = validateTeamsUrl(values.teams_chat_url);
  const urlWarning =
    !urlError && values.teams_chat_url.trim() !== "" && !looksLikeTeamsUrl(values.teams_chat_url);

  const save = useMutation({
    mutationFn: async () => {
      const problem = validateTeamsUrl(values.teams_chat_url);
      if (problem) throw new Error(problem);
      await saveSetting(
        SETTING_KEYS.sounding,
        {
          teams_chat_url: values.teams_chat_url.trim(),
          default_reviewer_ids: values.default_reviewer_ids,
        },
        settings.data?.sounding_version ?? 1,
      );
      // Der Teams-Link selbst wird bewusst nicht protokolliert.
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[SETTING_KEYS.sounding]!,
        action: "sounding_settings_updated",
        next: {
          teams_chat_configured: values.teams_chat_url.trim() !== "",
          default_reviewers: values.default_reviewer_ids.length,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Sounding-Einstellungen gespeichert");
    },
    onError: (error: unknown) =>
      toast.error("Speichern fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  if (!isAdmin) return <NoAccess />;
  if (settings.isLoading) return <Skeleton className="h-64 w-full" />;

  function toggleReviewer(id: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      default_reviewer_ids: checked
        ? [...current.default_reviewer_ids, id]
        : current.default_reviewer_ids.filter((entry) => entry !== id),
    }));
  }

  return (
    <SectionShell
      title="Sounding"
      description="Interner Benachrichtigungskanal und Standardauswahl der prüfenden Personen."
      action={
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          Speichern
        </Button>
      }
    >
      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="teams_chat_url">
          Teams-Gruppenchat-Link
        </Label>
        <Input
          id="teams_chat_url"
          value={values.teams_chat_url}
          placeholder="https://teams.microsoft.com/l/chat/…"
          aria-invalid={Boolean(urlError)}
          onChange={(event) => setValues({ ...values, teams_chat_url: event.target.value })}
        />
        {urlError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {urlError}
          </p>
        ) : urlWarning ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" />
            Diese Adresse sieht nicht wie ein Microsoft-Teams-Link aus.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Die Sounding-Nachricht wird im Cockpit kopiert und im Teams-Chat manuell eingefügt und
            gesendet. Leer lassen deaktiviert nur den Knopf «Teams öffnen».
          </p>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Standard-Prüfende</Label>
        <p className="text-xs text-muted-foreground">
          Diese Personen sind beim Start eines Soundings vorausgewählt und bleiben änderbar.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(users.data ?? []).map((user) => (
            <label key={user.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <Checkbox
                checked={values.default_reviewer_ids.includes(user.id)}
                onCheckedChange={(checked) => toggleReviewer(user.id, checked === true)}
              />
              {user.name}
            </label>
          ))}
          {(users.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Es sind keine aktiven Personen erfasst.</p>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}
