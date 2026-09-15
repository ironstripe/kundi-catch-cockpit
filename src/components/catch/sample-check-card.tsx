/**
 * Musterprüfung: Ergebnis der offline durchgeführten Prüfung eines
 * aufgetauten Produktmusters. Person und Zeitpunkt setzt die Datenbank.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import type { CatchDetail } from "@/lib/catches";
import { formatDateTime } from "@/lib/format";
import { SAMPLE_CHECK_LABELS, recordSampleCheck } from "@/lib/sounding";

async function fetchPersonName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.name ?? data?.email ?? null;
}

export function SampleCheckCard({
  item,
  onChanged,
  readOnly = false,
}: {
  item: CatchDetail;
  onChanged: () => void | Promise<void>;
  readOnly?: boolean;
}) {
  const { canEdit } = useRoles();
  const [note, setNote] = useState("");
  const editable = canEdit && !readOnly;

  const checker = useQuery({
    queryKey: ["profile-name", item.sample_checked_by],
    queryFn: () => fetchPersonName(item.sample_checked_by),
    enabled: Boolean(item.sample_checked_by),
  });

  const record = useMutation({
    mutationFn: (status: "passed" | "failed") => recordSampleCheck(item.id, status, note),
    onSuccess: async () => {
      setNote("");
      toast.success("Musterprüfung erfasst", {
        description: "Person und Zeitpunkt wurden automatisch festgehalten.",
      });
      await onChanged();
    },
    onError: (error: unknown) =>
      toast.error("Erfassen fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  const status = item.sample_check_status;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FlaskConical className="size-4" />
          Musterprüfung
        </CardTitle>
        <CardDescription className="text-xs">
          Vor dem internen Sounding muss ein aufgetautes Produktmuster geprüft werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              status === "passed"
                ? "border-success/40 bg-success/10 text-success-foreground"
                : status === "failed"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-warning/40 bg-warning/10"
            }
          >
            {SAMPLE_CHECK_LABELS[status]}
          </Badge>
          {status !== "pending" ? (
            <span className="text-xs text-muted-foreground">
              Geprüft von: {checker.data ?? "unbekannt"}
              {item.sample_checked_at
                ? ` · Geprüft am: ${formatDateTime(item.sample_checked_at)}`
                : ""}
            </span>
          ) : null}
        </div>

        {status !== "pending" && item.sample_check_note ? (
          <p className="whitespace-pre-line rounded-md border bg-muted/30 p-2 text-sm">
            Bemerkung: {item.sample_check_note}
          </p>
        ) : null}

        {status === "failed" ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            Die Musterprüfung wurde nicht bestanden. Dieser Catch kann nicht freigegeben werden.
          </p>
        ) : null}

        {editable ? (
          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="sample_check_note" className="text-xs">
              Bemerkung (optional)
            </Label>
            <Textarea
              id="sample_check_note"
              rows={2}
              maxLength={600}
              value={note}
              placeholder="Geschmack, Konsistenz, Auffälligkeiten"
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={record.isPending} onClick={() => record.mutate("passed")}>
                {record.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Bestanden
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={record.isPending}
                onClick={() => record.mutate("failed")}
              >
                <XCircle />
                Nicht bestanden
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ein Ergebnis kann korrigiert werden; jede Änderung wird protokolliert.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? "Dieser Catch ist freigegeben; die Musterprüfung ist nur noch lesbar."
              : "Das Ergebnis wird von Administration oder Redaktion erfasst."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
