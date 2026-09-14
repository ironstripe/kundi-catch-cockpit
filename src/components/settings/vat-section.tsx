import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import { fetchAppSettings, SETTING_AUDIT_IDS, SETTING_KEYS, saveSetting } from "@/lib/app-settings";
import { recordAudit } from "@/lib/audit";
import {
  DEFAULT_VAT_RATE,
  parseVatRate,
  validateVatRate,
  VAT_RATE_OPTIONS,
  type VatSettings,
} from "@/lib/vat";

export function VatSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const [rate, setRate] = useState<string>(String(DEFAULT_VAT_RATE));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setRate(String(settings.data.vat.rate));
  }, [settings.data]);

  const mutation = useMutation({
    mutationFn: async (next: VatSettings) => {
      const current = settings.data;
      if (!current) return;
      await saveSetting(SETTING_KEYS.vat, { ...next }, current.vat_version);
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[SETTING_KEYS.vat]!,
        action: "vat_updated",
        previous: { ...current.vat },
        next: { ...next },
        summary: "Mehrwertsteuersatz geändert",
      });
    },
    onSuccess: async () => {
      toast.success("Mehrwertsteuersatz gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["catches"] });
    },
    onError: () => toast.error("Der Mehrwertsteuersatz konnte nicht gespeichert werden."),
  });

  if (!isAdmin) return <NoAccess />;
  if (settings.isLoading) return <Skeleton className="h-48 w-full" />;

  function save() {
    const parsed = parseVatRate(rate);
    const message = parsed === null ? "Bitte einen Mehrwertsteuersatz erfassen." : validateVatRate(parsed);
    if (message || parsed === null) {
      setError(message ?? "Bitte einen Mehrwertsteuersatz erfassen.");
      return;
    }
    setError(null);
    mutation.mutate({ rate: parsed });
  }

  return (
    <SectionShell
      title="Mehrwertsteuer"
      description="Standardsatz für neue Catches. Kundenpreise sind immer Bruttopreise inklusive MWST; Umsatz und Deckungsbeitrag werden netto gerechnet."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vat-rate">Standardsatz für neue Catches</Label>
          <div className="flex items-center gap-2">
            <Input
              id="vat-rate"
              type="number"
              min={0}
              max={99.9}
              step="0.1"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Übliche Schweizer Sätze: {VAT_RATE_OPTIONS.map((option) => option.label).join(" · ")}
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={mutation.isPending}>
          Änderungen speichern
        </Button>
        <Button variant="outline" onClick={() => setRate(String(DEFAULT_VAT_RATE))}>
          Auf {DEFAULT_VAT_RATE} % zurücksetzen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Abgeschlossene Catches behalten ihre gespeicherten Werte.
      </p>
    </SectionShell>
  );
}
