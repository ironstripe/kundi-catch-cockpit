import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { WhatsappPreview } from "@/components/catch/whatsapp-preview";
import { useRoles } from "@/hooks/use-role";
import { useSyncedDraft } from "@/hooks/use-synced-draft";
import { recordAudit } from "@/lib/audit";
import {
  DEFAULT_TEMPLATE_SETTINGS,
  REQUIRED_TEMPLATE_BLOCKS,
  SETTING_AUDIT_IDS,
  SETTING_KEYS,
  TEMPLATE_TEXT_LIMITS,
  fetchAppSettings,
  saveSetting,
  validateTemplate,
  type TemplateBlock,
  type TemplateDetailField,
  type TemplateSettings,
} from "@/lib/app-settings";
import { generatePostText, type PostSource } from "@/lib/whatsapp-post";

const DETAIL_LABELS: Record<TemplateDetailField, string> = {
  description: "Beschreibung",
  packaging: "Verpackung",
};

const BLOCK_LABELS: Record<TemplateBlock, string> = {
  intro: "Einleitung (Vorlage)",
  claim: "Claim (Vorlage)",
  story: "Handicap-Geschichte (Catch-Daten)",
  product: "Produkt (Catch-Daten)",
  price: "Preis (Catch-Daten)",
  stock: "MHD / Nur solange Vorrat (Catch-Daten)",
  pickup: "Abholung & Verfügbarkeit (Catch-Daten)",
  shop: "Onlineshop-Link (Catch-Daten)",
  footer: "Abschluss (Vorlage)",
};

/** Beispiel-Catch für die Vorschau — keine echten Datensätze. */
const TEMPLATE_SAMPLE: PostSource = {
  product_name: "Felchenfilets mit Haut",
  description: "Felchen aus dem Bodensee, filetiert und schonend tiefgekühlt.",
  packaging: "Vakuumiert à ca. 500 g",
  expiry_date: "2026-12-15",
  regular_price: 10.75,
  catch_price: 7.9,
  quantity_unit: "kg",
  locations: [
    { name: "Hofladen Kundelfingerhof", address: null, pickup_note: null },
    {
      name: "Stadtladen Schaffhausen",
      address: "Kirchhofplatz 10",
      pickup_note: "(Eintritt via EC Karte - ausser Postfinance)",
    },
  ],
  available_from: "2026-09-04T12:00:00.000Z",
  available_until: "2026-09-06T14:00:00.000Z",
  handicap_story: "Etwas ungleichmässig geschnitten — geschmacklich einwandfrei.",
  image_path: null,
  online_shop_url: "https://shop.kundelfingerhof.ch/felchenfilets",
};

type TextKey = "header" | "intro" | "claim" | "footer";
const TEXT_FIELDS: [TextKey, string, string][] = [
  ["header", "Titel mit Teilen-Aufruf", "Erste Zeile jedes Posts. Pflichtfeld."],
  ["intro", "Einleitung (optional)", "Leer lassen, um den Abschnitt wegzulassen."],
  ["claim", "Claim", "Leer lassen, um den Abschnitt wegzulassen."],
  ["footer", "Abschluss / Aufruf", "Leer lassen, um den Abschnitt wegzulassen."],
];

