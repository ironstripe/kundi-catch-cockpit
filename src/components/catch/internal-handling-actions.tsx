import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/use-role";
import { fetchAppSettings } from "@/lib/app-settings";
import { applyInternalHandlingDefault, type CatchDetail } from "@/lib/catches";

interface InternalHandlingActionsProps {
  item: CatchDetail;
  onChanged: () => Promise<void> | void;
}

/**
 * Aktionen zum internen Aufwand in der Kalkulationskarte:
 * Standardwert übernehmen (nur bei fehlendem Wert) oder Wert bearbeiten.
 * Die Rechteprüfung erfolgt verbindlich über RLS.
 */
export function InternalHandlingActions({ item, onChanged }: InternalHandlingActionsProps) {
  const { canEdit } = useRoles();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const defaultRate = settings.data?.calculation_defaults.internal_handling_cost_per_unit ?? null;
  const editable = item.status !== "closed" && item.status !== "cancelled";
  const missing = item.internal_handling_cost_per_unit === null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (defaultRate === null) throw new Error("Standardwert nicht verfügbar.");
      await applyInternalHandlingDefault(item.id, defaultRate);
    },
    onSuccess: async () => {
      toast.success("Standardwert übernommen.", {
        description: "DB II wird ab jetzt mit diesem Wert gerechnet.",
      });
      await onChanged();
    },
    onError: (error) =>
      toast.error("Der Standardwert konnte nicht übernommen werden.", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      }),
  });

  if (!canEdit || !editable) return null;

  if (missing) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={mutation.isPending || defaultRate === null}
        onClick={() => mutation.mutate()}
      >
        <Wand2 />
        {defaultRate === null
          ? "Standardwert wird geladen"
          : `Standardwert CHF ${defaultRate.toFixed(2)} übernehmen`}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/catches/$catchId/edit" params={{ catchId: item.id }} hash="interner-aufwand">
        <Pencil />
        Internen Aufwand bearbeiten
      </Link>
    </Button>
  );
}
