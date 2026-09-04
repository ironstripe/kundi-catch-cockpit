import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { WhatsappPreview } from "@/components/catch/whatsapp-preview";
import { useRoles } from "@/hooks/use-role";
import { recordAudit } from "@/lib/audit";
import {
  DEFAULT_TEMPLATE_SETTINGS,
  PROTECTED_BRAND_TEXTS,
  SETTING_KEYS,
  fetchAppSettings,
  saveSetting,
  type TemplateDetailField,
  type TemplateSettings,
} from "@/lib/app-settings";
import { generatePostText, type PostSource } from "@/lib/whatsapp-post";

const DETAIL_LABELS: Record<TemplateDetailField, string> = {
  description: "Beschreibung",
  packaging: "Verpackung",
};

/** Realistische Beispieldaten für die Vorschau. */
const SAMPLE: PostSource = {
  product_name: "Felchenfilets mit Haut",
  description: "Felchen aus dem Bodensee, filetiert und schonend tiefgekühlt.",
  packaging: "Vakuumiert à ca. 500 g",
  expiry_date: "2026-12-15",
  regular_price: 10.75,
  catch_price: 7.9,
  quantity_unit: "kg",
  location_names: ["Hofladen Kundelfingerhof", "Stadtladen Schaffhausen"],
  available_from: "2026-09-04T12:00:00.000Z",
  available_until: "2026-09-06T14:00:00.000Z",
  handicap_story: "Etwas ungleichmässig geschnitten — geschmacklich einwandfrei.",
  image_path: null,
};

export function TemplateSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const [values, setValues] = useState<TemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);

  useEffect(() => {
    if (settings.data) setValues(settings.data.template);
  }, [settings.data]);

  const preview = useMemo(() => generatePostText(SAMPLE, values), [values]);

  const mutation = useMutation({
    mutationFn: async (next: TemplateSettings) => {
      const current = settings.data;
      if (!current) return;
      await saveSetting(SETTING_KEYS.template, { ...next }, current.template_version);
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_KEYS.template,
        action: "template_updated",
        previous: { ...current.template },
        next: { ...next },
        summary: "WhatsApp-Vorlage geändert",
      });
    },
    onSuccess: async () => {
      toast.success("WhatsApp-Vorlage gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: () => toast.error("Die Vorlage konnte nicht gespeichert werden."),
  });

  if (!isAdmin) return <NoAccess />;
  if (settings.isLoading) return <Skeleton className="h-64 w-full" />;

  function moveDetail(index: number, direction: -1 | 1) {
    const order = [...values.detail_order];
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const current = order[index]!;
    order[index] = order[target]!;
    order[target] = current;
    setValues({ ...values, detail_order: order });
  }

  return (
    <SectionShell
      title="WhatsApp-Vorlage"
      description="Deterministische Vorlage ohne KI. Die freigegebenen Markentexte sind geschützt und lassen sich nicht ändern."
      contentClassName="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Reihenfolge der Produktdetailzeilen</Label>
            <div className="space-y-2">
              {values.detail_order.map((field, index) => (
                <div
                  key={field}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <span>{DETAIL_LABELS[field]}</span>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Nach oben"
                      disabled={index === 0}
                      onClick={() => moveDetail(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Nach unten"
                      disabled={index === values.detail_order.length - 1}
                      onClick={() => moveDetail(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
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
                  onCheckedChange={(checked) => setValues({ ...values, [key]: checked })}
                />
                <Label htmlFor={key}>{label}</Label>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pickup-label">Bezeichnung Abholort</Label>
              <Input
                id="pickup-label"
                value={values.pickup_label}
                onChange={(event) => setValues({ ...values, pickup_label: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-label">Bezeichnung Verfügbar ab</Label>
              <Input
                id="from-label"
                value={values.available_from_label}
                onChange={(event) =>
                  setValues({ ...values, available_from_label: event.target.value })
                }
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Lock className="size-3.5" /> Geschützte Markentexte
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {PROTECTED_BRAND_TEXTS.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => mutation.mutate(values)} disabled={mutation.isPending}>
              Änderungen speichern
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Auf Standardvorlage zurücksetzen</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Standardvorlage wiederherstellen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Alle Vorlagenoptionen werden auf die Ausgangswerte zurückgesetzt. Bereits
                    publizierte Posts bleiben unverändert.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setValues({ ...DEFAULT_TEMPLATE_SETTINGS });
                      mutation.mutate({ ...DEFAULT_TEMPLATE_SETTINGS });
                    }}
                  >
                    Zurücksetzen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vorschau mit Beispieldaten</Label>
          <WhatsappPreview text={preview} />
        </div>
      </div>
    </SectionShell>
  );
}
