/**
 * Zentrale Anwendungseinstellungen (versioniert in `application_settings`).
 * Kalkulationsregeln, WhatsApp-Vorlagenoptionen und Markenasset.
 */

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CATCH_THRESHOLDS, type CatchThresholds } from "@/lib/catch-thresholds";
import { DEFAULT_VAT_SETTINGS, type VatSettings } from "@/lib/vat";

export const SETTING_KEYS = {
  thresholds: "calculation_thresholds",
  calculationDefaults: "calculation_defaults",
  vat: "vat",
  template: "whatsapp_template",
  brand: "brand_logo",
  brandIcon: "brand_icon",
  instagram: "instagram",
  sounding: "sounding",
} as const;

/**
 * Stabile Kennungen für Audit-Einträge zu Einstellungen
 * (das Audit-Feld erwartet eine UUID, keine Schlüsselbezeichnung).
 */
export const SETTING_AUDIT_IDS: Record<string, string> = {
  calculation_thresholds: "feadc928-d0ce-51a6-7cb8-3372da8ee481",
  calculation_defaults: "9a4c7f18-3b56-4d21-8e7a-1c5b90fd4e62",
  vat: "2f1d6a3c-40b7-4d92-9c1e-71f0a3d5b8c4",
  whatsapp_template: "b5bfa745-2936-cd06-683a-47da4f293467",
  brand_logo: "71584ba9-bd72-aad3-fcef-ece5523cfb9e",
  brand_icon: "6670d0fb-13c2-aafe-843a-a872fe540e1e",
  instagram: "0f2c1c1e-6a2b-4d5e-9d54-8c8c2a1f7b30",
  sounding: "6c9a41d2-77b5-4f0e-9c3a-2d1b8e5f4a07",
};

/** Reihenfolge der optionalen Produktdetailzeilen im Post. */
export type TemplateDetailField = "description" | "packaging";

/**
 * Abschnitte des Posts unterhalb des Titels. Inhalte von «story», «product»,
 * «price», «stock», «pickup» und «shop» kommen immer aus den Catch-Daten.
 */
export type TemplateBlock =
  | "intro"
  | "claim"
  | "story"
  | "product"
  | "price"
  | "stock"
  | "pickup"
  | "shop"
  | "footer";

export const TEMPLATE_BLOCKS: TemplateBlock[] = [
  "intro",
  "claim",
  "story",
  "product",
  "price",
  "stock",
  "pickup",
  "shop",
  "footer",
];

/** Diese Abschnitte tragen die Kerninformation und lassen sich nicht ausblenden. */
export const REQUIRED_TEMPLATE_BLOCKS: TemplateBlock[] = ["product", "price", "pickup"];

export const DEFAULT_POST_HEADER =
  "🐟 *FOOD CATCH* - Bitte teilt, diesen Beitrag, damit wir möglichst viel retten können😍👌";

export interface TemplateSettings {
  detail_order: TemplateDetailField[];
  show_expiry: boolean;
  show_available_until: boolean;
  show_discount: boolean;
  pickup_label: string;
  available_from_label: string;
  /** Titel inkl. Teilen-Aufruf (WhatsApp-Formatierung erlaubt). */
  header: string;
  /** Optionaler Einleitungstext; leer = entfällt. */
  intro: string;
  claim: string;
  footer: string;
  block_order: TemplateBlock[];
  hidden_blocks: TemplateBlock[];
}

export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  detail_order: ["description", "packaging"],
  show_expiry: true,
  show_available_until: true,
  show_discount: true,
  pickup_label: "📍 Abholung:",
  available_from_label: "📅 Ab:",
  header: DEFAULT_POST_HEADER,
  intro: "",
  claim: "*Guter Fisch. Kleines Handicap. Grosser Fang.*",
  footer: "*Gut essen. Food Waste vermeiden.*",
  block_order: [...TEMPLATE_BLOCKS],
  hidden_blocks: [],
};

export const TEMPLATE_TEXT_LIMITS = {
  header: 300,
  intro: 1000,
  claim: 300,
  footer: 1000,
  pickup_label: 60,
  available_from_label: 60,
} as const;

