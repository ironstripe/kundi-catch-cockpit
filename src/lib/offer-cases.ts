/**
 * Angebotsdossiers: Lesezugriffe für die Oberfläche.
 *
 * Ein Dossier bündelt mehrere Lieferanten-E-Mails. Jede E-Mail und jeder
 * Anhang bleibt unverändert als Quelle erhalten. Alle schreibenden Aktionen
 * laufen über Server-Funktionen.
 */

import { supabase } from "@/integrations/supabase/client";
import { normaliseExtraction, type ExtractedOffer } from "@/lib/supplier-offer-extraction";
import type { OfferAttachment } from "@/lib/supplier-offers";

export type CaseStatus = "review" | "ready" | "converted" | "ignored";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  review: "Zur Prüfung",
  ready: "Bereit",
  converted: "Übernommen",
  ignored: "Abgelegt",
};

export type CaseFilter = "open" | "converted" | "failed" | "all";

export const CASE_FILTER_LABELS: Record<CaseFilter, string> = {
  open: "Offen",
  converted: "Übernommen",
  failed: "Fehlerhaft",
  all: "Alle",
};

export interface CaseListItem {
  id: string;
  title: string;
  supplier_name: string | null;
  status: CaseStatus;
  extraction_status: string;
  consolidated_data: ExtractedOffer;
  warning_count: number;
  email_count: number;
  attachment_count: number;
  first_received_at: string | null;
  last_received_at: string | null;
  converted_catch_id: string | null;
}

export interface CaseEmail {
  id: string;
  subject: string | null;
  received_at: string;
  forwarded_by_email: string | null;
  forwarded_by_name: string | null;
  original_sender_email: string | null;
  original_sender_name: string | null;
  to_address: string | null;
  text_body: string | null;
  html_body: string | null;
  status: string;
  extraction_status: string;
  extraction_error: string | null;
  attachments: OfferAttachment[];
}

export interface CaseDetail {
  id: string;
  title: string;
  supplier_name: string | null;
  status: CaseStatus;
  extraction_status: string;
  extraction_error: string | null;
  consolidated_data: ExtractedOffer;
  warnings: string[];
  converted_catch_id: string | null;
  converted_at: string | null;
  emails: CaseEmail[];
}

function toWarnings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

/** Dossier braucht eine Handlung: prüfen, auswerten oder übernehmen. */
export function caseNeedsAction(item: CaseListItem): boolean {
  return item.status === "review" || item.extraction_status === "failed";
}

export function caseProductName(data: ExtractedOffer): string {
  const value = data.product_name?.value;
  return value ? String(value) : "Kein Produkt erkannt";
}

const LIST_SELECT =
  "id, title, supplier_name, status, extraction_status, consolidated_data, consolidation_warnings, converted_catch_id, updated_at, supplier_offer_emails(id, received_at, supplier_offer_attachments(count))";

interface RawEmailSummary {
  id: string;
  received_at: string;
  supplier_offer_attachments: { count: number }[] | null;
}

export async function fetchCases(filter: CaseFilter): Promise<CaseListItem[]> {
  let query = supabase
    .from("supplier_offer_cases")
    .select(LIST_SELECT)
    .order("updated_at", { ascending: false });

  if (filter === "open") query = query.in("status", ["review", "ready"]);
  if (filter === "converted") query = query.eq("status", "converted");
  if (filter === "failed") query = query.eq("extraction_status", "failed");

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const emails = (row.supplier_offer_emails ?? []) as unknown as RawEmailSummary[];
    const dates = emails.map((email) => email.received_at).sort();
    return {
      id: row.id,
      title: row.title,
      supplier_name: row.supplier_name,
      status: row.status as CaseStatus,
      extraction_status: row.extraction_status,
      consolidated_data: normaliseExtraction(row.consolidated_data),
      warning_count: toWarnings(row.consolidation_warnings).length,
      email_count: emails.length,
      attachment_count: emails.reduce(
        (total, email) => total + (email.supplier_offer_attachments?.[0]?.count ?? 0),
        0,
      ),
      first_received_at: dates[0] ?? null,
      last_received_at: dates[dates.length - 1] ?? null,
      converted_catch_id: row.converted_catch_id,
    };
  });
}

export async function fetchCase(caseId: string): Promise<CaseDetail | null> {
  const { data, error } = await supabase
    .from("supplier_offer_cases")
    .select("*, supplier_offer_emails(*, supplier_offer_attachments(*))")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const emails = (
    (data.supplier_offer_emails ?? []) as unknown as (CaseEmail & {
      supplier_offer_attachments: OfferAttachment[] | null;
    })[]
  )
    .map((email) => ({
      ...email,
      attachments: (email.supplier_offer_attachments ?? [])
        .slice()
        .sort((a, b) => a.file_name.localeCompare(b.file_name)),
    }))
    .sort((a, b) => a.received_at.localeCompare(b.received_at));

  return {
    id: data.id,
    title: data.title,
    supplier_name: data.supplier_name,
    status: data.status as CaseStatus,
    extraction_status: data.extraction_status,
    extraction_error: data.extraction_error,
    consolidated_data: normaliseExtraction(data.consolidated_data),
    warnings: toWarnings(data.consolidation_warnings),
    converted_catch_id: data.converted_catch_id,
    converted_at: data.converted_at,
    emails,
  };
}

export interface CaseOption {
  id: string;
  title: string;
  supplier_name: string | null;
  status: CaseStatus;
  email_count: number;
}

/** Auswahlliste für die manuelle Zuweisung — bereits übernommene Dossiers bleiben aussen vor. */
export async function fetchCaseOptions(excludeId?: string): Promise<CaseOption[]> {
  const { data, error } = await supabase
    .from("supplier_offer_cases")
    .select("id, title, supplier_name, status, supplier_offer_emails(id)")
    .neq("status", "converted")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.id !== excludeId)
    .map((row) => ({
      id: row.id,
      title: row.title,
      supplier_name: row.supplier_name,
      status: row.status as CaseStatus,
      email_count: ((row.supplier_offer_emails ?? []) as unknown[]).length,
    }));
}
