import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Quote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DATE_FIELDS,
  NUMERIC_FIELDS,
  OFFER_FIELD_KEYS,
  OFFER_FIELD_LABELS,
  REQUIRED_FOR_CONVERSION,
  type ExtractedOffer,
  type OfferFieldKey,
} from "@/lib/supplier-offer-extraction";

/** Gruppierung der Felder — gleiche Reihenfolge wie im Angebot üblich. */
const GROUPS: { title: string; keys: OfferFieldKey[] }[] = [
  {
    title: "Lieferant",
    keys: ["supplier_name", "supplier_contact_name", "supplier_email"],
  },
  {
    title: "Produkt",
    keys: [
      "product_name",
      "article_number",
      "category",
      "temperature",
      "origin",
      "certification",
      "size_calibration",
      "glazing",
    ],
  },
  {
    title: "Menge und Gebinde",
    keys: ["packaging", "units_per_package", "quantity_unit", "carton_count", "available_quantity"],
  },
  {
    title: "Preise",
    keys: ["purchase_price", "regular_price", "currency", "delivery_cost"],
  },
  {
    title: "Logistik und Fristen",
    keys: ["delivery_location", "available_from", "expiry_date"],
  },
  {
    title: "Hintergrund",
    keys: ["offer_reason", "other_conditions"],
  },
];

export type OfferFormValues = Record<string, string>;

export function offerToFormValues(offer: ExtractedOffer): OfferFormValues {
  const values: OfferFormValues = {};
  for (const key of OFFER_FIELD_KEYS) {
    const value = offer[key]?.value;
    values[key] = value === null || value === undefined ? "" : String(value);
  }
  return values;
}

/** Formularwerte zurück in das Auswertungsschema (Herkunftsangaben bleiben erhalten). */
export function formValuesToExtraction(
  values: OfferFormValues,
  original: ExtractedOffer,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of OFFER_FIELD_KEYS) {
    const raw = (values[key] ?? "").trim();
    const source = original[key];
    result[key] = {
      value: raw === "" ? null : raw,
      unit: source?.unit ?? null,
      confidence: source?.confidence ?? null,
      source_excerpt: source?.source_excerpt ?? null,
    };
  }
  return result;
}

function confidenceLabel(confidence: number | null): string | null {
  if (confidence === null) return null;
  if (confidence >= 0.8) return "sicher";
  if (confidence >= 0.5) return "mittel";
  return "unsicher";
}

export function OfferFieldsForm({
  offer,
  values,
  onChange,
  disabled,
  warnings,
}: {
  offer: ExtractedOffer;
  values: OfferFormValues;
  onChange: (values: OfferFormValues) => void;
  disabled: boolean;
  warnings: string[];
}) {
  const missing = useMemo(
    () => REQUIRED_FOR_CONVERSION.filter((key) => !(values[key] ?? "").trim()),
    [values],
  );

  return (
    <div className="space-y-4">
      {warnings.length ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4" aria-hidden />
              Hinweise zur Auswertung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {missing.length ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Für die Übernahme fehlen noch: {missing.map((key) => OFFER_FIELD_LABELS[key]).join(", ")}.
        </p>
      ) : null}

      {GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-sm">{group.title}</CardTitle>
            <CardDescription className="text-xs">
              Werte stammen aus der E-Mail. Leere Felder bedeuten: die E-Mail sagt dazu nichts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {group.keys.map((key) => {
              const field = offer[key];
              const isLong = key === "other_conditions" || key === "offer_reason";
              const inputType = NUMERIC_FIELDS.includes(key)
                ? "number"
                : DATE_FIELDS.includes(key)
                  ? "date"
                  : "text";
              return (
                <div key={key} className={isLong ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`offer-${key}`} className="text-xs">
                      {OFFER_FIELD_LABELS[key]}
                      {REQUIRED_FOR_CONVERSION.includes(key) ? " *" : ""}
                    </Label>
                    {field?.unit ? (
                      <span className="text-xs text-muted-foreground">({field.unit})</span>
                    ) : null}
                    {confidenceLabel(field?.confidence ?? null) ? (
                      <Badge variant="outline" className="text-[10px]">
                        {confidenceLabel(field?.confidence ?? null)}
                      </Badge>
                    ) : null}
                  </div>
                  {isLong ? (
                    <Textarea
                      id={`offer-${key}`}
                      value={values[key] ?? ""}
                      disabled={disabled}
                      rows={3}
                      onChange={(event) => onChange({ ...values, [key]: event.target.value })}
                    />
                  ) : (
                    <Input
                      id={`offer-${key}`}
                      type={inputType}
                      step={inputType === "number" ? "any" : undefined}
                      value={values[key] ?? ""}
                      disabled={disabled}
                      onChange={(event) => onChange({ ...values, [key]: event.target.value })}
                    />
                  )}
                  {field?.source_excerpt ? (
                    <p className="flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
                      <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{field.source_excerpt}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Warnt, wenn beim Verlassen ungespeicherte Änderungen bestehen. */
export function useUnsavedGuard(dirty: boolean) {
  const [armed, setArmed] = useState(dirty);
  useEffect(() => setArmed(dirty), [dirty]);
  useEffect(() => {
    if (!armed) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [armed]);
}