/**
 * Gespeicherte (ggf. ältere) Vorlage auf vollständige, gültige Werte bringen.
 * Fehlende Felder → Standard; unbekannte Abschnitte entfallen, fehlende werden angehängt.
 * Unbekannte Zusatzschlüssel bleiben erhalten.
 */
export function normalizeTemplate(value: unknown): TemplateSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const d = DEFAULT_TEMPLATE_SETTINGS;
  const str = (key: keyof typeof TEMPLATE_TEXT_LIMITS | "header" | "intro" | "claim" | "footer") =>
    typeof raw[key] === "string" ? (raw[key] as string) : (d[key] as string);
  const bool = (key: "show_expiry" | "show_available_until" | "show_discount") =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : d[key];
  const blocks = Array.isArray(raw.block_order)
    ? (raw.block_order as unknown[]).filter(
        (b, i, all): b is TemplateBlock =>
          TEMPLATE_BLOCKS.includes(b as TemplateBlock) && all.indexOf(b) === i,
      )
    : [];
  for (const block of TEMPLATE_BLOCKS) if (!blocks.includes(block)) blocks.push(block);
  const hidden = Array.isArray(raw.hidden_blocks)
    ? (raw.hidden_blocks as unknown[]).filter(
        (b, i, all): b is TemplateBlock =>
          TEMPLATE_BLOCKS.includes(b as TemplateBlock) &&
          !REQUIRED_TEMPLATE_BLOCKS.includes(b as TemplateBlock) &&
          all.indexOf(b) === i,
      )
    : [];
  const details = Array.isArray(raw.detail_order)
    ? (raw.detail_order as unknown[]).filter(
        (f, i, all): f is TemplateDetailField =>
          (f === "description" || f === "packaging") && all.indexOf(f) === i,
      )
    : [];
  for (const field of d.detail_order) if (!details.includes(field)) details.push(field);
  return {
    ...raw,
    detail_order: details,
    show_expiry: bool("show_expiry"),
    show_available_until: bool("show_available_until"),
    show_discount: bool("show_discount"),
    pickup_label: str("pickup_label"),
    available_from_label: str("available_from_label"),
    header: str("header"),
    intro: str("intro"),
    claim: str("claim"),
    footer: str("footer"),
    block_order: blocks,
    hidden_blocks: hidden,
  };
}

const TEMPLATE_FIELD_LABELS: Record<keyof typeof TEMPLATE_TEXT_LIMITS, string> = {
  header: "Titel",
  intro: "Einleitung",
  claim: "Claim",
  footer: "Abschluss",
  pickup_label: "Überschrift Abholung",
  available_from_label: "Bezeichnung Verfügbar ab",
};

/** Deutsche Fehlermeldung oder null. */
export function validateTemplate(values: TemplateSettings): string | null {
  for (const [key, limit] of Object.entries(TEMPLATE_TEXT_LIMITS) as [
    keyof typeof TEMPLATE_TEXT_LIMITS,
    number,
  ][]) {
    const value = values[key];
    if (typeof value !== "string") return `${TEMPLATE_FIELD_LABELS[key]} ist ungültig.`;
    if (value.length > limit)
      return `${TEMPLATE_FIELD_LABELS[key]} darf höchstens ${limit} Zeichen haben.`;
    if (/<\/?[a-z][^>]*>/i.test(value))
      return `${TEMPLATE_FIELD_LABELS[key]}: HTML wird nicht unterstützt — bitte nur WhatsApp-Formatierung verwenden.`;
  }
  if (values.header.trim() === "") return "Bitte einen Titel erfassen.";
  if (values.pickup_label.trim() === "") return "Bitte eine Überschrift für die Abholung erfassen.";
  if (values.available_from_label.trim() === "")
    return "Bitte eine Bezeichnung für «Verfügbar ab» erfassen.";
  return null;
}

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
  "FOOD CATCH",
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
    "Die aktuellen Food Catches gibt es zuerst in unserer WhatsApp-Gruppe.\nJetzt über den Link in der Bio beitreten.",
  default_publish_time: "now",
  default_publish_hour: "09:00",
};

export interface SoundingSettings {
  /** Adresse des bestehenden Microsoft-Teams-Gruppenchats. */
  teams_chat_url: string;
  /** Standardmässig vorausgewählte prüfende Personen. */
  default_reviewer_ids: string[];
}

