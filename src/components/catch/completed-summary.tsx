import { useMutation } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ReconciliationCard } from "@/components/catch/reconciliation-card";
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
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-role";
import { reopenCatch } from "@/lib/catch-lifecycle";
import { reconcileCatch } from "@/lib/catch-reconciliation";
import { catchToReconciliationInput, type CatchDetail } from "@/lib/catches";
import { formatDateTime } from "@/lib/format";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

interface Props {
  item: CatchDetail;
  onChanged: () => Promise<void> | void;
}

/** Fixiertes Ergebnis eines abgeschlossenen oder abgebrochenen Catches. */
export function CompletedSummary({ item, onChanged }: Props) {
  const { canManage } = useRoles();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const result = reconcileCatch(catchToReconciliationInput(item));

  const reopen = useMutation({
    mutationFn: async () => reopenCatch(item, reason),
    onSuccess: async () => {
      setOpen(false);
      setReason("");
      toast.success("Catch wieder geöffnet", {
        description: "Die Nachkalkulation kann jetzt korrigiert werden.",
      });
      await onChanged();
    },
    onError: (error: Error) =>
      toast.error("Wiederöffnen fehlgeschlagen", { description: error.message }),
  });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {item.status === "cancelled" ? "Abbruch" : "Abschluss"}
          </CardTitle>
          <CardDescription className="text-xs">
            Die Werte sind fixiert und können nicht direkt bearbeitet werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row
            label={item.status === "cancelled" ? "Abgebrochen am" : "Abgeschlossen am"}
            value={
              item.status === "cancelled"
                ? item.cancelled_at
                  ? formatDateTime(item.cancelled_at)
                  : null
                : item.closed_at
                  ? formatDateTime(item.closed_at)
                  : null
            }
          />
          <Row
            label={item.status === "cancelled" ? "Abgebrochen von" : "Abgeschlossen von"}
            value={item.status === "cancelled" ? item.cancelled_by : item.closed_by}
          />
          <Row
            label="Bestand gezählt am"
            value={item.inventory_counted_at ? formatDateTime(item.inventory_counted_at) : null}
          />
          {item.cancellation_reason ? (
            <Row label="Abbruchgrund" value={item.cancellation_reason} />
          ) : null}
          {item.reopened_at ? (
            <>
              <Row label="Zuletzt wieder geöffnet" value={formatDateTime(item.reopened_at)} />
              <Row label="Grund der Wiederöffnung" value={item.reopen_reason} />
            </>
          ) : null}

          {canManage ? (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <RotateCcw />
              Catch wieder öffnen
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Wiederöffnen ist Editor- und Admin-Rollen vorbehalten.
            </p>
          )}
        </CardContent>
      </Card>

      <ReconciliationCard
        result={result}
        title="Ergebnis"
        description={
          item.closed_at
            ? `Fixiert am ${formatDateTime(item.closed_at)}`
            : "Für diesen Catch wurde keine Restmenge erfasst."
        }
      />

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">Learning</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {item.learning || "Kein Learning erfasst."}
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Catch wieder öffnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Catch wurde bereits abgeschlossen. Beim Wiederöffnen kann die Nachkalkulation
              geändert werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reopen-reason">Grund für das Wiederöffnen</Label>
            <Textarea
              id="reopen-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                reopen.mutate();
              }}
              disabled={reason.trim().length === 0 || reopen.isPending}
            >
              {reopen.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Wieder öffnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
