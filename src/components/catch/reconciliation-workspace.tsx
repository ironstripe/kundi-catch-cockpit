import { useMutation } from "@tanstack/react-query";
import { Ban, CheckCircle2, Loader2, Scale } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-role";
import { parseNumberInput } from "@/lib/catch-calculation";
import { cancelCatch, closeCatch } from "@/lib/catch-lifecycle";
import { reconcileCatch, isIntegerUnit } from "@/lib/catch-reconciliation";
import { catchToCalculationInput, type CatchDetail } from "@/lib/catches";
import {
  formatCurrency,
  formatDateTime,
  formatQuantity,
  formatPercentValue,
  isoToZurichLocal,
  zurichLocalToIso,
} from "@/lib/format";

function SourceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 text-sm last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

interface Props {
  item: CatchDetail;
  onChanged: () => Promise<void> | void;
}

/** Nachkalkulation für einen publizierten Catch. */
export function ReconciliationWorkspace({ item, onChanged }: Props) {
  const { canManage } = useRoles();
  const [remaining, setRemaining] = useState(
    item.remaining_quantity === null ? "" : String(item.remaining_quantity),
  );
  const [countedAt, setCountedAt] = useState(
    isoToZurichLocal(item.inventory_counted_at ?? new Date().toISOString()),
  );
  const [learning, setLearning] = useState(item.learning ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [touched, setTouched] = useState(false);

  const remainingValue = parseNumberInput(remaining);
  const countedIso = countedAt ? zurichLocalToIso(countedAt) : null;

  const result = useMemo(
    () =>
      reconcileCatch({
        ...catchToCalculationInput(item),
        remaining_quantity: remainingValue,
        published_at: item.published_at,
        inventory_counted_at: countedIso,
      }),
    [item, remainingValue, countedIso],
  );

  const step = isIntegerUnit(item.quantity_unit) ? "1" : "0.01";

  const close = useMutation({
    mutationFn: async () => {
      if (!result.values) throw new Error("Ungültige Restmenge");
      await closeCatch({
        item,
        remainingQuantity: result.values.remaining_quantity,
        inventoryCountedAt: countedIso ?? new Date().toISOString(),
        learning,
        result: {
          sold_quantity: result.values.sold_quantity,
          sell_through_percentage: result.values.sell_through_percentage,
          effective_revenue: result.values.effective_revenue,
          effective_contribution_margin: result.values.effective_contribution_margin,
          remaining_inventory_value: result.values.remaining_inventory_value,
          break_even: result.break_even,
        },
      });
    },
    onSuccess: async () => {
      setConfirmOpen(false);
      toast.success("Catch abgeschlossen", {
        description: "Die Nachkalkulation ist fixiert und der Catch liegt in der Historie.",
      });
      await onChanged();
    },
    onError: (error: Error) => {
      toast.error("Abschluss fehlgeschlagen", { description: error.message });
    },
  });

  const cancel = useMutation({
    mutationFn: async () => cancelCatch(item, cancelReason),
    onSuccess: async () => {
      setCancelOpen(false);
      toast.success("Catch abgebrochen");
      await onChanged();
    },
    onError: (error: Error) => {
      toast.error("Abbruch fehlgeschlagen", { description: error.message });
    },
  });

  const canClose = result.complete && countedIso !== null;
  const v = result.values;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nachkalkulation erfassen</CardTitle>
          <CardDescription className="text-xs">
            Die verkaufte Menge ergibt sich aus Einkaufsmenge minus effektiver Restmenge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Ausgangswerte
            </p>
            <SourceRow label="Catch-Nummer" value={item.catch_number ?? "—"} />
            <SourceRow label="Produkt" value={item.product_name} />
            <SourceRow
              label="Produktart"
              value={item.temperature === "frozen" ? "TK" : "Frisch"}
            />
            <SourceRow
              label="Einkaufsmenge"
              value={formatQuantity(item.purchase_quantity, item.quantity_unit)}
            />
            <SourceRow
              label="Einkaufspreis pro Einheit"
              value={item.purchase_price === null ? "—" : formatCurrency(item.purchase_price)}
            />
            <SourceRow
              label="Lieferkosten"
              value={
                item.delivery_included
                  ? "Im Einkaufspreis enthalten"
                  : formatCurrency(item.delivery_cost)
              }
            />
            <SourceRow
              label="Kundi-Catch-Preis"
              value={
                item.catch_price === null
                  ? "—"
                  : `${formatCurrency(item.catch_price)} / ${item.quantity_unit}`
              }
            />
            <SourceRow
              label="Publiziert am"
              value={item.published_at ? formatDateTime(item.published_at) : "Publikationszeitpunkt fehlt"}
            />
            <SourceRow
              label="Abholorte"
              value={item.location_names.length > 0 ? item.location_names.join(", ") : "—"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remaining-quantity">Effektive Restmenge</Label>
            <div className="flex items-center gap-2">
              <Input
                id="remaining-quantity"
                type="number"
                inputMode="decimal"
                min={0}
                max={item.purchase_quantity}
                step={step}
                value={remaining}
                onChange={(event) => {
                  setRemaining(event.target.value);
                  setTouched(true);
                }}
                aria-invalid={touched && result.errors.length > 0}
                aria-describedby="remaining-help"
              />
              <span className="text-sm text-muted-foreground">{item.quantity_unit}</span>
            </div>
            <p id="remaining-help" className="text-xs text-muted-foreground">
              Restbestand nach Abschluss der Aktion und vor Umlagerung, interner Verwendung oder
              Entsorgung zählen.
            </p>
            {touched && result.errors.length > 0 ? (
              <ul className="space-y-0.5 text-xs text-destructive">
                {result.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="counted-at">Bestand gezählt am</Label>
            <Input
              id="counted-at"
              type="datetime-local"
              value={countedAt}
              onChange={(event) => setCountedAt(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Zeitzone Europe/Zurich ·{" "}
              {countedIso ? formatDateTime(countedIso) : "Zeitpunkt erforderlich"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="learning">Learning für den nächsten Catch</Label>
            <Textarea
              id="learning"
              rows={3}
              maxLength={500}
              value={learning}
              onChange={(event) => setLearning(event.target.value)}
              placeholder="Was würden wir beim nächsten Mal gleich oder anders machen?"
            />
            <p className="text-xs text-muted-foreground">
              Optional, empfohlen maximal 500 Zeichen · {learning.length}/500
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!canClose} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 />
              Catch definitiv abschliessen
            </Button>
            {canManage ? (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <Ban />
                Catch abbrechen
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ReconciliationCard
        result={result}
        title="Live-Vorschau"
        description="Aktualisiert sich mit jeder Eingabe. Fixiert wird erst beim Abschluss."
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Catch definitiv abschliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Mit dem Abschluss wird die Nachkalkulation fixiert und der Catch in die Historie
              verschoben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {v ? (
            <dl className="space-y-1 rounded-md border bg-muted/20 p-3 text-sm">
              <SourceRow
                label="Einkaufsmenge"
                value={formatQuantity(v.purchase_quantity, v.quantity_unit)}
              />
              <SourceRow
                label="Restmenge"
                value={formatQuantity(v.remaining_quantity, v.quantity_unit)}
              />
              <SourceRow
                label="Verkaufte Menge"
                value={formatQuantity(v.sold_quantity, v.quantity_unit)}
              />
              <SourceRow
                label="Abverkaufsquote"
                value={
                  v.sell_through_percentage === null
                    ? "—"
                    : formatPercentValue(v.sell_through_percentage)
                }
              />
              <SourceRow label="Effektiver Umsatz" value={formatCurrency(v.effective_revenue)} />
              <SourceRow
                label="Effektiver DB"
                value={formatCurrency(v.effective_contribution_margin)}
              />
            </dl>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                close.mutate();
              }}
              disabled={close.isPending}
            >
              {close.isPending ? <Loader2 className="animate-spin" /> : <Scale />}
              Definitiv abschliessen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Catch abbrechen?</AlertDialogTitle>
            <AlertDialogDescription>
              Ein abgebrochener Catch erscheint in der Historie und fliesst nicht in die
              Abverkaufs- und Finanzdurchschnitte ein.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Grund für den Abbruch</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                cancel.mutate();
              }}
              disabled={cancelReason.trim().length === 0 || cancel.isPending}
            >
              {cancel.isPending ? <Loader2 className="animate-spin" /> : <Ban />}
              Catch abbrechen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
