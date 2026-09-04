import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import { recordAudit } from "@/lib/audit";
import {
  fetchAppSettings,
  SETTING_AUDIT_IDS,
  SETTING_KEYS,
  saveSetting,
  validateThresholds,
} from "@/lib/app-settings";
import { DEFAULT_CATCH_THRESHOLDS, type CatchThresholds } from "@/lib/catch-thresholds";

const FIELDS: { key: keyof CatchThresholds; label: string }[] = [
  { key: "minimum_green_margin", label: "Minimale Rohmarge für grünen Catch" },
  { key: "minimum_green_discount", label: "Minimaler Preisvorteil für grünen Catch" },
  { key: "maximum_green_break_even", label: "Maximaler Break-even-Abverkauf für grünen Catch" },
  { key: "maximum_orange_break_even", label: "Maximaler Break-even-Abverkauf für orange Bewertung" },
];

export function ThresholdsSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const [values, setValues] = useState<CatchThresholds>(DEFAULT_CATCH_THRESHOLDS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setValues(settings.data.thresholds);
  }, [settings.data]);

  const mutation = useMutation({
    mutationFn: async (next: CatchThresholds) => {
      const current = settings.data;
      if (!current) return;
      await saveSetting(SETTING_KEYS.thresholds, { ...next }, current.thresholds_version);
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[SETTING_KEYS.thresholds]!,
        action: "thresholds_updated",
        previous: { ...current.thresholds },
        next: { ...next },
        summary: "Kalkulationsregeln geändert",
      });
    },
    onSuccess: async () => {
      toast.success("Kalkulationsregeln gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: () => toast.error("Die Kalkulationsregeln konnten nicht gespeichert werden."),
  });

  if (!isAdmin) return <NoAccess />;
  if (settings.isLoading) return <Skeleton className="h-64 w-full" />;

  function save(next: CatchThresholds) {
    const message = validateThresholds(next);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setValues(next);
    mutation.mutate(next);
  }

  return (
    <SectionShell
      title="Kalkulationsregeln"
      description="Schwellenwerte der Catch-Ampel. Alle Berechnungen im Cockpit verwenden diese zentralen Werte."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>{field.label}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={field.key}
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={values[field.key]}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: Number(event.target.value) })
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(values)} disabled={mutation.isPending}>
          Änderungen speichern
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Auf Standardwerte zurücksetzen</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kalkulationsregeln zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Die Werte werden auf 15 %, 25 %, 85 % und 95 % zurückgesetzt. Bestehende Catches
                behalten ihre gespeicherten Ausgangsdaten.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => save({ ...DEFAULT_CATCH_THRESHOLDS })}>
                Zurücksetzen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SectionShell>
  );
}
