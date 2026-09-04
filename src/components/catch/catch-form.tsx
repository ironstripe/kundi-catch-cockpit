import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CatchImageField } from "@/components/catch/catch-image-field";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  HANDICAP_REASONS,
  HANDICAP_REASON_LABELS,
  HANDICAP_REASON_SENTENCES,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  TEMPERATURE_LABELS,
  type HandicapReason,
  type Temperature,
} from "@/lib/catch-domain";
import { validateDraft, validateReady, type FieldIssue } from "@/lib/catch-validation";
import { fetchLocations, fetchSuppliers, saveCatch, type CatchFormValues } from "@/lib/catches";
import { isoToZurichLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CatchFormProps {
  mode: "create" | "edit";
  catchId?: string;
  initialValues: CatchFormValues;
  initialImagePath: string | null;
  onSaved: (catchId: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  product_name: "Produktname",
  product_image: "Produktbild",
  supplier_id: "Lieferant",
  purchase_quantity: "Einkaufsmenge",
  purchase_price: "Einkaufspreis pro Einheit",
  delivery_cost: "Lieferkosten",
  regular_price: "Normalpreis",
  catch_price: "Kundi-Catch-Preis",
  location_ids: "Abholort",
  available_from: "Verfügbar ab",
  available_until: "Verfügbar bis",
  handicap_reason: "Grund für den Catch",
  handicap_story: "Handicap-Story",
};

export function CatchForm({
  mode,
  catchId,
  initialValues,
  initialImagePath,
  onSaved,
}: CatchFormProps) {
  const navigate = useNavigate();

  const baseline = useMemo(
    () => ({
      ...initialValues,
      available_from: isoToZurichLocal(initialValues.available_from),
      available_until: isoToZurichLocal(initialValues.available_until),
    }),
    [initialValues],
  );

  const [values, setValues] = useState<CatchFormValues>(baseline);
  const [imagePath, setImagePath] = useState<string | null>(initialImagePath);
  const [uploading, setUploading] = useState(false);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [storyTouched, setStoryTouched] = useState(Boolean(initialValues.handicap_story));
  const savedRef = useRef(false);

  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const locations = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const dirty =
    JSON.stringify(values) !== JSON.stringify(baseline) || imagePath !== initialImagePath;

  function set<K extends keyof CatchFormValues>(key: K, value: CatchFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function issueFor(field: string) {
    return issues.find((issue) => issue.field === field)?.message;
  }

  function focusFirst(list: FieldIssue[]) {
    const first = list[0];
    if (!first) return;
    const element = document.getElementById(first.field);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    (element as HTMLElement | null)?.focus?.();
  }

  async function persist(status: "draft" | "ready") {
    const found = status === "draft" ? validateDraft(values) : validateReady(values, Boolean(imagePath));
    setIssues(found);
    if (found.length > 0) {
      focusFirst(found);
      if (status === "draft") {
        toast.error("Entwurf unvollständig", {
          description: "Ein Entwurf braucht mindestens einen Produktnamen.",
        });
      }
      return;
    }

    setSaving(true);
    try {
      const id = await saveCatch({ id: catchId, values, status });
      await syncImage(id);
      savedRef.current = true;
      toast.success(
        status === "draft"
          ? mode === "create"
            ? "Entwurf angelegt"
            : "Änderungen gespeichert"
          : "Catch ist bereit",
        { description: `Zeitstempel und Nutzer wurden erfasst.` },
      );
      onSaved(id);
    } catch (error) {
      toast.error("Speichern fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function syncImage(id: string) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: existing } = await supabase
      .from("catch_images")
      .select("id, storage_path")
      .eq("catch_id", id);

    const rows = existing ?? [];
    if (!imagePath) {
      if (rows.length > 0) {
        await supabase
          .from("catch_images")
          .delete()
          .in("id", rows.map((row) => row.id));
      }
      return;
    }
    if (rows.some((row) => row.storage_path === imagePath)) return;

    if (rows.length > 0) {
      await supabase
        .from("catch_images")
        .delete()
        .in("id", rows.map((row) => row.id));
    }
    await supabase
      .from("catch_images")
      .insert({ catch_id: id, storage_path: imagePath, is_primary: true, sort_order: 0 });
  }

  function handleLeave() {
    if (dirty && !savedRef.current) {
      setLeaveOpen(true);
      return;
    }
    leaveNow();
  }

  function leaveNow() {
    if (mode === "edit" && catchId) {
      void navigate({ to: "/catches/$catchId", params: { catchId } });
    } else {
      void navigate({ to: "/" });
    }
  }

  return (
    <>
      {issues.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-4" />
            {issues.length === 1
              ? "Ein Feld muss noch ergänzt werden"
              : `${issues.length} Felder müssen noch ergänzt werden`}
          </p>
          <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-muted-foreground">
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>
                <button
                  type="button"
                  className="text-left underline-offset-4 hover:underline"
                  onClick={() => focusFirst([issue])}
                >
                  <span className="font-medium text-foreground">
                    {FIELD_LABELS[issue.field] ?? issue.field}:
                  </span>{" "}
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <FormSection title="Produkt" description="Was wird als Catch angeboten?">
            <Field label="Produktname" required error={issueFor("product_name")}>
              <Input
                id="product_name"
                value={values.product_name}
                maxLength={120}
                aria-invalid={Boolean(issueFor("product_name"))}
                onChange={(event) => set("product_name", event.target.value)}
                placeholder="z. B. Felchenfilets"
              />
            </Field>

            <Field label="Produktart" required>
              <ToggleGroup
                id="temperature"
                type="single"
                variant="outline"
                value={values.temperature}
                onValueChange={(value) => value && set("temperature", value as Temperature)}
                className="justify-start"
              >
                <ToggleGroupItem value="fresh" className="px-4">
                  {TEMPERATURE_LABELS.fresh}
                </ToggleGroupItem>
                <ToggleGroupItem value="frozen" className="px-4">
                  {TEMPERATURE_LABELS.frozen}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field label="Beschreibung">
              <Textarea
                id="description"
                rows={3}
                maxLength={1000}
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="Kurzbeschreibung für die Kundschaft"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Verpackung">
                <Input
                  id="packaging"
                  maxLength={120}
                  value={values.packaging}
                  onChange={(event) => set("packaging", event.target.value)}
                  placeholder="z. B. Vakuumbeutel à 500 g"
                />
              </Field>
              <Field label="Mindesthaltbarkeitsdatum">
                <Input
                  id="expiry_date"
                  type="date"
                  value={values.expiry_date}
                  onChange={(event) => set("expiry_date", event.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Beschaffung" description="Woher kommt die Ware und zu welchem Preis?">
            <Field label="Lieferant" required error={issueFor("supplier_id")}>
              <Select
                value={values.supplier_id}
                onValueChange={(value) => set("supplier_id", value)}
              >
                <SelectTrigger id="supplier_id" aria-invalid={Boolean(issueFor("supplier_id"))}>
                  <SelectValue placeholder="Lieferant wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliers.data ?? []).map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Einkaufsmenge" required error={issueFor("purchase_quantity")}>
                <Input
                  id="purchase_quantity"
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={values.purchase_quantity}
                  aria-invalid={Boolean(issueFor("purchase_quantity"))}
                  onChange={(event) => set("purchase_quantity", event.target.value)}
                />
              </Field>
              <Field label="Einheit" required>
                <Select
                  value={values.quantity_unit}
                  onValueChange={(value) => set("quantity_unit", value)}
                >
                  <SelectTrigger id="quantity_unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUANTITY_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {QUANTITY_UNIT_LABELS[unit]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Einkaufspreis pro Einheit"
                required
                error={issueFor("purchase_price")}
                hint="CHF"
              >
                <Input
                  id="purchase_price"
                  type="number"
                  min="0"
                  step="0.05"
                  inputMode="decimal"
                  value={values.purchase_price}
                  aria-invalid={Boolean(issueFor("purchase_price"))}
                  onChange={(event) => set("purchase_price", event.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Lieferkosten" error={issueFor("delivery_cost")} hint="CHF">
                <Input
                  id="delivery_cost"
                  type="number"
                  min="0"
                  step="0.05"
                  inputMode="decimal"
                  disabled={values.delivery_included}
                  value={values.delivery_included ? "" : values.delivery_cost}
                  onChange={(event) => set("delivery_cost", event.target.value)}
                />
              </Field>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="delivery_included"
                    checked={values.delivery_included}
                    onCheckedChange={(checked) => set("delivery_included", checked === true)}
                  />
                  Lieferung im Einkaufspreis enthalten
                </label>
              </div>
            </div>
          </FormSection>

          <FormSection title="Verkaufspreis" description="Was zahlt die Kundschaft?">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Normalpreis" error={issueFor("regular_price")} hint="CHF, optional">
                <Input
                  id="regular_price"
                  type="number"
                  min="0"
                  step="0.05"
                  inputMode="decimal"
                  value={values.regular_price}
                  onChange={(event) => set("regular_price", event.target.value)}
                />
              </Field>
              <Field label="Kundi-Catch-Preis" required error={issueFor("catch_price")} hint="CHF">
                <Input
                  id="catch_price"
                  type="number"
                  min="0"
                  step="0.05"
                  inputMode="decimal"
                  value={values.catch_price}
                  aria-invalid={Boolean(issueFor("catch_price"))}
                  onChange={(event) => set("catch_price", event.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Aktion"
            description="Abholorte und Verfügbarkeit — Zeiten in Europe/Zurich."
          >
            <Field label="Abholort" required error={issueFor("location_ids")}>
              <div
                id="location_ids"
                tabIndex={-1}
                className={cn(
                  "space-y-2 rounded-md border p-3",
                  issueFor("location_ids") && "border-destructive",
                )}
              >
                {(locations.data ?? []).map((location) => (
                  <label key={location.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={values.location_ids.includes(location.id)}
                      onCheckedChange={(checked) =>
                        set(
                          "location_ids",
                          checked === true
                            ? [...values.location_ids, location.id]
                            : values.location_ids.filter((id) => id !== location.id),
                        )
                      }
                    />
                    {location.name}
                  </label>
                ))}
                {(locations.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Noch keine Standorte erfasst — unter Einstellungen anlegen.
                  </p>
                ) : null}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Verfügbar ab" required error={issueFor("available_from")}>
                <Input
                  id="available_from"
                  type="datetime-local"
                  value={values.available_from}
                  aria-invalid={Boolean(issueFor("available_from"))}
                  onChange={(event) => set("available_from", event.target.value)}
                />
              </Field>
              <Field label="Verfügbar bis" error={issueFor("available_until")} hint="optional">
                <Input
                  id="available_until"
                  type="datetime-local"
                  value={values.available_until}
                  aria-invalid={Boolean(issueFor("available_until"))}
                  onChange={(event) => set("available_until", event.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Handicap-Story"
            description="Warum ist dieser Fisch ein Catch? Ehrlich und kurz."
          >
            <Field label="Grund für den Catch" required error={issueFor("handicap_reason")}>
              <Select
                value={values.handicap_reason}
                onValueChange={(value) => {
                  set("handicap_reason", value);
                  if (!storyTouched || !values.handicap_story.trim()) {
                    set("handicap_story", HANDICAP_REASON_SENTENCES[value as HandicapReason]);
                  }
                }}
              >
                <SelectTrigger
                  id="handicap_reason"
                  aria-invalid={Boolean(issueFor("handicap_reason"))}
                >
                  <SelectValue placeholder="Grund wählen" />
                </SelectTrigger>
                <SelectContent>
                  {HANDICAP_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {HANDICAP_REASON_LABELS[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Story-Text"
              error={issueFor("handicap_story")}
              hint="automatisch vorgeschlagen, frei editierbar"
            >
              <Textarea
                id="handicap_story"
                rows={3}
                maxLength={600}
                value={values.handicap_story}
                onChange={(event) => {
                  setStoryTouched(true);
                  set("handicap_story", event.target.value);
                }}
              />
            </Field>
          </FormSection>
        </div>

        <div className="space-y-4">
          <FormSection
            title="Produktbild"
            description="Ein Hauptbild. Für den Status «Bereit» erforderlich."
          >
            <CatchImageField
              path={imagePath}
              onChange={setImagePath}
              onUploadingChange={setUploading}
              invalid={Boolean(issueFor("product_image"))}
            />
            {issueFor("product_image") ? (
              <p className="text-xs font-medium text-destructive">{issueFor("product_image")}</p>
            ) : null}
          </FormSection>

          <FormSection title="Interne Notiz" description="Nur intern sichtbar, nie im Post.">
            <div className="rounded-md border border-dashed bg-muted/30 p-2">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Intern — nicht für Kundschaft
              </p>
              <Textarea
                id="internal_note"
                rows={4}
                maxLength={1000}
                value={values.internal_note}
                onChange={(event) => set("internal_note", event.target.value)}
                placeholder="Absprachen, Reservationen, Hinweise fürs Team"
              />
            </div>
          </FormSection>

          <div className="sticky top-16 space-y-2 rounded-md border bg-card p-3">
            <Button
              type="button"
              className="w-full"
              disabled={saving || uploading}
              onClick={() => void persist("draft")}
            >
              <Save />
              {mode === "create" ? "Entwurf speichern" : "Änderungen speichern"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={saving || uploading}
              onClick={() => void persist("ready")}
            >
              <CheckCircle2 />
              Als bereit markieren
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={handleLeave}>
              <ArrowLeft />
              {mode === "create" ? "Abbrechen" : "Zurück zum Dashboard"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {dirty ? "Ungespeicherte Änderungen vorhanden." : "Alle Änderungen gespeichert."}
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es gibt Änderungen, die noch nicht gespeichert wurden. Beim Verlassen gehen sie
              verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction onClick={leaveNow}>Verwerfen und verlassen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-baseline gap-1.5 text-xs">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
        {hint ? <span className="font-normal text-muted-foreground">({hint})</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
