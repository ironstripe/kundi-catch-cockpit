import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRoles } from "@/hooks/use-role";
import type { CatchDetail } from "@/lib/catches";
import { recordQualityCheck } from "@/lib/sounding";

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
  const [error, setError] = useState<string | null>(null);
  const editable = canEdit && !readOnly && item.status !== "closed" && item.status !== "cancelled";
  const record = useMutation({
    mutationFn: (checked: boolean) => recordQualityCheck(item.id, checked),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (failure: unknown) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Speichern fehlgeschlagen. Bitte erneut versuchen.",
      ),
  });
  // No optimistic fabrication: legacy failed/pending remain untouched until a deliberate click.
  const checked = item.sample_check_status === "passed";
  return (
    <div className="space-y-1">
      <label className="flex min-h-11 items-center gap-2 text-sm lg:min-h-9">
        <Checkbox
          checked={checked}
          disabled={!editable || record.isPending}
          onCheckedChange={(value) => {
            if (editable && !record.isPending) record.mutate(value === true);
          }}
        />
        Qualität geprüft <span className="font-semibold">{checked ? "Ja" : "Nein"}</span>
      </label>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error} Erneut anklicken zum Wiederholen.
        </p>
      ) : null}
    </div>
  );
}