export function TemplateSection() {
  const { isAdmin } = useRoles();
  const readOnly = !isAdmin;
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const server = settings.data?.template ?? DEFAULT_TEMPLATE_SETTINGS;
  // Lokale Bearbeitung; Refetch/Speicherantwort überschreibt keine ungespeicherten Änderungen.
  const draft = useSyncedDraft(settings.data ? "template" : "template:loading", server);
  const values = draft.value;
  const setValues = draft.setValue;
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => generatePostText(TEMPLATE_SAMPLE, values), [values]);

  const mutation = useMutation({
    mutationFn: async (next: TemplateSettings) => {
      const current = settings.data;
      if (!current) throw new Error("Einstellungen noch nicht geladen.");
      await saveSetting(SETTING_KEYS.template, { ...next }, current.template_version);
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[SETTING_KEYS.template]!,
        action: "template_updated",
        previous: { ...current.template },
        next: { ...next },
        summary: "WhatsApp-Vorlage geändert",
      });
    },
    onSuccess: async (_r, next) => {
      draft.markSaved(next);
      toast.success("WhatsApp-Vorlage gespeichert.", {
        description: "Gilt für neu generierte Posts. Bestehende Texte bleiben unverändert.",
      });
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: unknown) =>
      toast.error("Die Vorlage konnte nicht gespeichert werden.", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  if (settings.isLoading) return <Skeleton className="h-64 w-full" />;
  if (settings.isError)
    return (
      <SectionShell title="WhatsApp-Vorlage" description="">
        <p role="alert" className="text-sm">
          Die Vorlage konnte nicht geladen werden.{" "}
          <Button size="sm" variant="outline" onClick={() => void settings.refetch()}>
            Erneut laden
          </Button>
        </p>
      </SectionShell>
    );

  function update(patch: Partial<TemplateSettings>) {
    setError(null);
    setValues({ ...values, ...patch });
  }

  function move<T>(list: T[], index: number, direction: -1 | 1): T[] {
    const next = [...list];
    const target = index + direction;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  }

  function handleSave() {
    if (mutation.isPending || !draft.dirty) return;
    const message = validateTemplate(values);
    if (message) {
      setError(message);
      return;
    }
    mutation.mutate(values);
  }

  return (
    <SectionShell
      title="WhatsApp-Vorlage"
      description="Wiederverwendbare Textbausteine für neu generierte Posts. Produkt, Preis, Abholort und Verfügbarkeit kommen immer automatisch aus dem Catch."
      contentClassName="space-y-6"
    >
      {readOnly ? (
        <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          Nur Administratoren können die Vorlage ändern. Du siehst die aktuelle Vorlage.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset disabled={readOnly || mutation.isPending} className="min-w-0 space-y-5">
          {TEXT_FIELDS.map(([key, label, help]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`tpl-${key}`}>{label}</Label>
              <Textarea
                id={`tpl-${key}`}
                value={values[key]}
                rows={key === "header" ? 2 : 3}
                maxLength={TEMPLATE_TEXT_LIMITS[key]}
                onChange={(event) => update({ [key]: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">{help}</p>
            </div>
          ))}
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Formatierung wie in WhatsApp: <code>*fett*</code>, <code>~durchgestrichen~</code>,
            Emojis direkt einfügen. Kein HTML.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pickup-label">Überschrift Abholung</Label>
              <Input
                id="pickup-label"
                value={values.pickup_label}
                maxLength={TEMPLATE_TEXT_LIMITS.pickup_label}
                onChange={(event) => update({ pickup_label: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from-label">Bezeichnung Verfügbar ab</Label>
              <Input
                id="from-label"
                value={values.available_from_label}
                maxLength={TEMPLATE_TEXT_LIMITS.available_from_label}
                onChange={(event) => update({ available_from_label: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Abschnitte: Reihenfolge und Sichtbarkeit</Label>
            <p className="text-xs text-muted-foreground">
              Der Titel steht immer zuoberst. Produkt, Preis und Abholung bleiben immer sichtbar.
            </p>
            <ul className="space-y-1.5">
              {values.block_order.map((block, index) => {
                const required = REQUIRED_TEMPLATE_BLOCKS.includes(block);
                const visible = !values.hidden_blocks.includes(block);
                return (
                  <li
                    key={block}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-1.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Switch
                        id={`block-${block}`}
                        checked={visible}
                        disabled={required}
                        aria-label={`${BLOCK_LABELS[block]} anzeigen`}
                        onCheckedChange={(checked) =>
                          update({
                            hidden_blocks: checked
                              ? values.hidden_blocks.filter((b) => b !== block)
                              : [...values.hidden_blocks, block],
                          })
                        }
                      />
                      <Label htmlFor={`block-${block}`} className="font-normal">
                        {BLOCK_LABELS[block]}
                      </Label>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${BLOCK_LABELS[block]} nach oben`}
                        disabled={index === 0}
                        onClick={() => update({ block_order: move(values.block_order, index, -1) })}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${BLOCK_LABELS[block]} nach unten`}
                        disabled={index === values.block_order.length - 1}
                        onClick={() => update({ block_order: move(values.block_order, index, 1) })}
                      >
                        <ArrowDown />
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Reihenfolge der Produktdetailzeilen</Label>
            {values.detail_order.map((field, index) => (
              <div
                key={field}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5 text-sm"
              >
                <span>{DETAIL_LABELS[field]}</span>
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${DETAIL_LABELS[field]} nach oben`}
                    disabled={index === 0}
                    onClick={() => update({ detail_order: move(values.detail_order, index, -1) })}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${DETAIL_LABELS[field]} nach unten`}
                    disabled={index === values.detail_order.length - 1}
                    onClick={() => update({ detail_order: move(values.detail_order, index, 1) })}
                  >
                    <ArrowDown />
                  </Button>
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {(
              [
                ["show_expiry", "MHD-Zeile anzeigen"],
                ["show_available_until", "Zeile «Verfügbar bis» anzeigen"],
                ["show_discount", "Preisvorteil in Prozent anzeigen"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <Switch
                  id={key}
                  checked={values[key]}
                  onCheckedChange={(checked) => update({ [key]: checked })}
                />
                <Label htmlFor={key}>{label}</Label>
              </div>
            ))}
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {readOnly ? null : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={mutation.isPending || !draft.dirty}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Speichern
              </Button>
              <Button
                variant="outline"
                disabled={!draft.dirty}
                onClick={() => {
                  setError(null);
                  setValues(draft.base);
                }}
              >
                Verwerfen
              </Button>
              <Button variant="outline" onClick={() => update({ ...DEFAULT_TEMPLATE_SETTINGS })}>
                Standard wiederherstellen
              </Button>
            </div>
          )}
          {!readOnly && draft.dirty ? (
            <p className="text-xs text-muted-foreground">
              Ungespeicherte Änderungen. «Standard wiederherstellen» wirkt erst nach Speichern.
            </p>
          ) : null}
        </fieldset>

        <div className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start">
          <Label>Beispielvorschau</Label>
          <p className="text-xs text-muted-foreground">
            Produkt, Preis, Orte und Daten sind ein erfundener Beispiel-Catch — nur Titel,
            Einleitung, Claim, Abschluss und Abschnittswahl stammen aus der Vorlage.
          </p>
          <WhatsappPreview text={preview} imageAlt="Beispielbild" status="ready" />
        </div>
      </div>
    </SectionShell>
  );
}
