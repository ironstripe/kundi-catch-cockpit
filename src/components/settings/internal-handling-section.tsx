import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import {
  DEFAULT_INTERNAL_HANDLING_COST,
  fetchAppSettings,
  parseInternalHandlingInput,
  SETTING_AUDIT_IDS,
  SETTING_KEYS,
  saveSetting,
  validateInternalHandlingDefault,
  type CalculationDefaults,
} from "@/lib/app-settings";
import { recordAudit } from "@/lib/audit";

const INCLUDED = [
  "Wareneingang",
  "interner Transport",
  "Vorbereitung des Produkts",
  "Umpacken",
  "Etikettierung",
  "catchbezogene Administration",
  "direktes Verpackungs- und Etikettenmaterial",
];

const EXCLUDED = [
  "allgemeine Miete",
  "allgemeine Energiekosten",
  "allgemeine Administration",
  "normale Ladenarbeit im Verkauf",
  "allgemeines Marketing",
  "Frequenzeffekte",
  "Cross-Selling-Effekte",
  "übrige Gemeinkosten",
];

export function InternalHandlingSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const [rate, setRate] = useState<string>(DEFAULT_INTERNAL_HANDLING_COST.toFixed(2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setRate(settings.data.calculation_defaults.internal_handling_cost_per_unit.toFixed(2));
    }
  }, [settings.data]);

  const mutation = useMutation({
    mutationFn: async (next: CalculationDefaults) => {
      const current = settings.data;
      if (!current) return;
      await saveSetting(
        SETTING_KEYS.calculationDefaults,
        { ...next },
        current.calculation_defaults_version,
      );
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[SETTING_KEYS.calculationDefaults]!,
        action: "calculation_defaults_updated",
        previous: { ...current.calculation_defaults },
        next: { ...next },
        summary: "Standardwert interner Aufwand geändert",
      });
    },
    onSuccess: async () => {
      toast.success("Standardwert gespeichert.", {
        description: "Der Wert gilt für neu erfasste Catches.",
      });
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: () => toast.error("Der Standardwert konnte nicht gespeichert werden."),
  });

  if (!isAdmin) {
    if (settings.isLoading) return <Skeleton className="h-40 w-full" />;
    return (
      <SectionShell
        title="Interner Aufwand"
        description="Standardwert für direkt zurechenbare Logistik, Bereitstellung, Etikettierung und Verpackung eines Food Catches."
      >
        <p className="text-sm">
          Standard pro vorbereitete Einheit:{" "}
          <span className="font-semibold">
            CHF{" "}
            {(
              settings.data?.calculation_defaults.internal_handling_cost_per_unit ??
              DEFAULT_INTERNAL_HANDLING_COST
            ).toFixed(2)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Diesen Standardwert ändert die Administration. Pro Catch kann die Redaktion den Wert
          überschreiben.
        </p>
      </SectionShell>
    );
  }

  if (settings.isLoading) return <Skeleton className="h-48 w-full" />;

  function save() {
    const parsed = parseInternalHandlingInput(rate);
    const message = validateInternalHandlingDefault(parsed);
    if (message || parsed === null) {
      setError(message ?? "Bitte einen Standardwert in CHF erfassen.");
      return;
    }
    setError(null);
    mutation.mutate({ internal_handling_cost_per_unit: parsed });
  }

  return (
    <SectionShell
      title="Interner Aufwand"
      description="Standardwert für direkt zurechenbare Logistik, Bereitstellung, Etikettierung und Verpackung eines Food Catches."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="internal-handling-default">Standard pro vorbereitete Einheit</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">CHF</span>
            <Input
              id="internal-handling-default"
              type="number"
              min={0}
              step="0.05"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Dieser Wert wird bei neuen Catches als Ausgangswert übernommen und kann pro Catch
            angepasst werden. Änderungen wirken nicht rückwirkend.
          </p>
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="text-xs font-medium underline underline-offset-4">
          Was ist im internen Aufwand enthalten?
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Enthalten:</span> {INCLUDED.join(", ")}.
          </p>
          <p>
            <span className="font-medium text-foreground">Nicht enthalten:</span>{" "}
            {EXCLUDED.join(", ")}.
          </p>
        </CollapsibleContent>
      </Collapsible>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={mutation.isPending}>
          Änderungen speichern
        </Button>
        <Button
          variant="outline"
          onClick={() => setRate(DEFAULT_INTERNAL_HANDLING_COST.toFixed(2))}
        >
          Auf CHF {DEFAULT_INTERNAL_HANDLING_COST.toFixed(2)} zurücksetzen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Bestehende und abgeschlossene Catches behalten ihren gespeicherten Wert.
      </p>
    </SectionShell>
  );
}
