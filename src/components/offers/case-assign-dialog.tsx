import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CASE_STATUS_LABELS, fetchCaseOptions } from "@/lib/offer-cases";

/**
 * Auswahl eines Ziel-Angebotsdossiers. Es gibt keine automatische Zuordnung —
 * die Verbindung entsteht immer durch diese bewusste Handlung.
 */
export function CaseAssignDialog({
  open,
  onOpenChange,
  title,
  description,
  excludeCaseId,
  confirmLabel,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  excludeCaseId: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (targetCaseId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["offer-case-options", excludeCaseId],
    queryFn: () => fetchCaseOptions(excludeCaseId),
    enabled: open,
  });

  const needle = search.trim().toLowerCase();
  const options = (data ?? []).filter(
    (option) =>
      !needle ||
      option.title.toLowerCase().includes(needle) ||
      (option.supplier_name ?? "").toLowerCase().includes(needle),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nach Titel oder Lieferant suchen"
          aria-label="Angebotsdossier suchen"
        />

        <div className="max-h-72 space-y-2 overflow-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Dossiers werden geladen …</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kein passendes Angebotsdossier gefunden.
            </p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                aria-pressed={selected === option.id}
                className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/60 ${
                  selected === option.id ? "border-primary bg-muted/60" : ""
                }`}
              >
                <span className="block font-medium">{option.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {option.supplier_name ?? "Lieferant unbekannt"} ·{" "}
                  {CASE_STATUS_LABELS[option.status]} · {option.email_count} E-Mail(s)
                </span>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button disabled={!selected || busy} onClick={() => selected && onConfirm(selected)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