export const DEFAULT_SOUNDING_SETTINGS: SoundingSettings = {
  teams_chat_url: "",
  default_reviewer_ids: [],
};

/**
 * Kalkulationsstandards für neu erfasste Catches.
 * Der Wert wird beim Anlegen kopiert; bestehende Catches bleiben unberührt.
 */
export interface CalculationDefaults {
  /** Interner Aufwand in CHF pro vorbereiteter Einheit. */
  internal_handling_cost_per_unit: number;
}

export const DEFAULT_INTERNAL_HANDLING_COST = 2.5;

export const DEFAULT_CALCULATION_DEFAULTS: CalculationDefaults = {
  internal_handling_cost_per_unit: DEFAULT_INTERNAL_HANDLING_COST,
};

/** Eingabefeld -> Zahl in CHF; leer oder ungültig ergibt null. */
export function parseInternalHandlingInput(
  value: string | number | null | undefined,
): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Deutsche Fehlermeldung oder null. Der Standardwert ist Pflicht. */
export function validateInternalHandlingDefault(value: number | null): string | null {
  if (value === null) return "Bitte einen Standardwert in CHF erfassen.";
  if (!Number.isFinite(value) || value < 0) {
    return "Der interne Aufwand muss ein Betrag von 0 CHF oder mehr sein.";
  }
  if (value > 1000) return "Der interne Aufwand darf 1000 CHF pro Einheit nicht überschreiten.";
  if (Math.round(value * 100) !== Number((value * 100).toFixed(6))) {
    return "Bitte höchstens zwei Dezimalstellen erfassen.";
  }
  return null;
}

export interface AppSettings {
  thresholds: CatchThresholds;
  thresholds_version: number;
  calculation_defaults: CalculationDefaults;
  calculation_defaults_version: number;
  vat: VatSettings;
  vat_version: number;
  template: TemplateSettings;
  template_version: number;
  brand: BrandSettings;
  brand_version: number;
  brand_icon: BrandSettings;
  brand_icon_version: number;
  instagram: InstagramSettings;
  instagram_version: number;
  sounding: SoundingSettings;
  sounding_version: number;
}

function merge<T extends object>(fallback: T, value: unknown): T {
  if (!value || typeof value !== "object") return fallback;
  return { ...fallback, ...(value as Partial<T>) };
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("application_settings").select("key, value, version");
  if (error) throw error;
  const rows = new Map((data ?? []).map((row) => [row.key, row]));
  const thresholdRow = rows.get(SETTING_KEYS.thresholds);
  const defaultsRow = rows.get(SETTING_KEYS.calculationDefaults);
  const vatRow = rows.get(SETTING_KEYS.vat);
  const templateRow = rows.get(SETTING_KEYS.template);
  const brandRow = rows.get(SETTING_KEYS.brand);
  const iconRow = rows.get(SETTING_KEYS.brandIcon);
  const instagramRow = rows.get(SETTING_KEYS.instagram);
  const soundingRow = rows.get(SETTING_KEYS.sounding);
  return {
    thresholds: merge(DEFAULT_CATCH_THRESHOLDS, thresholdRow?.value),
    thresholds_version: thresholdRow?.version ?? 1,
    calculation_defaults: merge(DEFAULT_CALCULATION_DEFAULTS, defaultsRow?.value),
    calculation_defaults_version: defaultsRow?.version ?? 1,
    vat: merge(DEFAULT_VAT_SETTINGS, vatRow?.value),
    vat_version: vatRow?.version ?? 1,
    template: normalizeTemplate(templateRow?.value),
    template_version: templateRow?.version ?? 1,
    brand: merge(DEFAULT_BRAND_SETTINGS, brandRow?.value),
    brand_version: brandRow?.version ?? 1,
    brand_icon: merge(DEFAULT_BRAND_SETTINGS, iconRow?.value),
    brand_icon_version: iconRow?.version ?? 1,
    instagram: merge(DEFAULT_INSTAGRAM_SETTINGS, instagramRow?.value),
    instagram_version: instagramRow?.version ?? 1,
    sounding: merge(DEFAULT_SOUNDING_SETTINGS, soundingRow?.value),
    sounding_version: soundingRow?.version ?? 1,
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
