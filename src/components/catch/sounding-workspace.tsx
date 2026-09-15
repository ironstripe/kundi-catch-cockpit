/**
 * Internes Sounding: Prüfende auswählen, Teams-Nachricht kopieren, Rückmeldungen
 * verfolgen und die Runde abschliessen. Microsoft Teams ist nur der
 * Benachrichtigungskanal — verbindlich sind Cockpit und Datenbank.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCheck, ClipboardCopy, ExternalLink, Loader2, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import { fetchAppSettings } from "@/lib/app-settings";
import type { CalculationResult } from "@/lib/catch-calculation";
import type { CatchDetail } from "@/lib/catches";
import { formatDateTime } from "@/lib/format";
import {
  REVIEW_DECISION_LABELS,
  REVIEW_ROUND_STATUS_LABELS,
  buildSoundingSnapshot,
  completeSounding,
  currentRound,
  fetchActiveUsers,
  fetchReviewRounds,
  reviewUrlFor,
  soundingCompletionBlockReason,
  soundingMessage,
  soundingStartBlockReason,
  startSounding,
  type ReviewRound,
} from "@/lib/sounding";

export function SoundingWorkspace({
  item,
  calculation,
  onChanged,
}: {
  item: CatchDetail;
  calculation: CalculationResult;
  onChanged: () => void | Promise<void>;
}) {
  const { canEdit, profile } = useRoles();
  const rounds = useQuery({
    queryKey: ["review-rounds", item.id],
    queryFn: () => fetchReviewRounds(item.id),
  });
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const users = useQuery({ queryKey: ["active-users"], queryFn: fetchActiveUsers });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const defaults = settings.data?.sounding.default_reviewer_ids ?? [];
  useEffect(() => {
    if (dialogOpen) setSelected(defaults.length > 0 ? defaults : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, settings.data]);

  const readOnly = item.status !== "draft";
  const round = rounds.data ? currentRound(rounds.data) : null;
  const startBlock = soundingStartBlockReason(item.sample_check_status, calculation.complete);
  const completionBlock = soundingCompletionBlockReason(item.sample_check_status, round);

  const snapshot = useMemo(
    () => buildSoundingSnapshot(item, calculation, null),
    [item, calculation],
  );
  const reviewUrl = reviewUrlFor(
    item.id,
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const messageText = useMemo(
    () => soundingMessage(round?.snapshot ?? snapshot, reviewUrl),
    [round?.snapshot, snapshot, reviewUrl],
  );

  const teamsUrl = settings.data?.sounding.teams_chat_url ?? "";

  const start = useMutation({
    mutationFn: () => startSounding(item.id, snapshot, selected),
    onSuccess: async () => {
      setDialogOpen(false);
      toast.success("Sounding gestartet", {
        description: "Nachricht kopieren und im Teams-Gruppenchat senden.",
      });
      await rounds.refetch();
      await onChanged();
    },
    onError: (error: unknown) =>
      toast.error("Sounding konnte nicht gestartet werden", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  const complete = useMutation({
    mutationFn: () => completeSounding(round!.id),
    onSuccess: async () => {
      setConfirmOpen(false);
      toast.success("Sounding abgeschlossen", {
        description: "Der Catch kann jetzt auf «Bereit» gesetzt werden.",
      });
      await rounds.refetch();
      await onChanged();
    },
    onError: (error: unknown) =>
      toast.error("Abschluss nicht möglich", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(messageText);
      toast.success("Sounding-Nachricht kopiert");
    } catch {
      toast.error("Kopieren nicht möglich", {
        description: "Bitte den Text manuell markieren und kopieren.",
      });
    }
  }

  if (rounds.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          {round ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Runde {round.round_number}</Badge>
                <Badge
                  variant="outline"
                  className={
                    round.status === "completed"
                      ? "border-success/40 bg-success/10"
                      : round.status === "outdated" || round.status === "cancelled"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-warning/40 bg-warning/10"
                  }
                >
                  {REVIEW_ROUND_STATUS_LABELS[round.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Gestartet am {formatDateTime(round.requested_at)}
                  {round.completed_at ? ` · abgeschlossen am ${formatDateTime(round.completed_at)}` : ""}
                </span>
              </div>

              {round.status === "outdated" ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  Der Catch wurde seit dem Sounding verändert. Bitte erneut zum Sounding senden.
                </p>
              ) : null}

              <RoundDetail round={round} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Für diesen Catch wurde noch kein Sounding gestartet.
            </p>
          )}

          {canEdit && !readOnly ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                size="sm"
                disabled={Boolean(startBlock)}
                onClick={() => setDialogOpen(true)}
                title={startBlock ?? undefined}
              >
                <Send />
                {round ? "Neues Sounding senden" : "Zum Sounding senden"}
              </Button>
              {round ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => void copyMessage()}>
                    <ClipboardCopy />
                    Text kopieren
                  </Button>
                  <Button size="sm" variant="outline" asChild={Boolean(teamsUrl)} disabled={!teamsUrl}>
                    {teamsUrl ? (
                      <a href={teamsUrl} target="_blank" rel="noreferrer noopener">
                        <ExternalLink />
                        Teams öffnen
                      </a>
                    ) : (
                      <span>
                        <ExternalLink />
                        Teams öffnen
                      </span>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={Boolean(completionBlock) || round.status === "completed"}
                    title={completionBlock ?? undefined}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <CheckCheck />
                    Sounding abschliessen
                  </Button>
                </>
              ) : null}
              {startBlock ? <p className="text-xs text-muted-foreground">{startBlock}</p> : null}
              {round && completionBlock && round.status !== "completed" ? (
                <p className="text-xs text-muted-foreground">{completionBlock}</p>
              ) : null}
              {!teamsUrl ? (
                <p className="text-xs text-muted-foreground">
                  Der Teams-Gruppenchat ist noch nicht in den Einstellungen hinterlegt.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              {readOnly
                ? "Dieser Catch ist freigegeben; das Sounding ist nur noch lesbar."
                : "Das Sounding wird von Administration oder Redaktion geführt."}
            </p>
          )}
        </CardContent>
      </Card>

      {(rounds.data ?? []).length > 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Frühere Runden
          </p>
          {(rounds.data ?? []).slice(1).map((previous) => (
            <Card key={previous.id}>
              <CardContent className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Runde {previous.round_number}</Badge>
                  <Badge variant="outline">{REVIEW_ROUND_STATUS_LABELS[previous.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(previous.requested_at)}
                  </span>
                </div>
                <RoundDetail round={previous} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Zum Sounding senden</DialogTitle>
            <DialogDescription>
              Prüfende wählen, Nachricht kopieren und im Teams-Gruppenchat einfügen und senden.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <Users className="size-3.5" />
                Prüfende Personen
              </Label>
              <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                {(users.data ?? []).map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <Checkbox
                      checked={selected.includes(user.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked === true
                            ? [...current, user.id]
                            : current.filter((entry) => entry !== user.id),
                        )
                      }
                    />
                    {user.name}
                    {user.id === profile?.id ? (
                      <span className="text-xs text-muted-foreground">(du)</span>
                    ) : null}
                  </label>
                ))}
              </div>
              {selected.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Bitte mindestens eine prüfende Person auswählen.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Vorschau der internen Teams-Nachricht</Label>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
                {soundingMessage(snapshot, reviewUrl)}
              </pre>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyMessage()}
              className="w-full sm:w-auto"
            >
              <ClipboardCopy />
              Text kopieren
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              asChild={Boolean(teamsUrl)}
              disabled={!teamsUrl}
            >
              {teamsUrl ? (
                <a href={teamsUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink />
                  Teams öffnen
                </a>
              ) : (
                <span>
                  <ExternalLink />
                  Teams öffnen
                </span>
              )}
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={selected.length === 0 || start.isPending}
              onClick={() => start.mutate()}
            >
              {start.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Sounding starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sounding abschliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Rückmeldungen werden festgehalten und der Catch kann danach auf «Bereit» gesetzt
              werden. Der Status des Catches ändert sich dadurch nicht automatisch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction onClick={() => complete.mutate()}>
              Sounding abschliessen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoundDetail({ round }: { round: ReviewRound }) {
  const open = round.responses.filter(
    (response) => !round.recipients.some((recipient) => recipient.user_id === response.user_id),
  );
  void open;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Prüfende:{" "}
        {round.recipients.length > 0
          ? round.recipients.map((recipient) => recipient.user_name ?? "Unbekannt").join(", ")
          : "keine"}
      </p>
      {round.responses.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Rückmeldung erfasst.</p>
      ) : (
        <ul className="space-y-1.5">
          {round.responses.map((response) => (
            <li key={response.id} className="rounded-md border p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{response.user_name ?? "Unbekannt"}</span>
                <Badge
                  variant="outline"
                  className={
                    response.decision === "approved"
                      ? "border-success/40 bg-success/10"
                      : response.decision === "stop"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-warning/40 bg-warning/10"
                  }
                >
                  {REVIEW_DECISION_LABELS[response.decision]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(response.updated_at)}
                </span>
              </div>
              {response.comment ? (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {response.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
