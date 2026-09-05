/**
 * Angebotseingang: Lesezugriffe für die Oberfläche.
 * Alle schreibenden Aktionen laufen über Server-Funktionen.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  normaliseExtraction,
  SUPPLIER_OFFER_BUCKET,
  type ExtractedOffer,
} from "@/lib/supplier-offer-extraction";

export { SUPPLIER_OFFER_BUCKET };

export type OfferStatus = "new" | "extracting" | "review" | "converted" | "ignored" | "failed";

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  new: "Neu",
  extracting: "Wird ausgewertet",
  review: "Zur Prüfung",
  converted: "Übernommen",
  ignored: "Abgelegt",
  failed: "Fehlerhaft",
};

export const EXTRACTION_STATUS_LABELS: Record<string, string> = {
  pending: "Offen",
  running: "Läuft",
  done: "Ausgewertet",
  failed: "Fehlgeschlagen",
  skipped: "Übersprungen",
};

export const ATTACHMENT_KIND_LABELS: Record<string, string> = {
  product_image: "Produktbild",
  product_label: "Etikett",
  specification: "Technische Unterlagen",
  price_list: "Preistabelle",
  other: "Sonstiges",
};

export type OfferFilter = "open" | "converted" | "failed" | "all";

export const OFFER_FILTER_LABELS: Record<OfferFilter, string> = {
  open: "Offen",
  converted: "Übernommen",
  failed: "Fehlerhaft",
  all: "Alle",
};

export interface OfferListItem {
  id: string;
  status: OfferStatus;
  received_at: string;
  forwarded_by_email: string | null;
  original_sender_email: string | null;
  subject: string | null;
  extraction_status: string;
  extraction_error: string | null;
  extracted_data: ExtractedOffer;
  attachment_count: number;
  converted_catch_id: string | null;
}

export interface OfferAttachment {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  kind: string;
  is_primary_image: boolean;
}

export interface OfferDetail extends OfferListItem {
  forwarded_by_name: string | null;
  original_sender_name: string | null;
  to_address: string | null;
  text_body: string | null;
  html_body: string | null;
  message_id: string | null;
  extraction_warnings: string[];
  converted_at: string | null;
  attachments: OfferAttachment[];
}

const LIST_SELECT =
  "id, status, received_at, forwarded_by_email, original_sender_email, subject, extraction_status, extraction_error, extracted_data, converted_catch_id, supplier_offer_attachments(count)";

function toWarnings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

export function offerProductName(offer: ExtractedOffer): string {
  const value = offer.product_name?.value;
  return value ? String(value) : "Kein Produkt erkannt";
}

/** Angebot braucht eine Handlung: geprüft, ausgewertet oder übernommen werden. */
export function needsAction(item: OfferListItem): boolean {
  return item.status === "new" || item.status === "review" || item.extraction_status === "failed";
}

export async function fetchOffers(filter: OfferFilter): Promise<OfferListItem[]> {
  let query = supabase
    .from("supplier_offer_emails")
    .select(LIST_SELECT)
    .order("received_at", { ascending: false });

  if (filter === "open") query = query.in("status", ["new", "extracting", "review"]);
  if (filter === "converted") query = query.eq("status", "converted");
  if (filter === "failed") query = query.or("status.eq.failed,extraction_status.eq.failed");

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const counts = row.supplier_offer_attachments as unknown as { count: number }[] | null;
    return {
      id: row.id,
      status: row.status as OfferStatus,
      received_at: row.received_at,
      forwarded_by_email: row.forwarded_by_email,
      original_sender_email: row.original_sender_email,
      subject: row.subject,
      extraction_status: row.extraction_status,
      extraction_error: row.extraction_error,
      extracted_data: normaliseExtraction(row.extracted_data),
      attachment_count: counts?.[0]?.count ?? 0,
      converted_catch_id: row.converted_catch_id,
    };
  });
}

export async function fetchOffer(offerId: string): Promise<OfferDetail | null> {
  const { data, error } = await supabase
    .from("supplier_offer_emails")
    .select("*, supplier_offer_attachments(*)")
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const attachments = ((data.supplier_offer_attachments ?? []) as OfferAttachment[])
    .slice()
    .sort((a, b) => a.file_name.localeCompare(b.file_name));

  return {
    id: data.id,
    status: data.status as OfferStatus,
    received_at: data.received_at,
    forwarded_by_email: data.forwarded_by_email,
    forwarded_by_name: data.forwarded_by_name,
    original_sender_email: data.original_sender_email,
    original_sender_name: data.original_sender_name,
    to_address: data.to_address,
    subject: data.subject,
    text_body: data.text_body,
    html_body: data.html_body,
    message_id: data.message_id,
    extraction_status: data.extraction_status,
    extraction_error: data.extraction_error,
    extracted_data: normaliseExtraction(data.extracted_data),
    extraction_warnings: toWarnings(data.extraction_warnings),
    attachment_count: attachments.length,
    converted_catch_id: data.converted_catch_id,
    converted_at: data.converted_at,
    attachments,
  };
}

export async function signedAttachmentUrl(path: string, seconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SUPPLIER_OFFER_BUCKET)
    .createSignedUrl(path, seconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export interface InboundLogEntry {
  id: string;
  received_at: string;
  resend_email_id: string | null;
  recipients: string | null;
  from_address: string | null;
  subject: string | null;
  outcome: string;
  detail: string | null;
  offer_id: string | null;
}

export const OUTCOME_LABELS: Record<string, string> = {
  received: "Empfangen",
  processed: "Verarbeitet",
  ignored: "Ignoriert",
  ignored_recipient: "Andere Adresse",
  duplicate: "Doppelte Zustellung",
  invalid_signature: "Signatur ungültig",
  retrieval_failed: "Abruf fehlgeschlagen",
  attachment_failed: "Anhang fehlgeschlagen",
  extraction_failed: "Auswertung fehlgeschlagen",
  error: "Fehler",
};

export async function fetchInboundLog(limit = 50): Promise<InboundLogEntry[]> {
  const { data, error } = await supabase
    .from("inbound_email_log")
    .select(
      "id, received_at, resend_email_id, recipients, from_address, subject, outcome, detail, offer_id",
    )
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InboundLogEntry[];
}
