/** Einstellungen-Tab: Excel-Datenexport und Backup-Webhook (nur Admin). */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "@/components/settings/section-shell";
import { supabase } from "@/integrations/supabase/client";
import { buildExportWorkbook, EXPORT_BUCKET } from "@/lib/export-workbook";
import { getBackupStatus, sendBackupWebhook } from "@/lib/backup.functions";
import { recordAudit } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

function statusLabel(configured: boolean, status?: string | null) {
  if (!configured) return { label: "Noch nicht eingerichtet", tone: "muted" as const };
  if (status === "success") return { label: "Erfolgreich", tone: "ok" as const };
  if (status === "failed") return { label: "Fehlgeschlagen", tone: "bad" as const };
  return { label: "Bereit", tone: "muted" as const };
}

export function ExportSection() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<string | null>(null);
  const status = useServerFn(getBackupStatus);
  const backup = useServerFn(sendBackupWebhook);

  const statusQuery = useQuery({
    queryKey: ["backup-status"],
    queryFn: () => status(),
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const { blob, fileName } = await buildExportWorkbook(setProgress);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      await recordAudit({
        entityType: "settings",
        entityId: "export",
        action: "export_created",
        summary: `Excel-Export erstellt: ${fileName}`,
      });
      return fileName;
    },
    onSuccess: (fileName) => toast.success(`Export erstellt: ${fileName}`),
    onError: () => toast.error("Der Export konnte nicht erstellt werden."),
    onSettled: () => setProgress(null),
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      const { blob, fileName } = await buildExportWorkbook(setProgress);
      setProgress("Datei wird gesichert …");
      const path = `${new Date().toISOString().slice(0, 10)}/${fileName}`;
      const { error } = await supabase.storage.from(EXPORT_BUCKET).upload(path, blob, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
      if (error) throw error;
      setProgress("Backup wird gemeldet …");
      return backup({ data: { path, fileName } });
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Backup erfolgreich übermittelt.");
      } else if (result.reason === "not_configured") {
        toast.error("Es ist keine Backup-Adresse hinterlegt.");
      } else {
        toast.error("Das Backup konnte nicht übermittelt werden.");
      }
      void queryClient.invalidateQueries({ queryKey: ["backup-status"] });
    },
    onError: () => toast.error("Das Backup konnte nicht erstellt werden."),
    onSettled: () => setProgress(null),
  });

  const busy = downloadMutation.isPending || backupMutation.isPending;
  const configured = statusQuery.data?.configured ?? false;
  const lastRun = statusQuery.data?.last_run ?? null;
  const state = statusLabel(configured, lastRun?.status);

  return (
    <div className="space-y-6">
      <SectionShell
        title="Datenexport"
        description="Vollständiger Excel-Export aller Catches, Stammdaten, Nutzer und Protokolleinträge. Kennzahlen entsprechen exakt den Werten im Cockpit."
        action={
          <Button onClick={() => downloadMutation.mutate()} disabled={busy}>
            <Download className="size-4" />
            Export herunterladen
          </Button>
        }
      >
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Tabellenblätter: Catches, Lieferanten, Standorte, Kategorien, Nutzer, Audit Log</li>
          <li>Beträge in CHF, Prozentwerte mit einer Dezimalstelle, Datumsangaben als Excel-Datum</li>
          <li>Mengen immer mit Einheit in derselben Zeile</li>
        </ul>
        {progress ? <p className="text-sm text-muted-foreground">{progress}</p> : null}
      </SectionShell>

      <SectionShell
        title="Backup"
        description="Erstellt denselben Export und übermittelt ihn über einen kurzlebigen Download-Link (15 Minuten) an die hinterlegte Backup-Adresse."
        action={
          <Button
            variant="outline"
            onClick={() => backupMutation.mutate()}
            disabled={busy || !configured}
          >
            <RefreshCw className="size-4" />
            Backup jetzt testen
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={state.tone === "bad" ? "destructive" : "secondary"}>
            <ShieldCheck className="size-3.5" />
            {backupMutation.isPending ? "Wird erstellt …" : state.label}
          </Badge>
          {lastRun ? (
            <span className="text-sm text-muted-foreground">
              Letzter Versuch: {formatDateTime(lastRun.attempted_at)} · {lastRun.file_name}
              {lastRun.error_summary ? ` · ${lastRun.error_summary}` : ""}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Bisher kein Backup ausgeführt.</span>
          )}
        </div>
        {!configured ? (
          <p className="text-sm text-muted-foreground">
            Sobald eine Backup-Adresse hinterlegt ist, kann der automatische Versand getestet werden.
          </p>
        ) : null}
      </SectionShell>
    </div>
  );
}
