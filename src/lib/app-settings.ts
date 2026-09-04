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
  brandIcon: "brand_icon",
  instagram: "instagram",
} as const;

/**
 * Stabile Kennungen für Audit-Einträge zu Einstellungen
 * (das Audit-Feld erwartet eine UUID, keine Schlüsselbezeichnung).
 */
export const SETTING_AUDIT_IDS: Record<string, string> = {
  calculation_thresholds: "feadc928-d0ce-51a6-7cb8-3372da8ee481",
  whatsapp_template: "b5bfa745-2936-cd06-683a-47da4f293467",
  brand_logo: "71584ba9-bd72-aad3-fcef-ece5523cfb9e",
  brand_icon: "6670d0fb-13c2-aafe-843a-a872fe540e1e",
  instagram: "0f2c1c1e-6a2b-4d5e-9d54-8c8c2a1f7b30",
};

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

export interface InstagramSettings {
  /** Ist die Automatisierung im Cockpit freigeschaltet? */
  enabled: boolean;
  /** Link zur WhatsApp-Gruppe (erscheint in der Instagram-Bio). */
  whatsapp_group_url: string;
  /** Aufruf im Instagram-Text. */
  call_to_action: string;
  /** "now" = sofort, "scheduled" = zur Standardzeit. */
  default_publish_time: "now" | "scheduled";
  /** Standardzeit im Format HH:MM (Europe/Zurich). */
  default_publish_hour: string;
}

export const DEFAULT_INSTAGRAM_SETTINGS: InstagramSettings = {
  enabled: false,
  whatsapp_group_url: "",
  call_to_action:
    "Die aktuellen Kundi Catches gibt es zuerst in unserer WhatsApp-Gruppe.\nJetzt über den Link in der Bio beitreten.",
  default_publish_time: "now",
  default_publish_hour: "09:00",
};

export interface AppSettings {
  thresholds: CatchThresholds;
  thresholds_version: number;
  template: TemplateSettings;
  template_version: number;
  brand: BrandSettings;
  brand_version: number;
  brand_icon: BrandSettings;
  brand_icon_version: number;
  instagram: InstagramSettings;
  instagram_version: number;
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
  const iconRow = rows.get(SETTING_KEYS.brandIcon);
  const instagramRow = rows.get(SETTING_KEYS.instagram);
  return {
    thresholds: merge(DEFAULT_CATCH_THRESHOLDS, thresholdRow?.value),
    thresholds_version: thresholdRow?.version ?? 1,
    template: merge(DEFAULT_TEMPLATE_SETTINGS, templateRow?.value),
    template_version: templateRow?.version ?? 1,
    brand: merge(DEFAULT_BRAND_SETTINGS, brandRow?.value),
    brand_version: brandRow?.version ?? 1,
    brand_icon: merge(DEFAULT_BRAND_SETTINGS, iconRow?.value),
    brand_icon_version: iconRow?.version ?? 1,
    instagram: merge(DEFAULT_INSTAGRAM_SETTINGS, instagramRow?.value),
    instagram_version: instagramRow?.version ?? 1,
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
