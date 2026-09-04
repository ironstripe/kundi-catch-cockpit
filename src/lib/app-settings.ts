/**
 * Zentrale Anwendungseinstellungen (versioniert in `application_settings`).
 * Kalkulationsregeln, WhatsApp-Vorlagenoptionen und Markenasset.
 */

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CATCH_THRESHOLDS, type CatchThresholds } from "@/lib/catch-thresholds";

export const SETTING_KEYS = {
  thresholds: "calculation_thresholds",
  template: "whatsapp_template",
  brand: "brand_logo",
} as const;

/** Reihenfolge der optionalen Produktdetailzeilen im Post. */
export type TemplateDetailField = "description" | "packaging";

export interface TemplateSettings {
  detail_order: TemplateDetailField[];
  show_expiry: boolean;
  show_available_until: boolean;
  show_discount: boolean;
  pickup_label: string;
  available_from_label: string;
}

export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  detail_order: ["description", "packaging"],
  show_expiry: true,
  show_available_until: true,
  show_discount: true,
  pickup_label: "📍 Abholung:",
  available_from_label: "📅 Ab:",
};

export interface BrandSettings {
  path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
}

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  path: null,
  file_name: null,
  mime_type: null,
  size: null,
};

/** Freigegebene Markentexte — nicht über Einstellungen änderbar. */
export const PROTECTED_BRAND_TEXTS = [
  "KUNDI CATCH",
  "Kundelfingerhof",
  "Guter Fisch. Kleines Handicap. Grosser Fang.",
  "Nur solange Vorrat.",
  "Gut essen. Food Waste vermeiden.",
] as const;

/** Einziger freigegebener Markenclaim. */
export const BRAND_CLAIM_TEXT = "Guter Fisch. Kleines Handicap. Grosser Fang.";
/** Kommunikationsabschluss — bewusst zurückhaltender als der Claim. */
export const BRAND_PURPOSE_TEXT = "Gut essen. Food Waste vermeiden.";

export interface AppSettings {
  thresholds: CatchThresholds;
  thresholds_version: number;
  template: TemplateSettings;
  template_version: number;
  brand: BrandSettings;
}

function merge<T extends object>(fallback: T, value: unknown): T {
  if (!value || typeof value !== "object") return fallback;
  return { ...fallback, ...(value as Partial<T>) };
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("application_settings")
    .select("key, value, version");
  if (error) throw error;
  const rows = new Map((data ?? []).map((row) => [row.key, row]));
  const thresholdRow = rows.get(SETTING_KEYS.thresholds);
  const templateRow = rows.get(SETTING_KEYS.template);
  const brandRow = rows.get(SETTING_KEYS.brand);
  return {
    thresholds: merge(DEFAULT_CATCH_THRESHOLDS, thresholdRow?.value),
    thresholds_version: thresholdRow?.version ?? 1,
    template: merge(DEFAULT_TEMPLATE_SETTINGS, templateRow?.value),
    template_version: templateRow?.version ?? 1,
    brand: merge(DEFAULT_BRAND_SETTINGS, brandRow?.value),
  };
}

/** Validiert die Kalkulationsregeln; gibt eine deutsche Fehlermeldung zurück. */
export function validateThresholds(values: CatchThresholds): string | null {
  const entries = Object.entries(values) as [keyof CatchThresholds, number][];
  for (const [, value] of entries) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return "Alle Werte müssen Prozentwerte zwischen 0 und 100 sein.";
    }
  }
  if (values.maximum_green_break_even > values.maximum_orange_break_even) {
    return "Der maximale Break-even für «Guter Catch» darf den Wert für «Knapp kalkuliert» nicht überschreiten.";
  }
  return null;
}

export async function saveSetting(
  key: string,
  value: Record<string, unknown>,
  currentVersion: number,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("application_settings")
    .update({
      value: value as never,
      version: currentVersion + 1,
      updated_by: userData.user?.id ?? null,
    })
    .eq("key", key);
  if (error) throw error;
}
