import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";

import { SectionShell } from "@/components/settings/section-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { fetchInboundLog, OUTCOME_LABELS } from "@/lib/supplier-offers";
import { getInboundConfigStatus } from "@/lib/supplier-offers.functions";

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 text-success" aria-hidden />
      ) : (
        <XCircle className="size-4 text-destructive" aria-hidden />
      )}
      {label}
    </span>
  );
}

/** Admin-Diagnose: Ist der Angebotseingang eingerichtet und was kam an? */
export function InboundDiagnosticsSection() {
  const config = useQuery({
    queryKey: ["inbound-config"],
    queryFn: () => getInboundConfigStatus(),
  });
  const log = useQuery({ queryKey: ["inbound-log"], queryFn: () => fetchInboundLog(50) });

  return (
    <div className="space-y-4">
      <SectionShell
        title="Angebotseingang — Einrichtung"
        description="Zentrale Adresse, Webhook-Adresse und hinterlegte Zugangsdaten."
      >
        {config.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : config.data ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Zentrale Adresse: </span>
              <code className="rounded bg-muted px-1.5 py-0.5">{config.data.inbound_address}</code>
            </p>
            <p className="break-all">
              <span className="text-muted-foreground">Webhook-Adresse: </span>
              <code className="rounded bg-muted px-1.5 py-0.5">{config.data.webhook_url}</code>
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              <Flag ok={config.data.webhook_secret_configured} label="Webhook-Schlüssel gesetzt" />
              <Flag ok={config.data.api_key_configured} label="Resend-Zugang gesetzt" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Die Diagnose ist nicht verfügbar.</p>
        )}
      </SectionShell>

      <SectionShell
        title="Zustellprotokoll"
        description="Die letzten 50 eingegangenen Zustellungen mit Ergebnis — auch abgewiesene."
        contentClassName="p-0"
      >
        {log.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : (log.data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Es sind noch keine Zustellungen eingegangen.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeit</TableHead>
                <TableHead>Von</TableHead>
                <TableHead>An</TableHead>
                <TableHead>Betreff</TableHead>
                <TableHead>Ergebnis</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(log.data ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(entry.received_at)}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-sm">
                    {entry.from_address ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-sm">
                    {entry.recipients ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm">
                    {entry.offer_id ? (
                      <Link
                        to="/offers/$offerId"
                        params={{ offerId: entry.offer_id }}
                        className="underline underline-offset-2"
                      >
                        {entry.subject ?? "(kein Betreff)"}
                      </Link>
                    ) : (
                      (entry.subject ?? "—")
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.outcome === "processed"
                          ? "secondary"
                          : entry.outcome.includes("fail") || entry.outcome === "invalid_signature"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {OUTCOME_LABELS[entry.outcome] ?? entry.outcome}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                    {entry.detail ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionShell>
    </div>
  );
}
