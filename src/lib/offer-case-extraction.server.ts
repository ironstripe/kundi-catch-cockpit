/**
 * Konsolidierte Auswertung eines Angebotsdossiers.
 *
 * Ein Dossier bündelt mehrere Lieferanten-E-Mails und deren Anhänge. Die
 * Auswertung erhält jede Quelle einzeln und klar benannt — es wird nichts zu
 * einem undurchsichtigen Textblock verschmolzen. Ergebnis ist immer nur ein
 * Vorschlag; die Freigabe bleibt beim Menschen.
 */

import { emailPlainText, emailSource, extractOfferFields } from "@/lib/supplier-offer-ai.server";
import { processOfferAttachmentContents } from "@/lib/supplier-offer-content.server";
import {
  combineWarnings,
  extractionWarnings,
  findingWarnings,
  normaliseExtraction,
  OFFER_FIELD_KEYS,
  type ExtractedOffer,
} from "@/lib/supplier-offer-extraction";
import { stampProvenance } from "@/lib/offer-case-provenance";
import type { OfferExtractionSource } from "@/lib/supplier-offer-sources";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export interface CaseExtractionResult {
  data: ExtractedOffer;
  warnings: string[];
  sourceNames: string[];
  emailCount: number;
}

/**
 * Liest alle Quellen eines Dossiers und schreibt den konsolidierten Vorschlag
 * in das Dossier zurück. Wirft bei Fehlern mit verständlicher Meldung.
 */
export async function runCaseExtraction(
  supabaseAdmin: AdminClient,
  caseId: string,
): Promise<CaseExtractionResult> {
  const { data: emails, error } = await supabaseAdmin
    .from("supplier_offer_emails")
    .select("id, subject, text_body, html_body, received_at, forwarded_by_email")
    .eq("case_id", caseId)
    .order("received_at", { ascending: true });
  if (error) throw error;
  if (!emails?.length) throw new Error("Dieses Angebotsdossier enthält keine E-Mail.");

  await supabaseAdmin
    .from("supplier_offer_cases")
    .update({ extraction_status: "running", extraction_error: null })
    .eq("id", caseId);

  try {
    const sources: OfferExtractionSource[] = [];
    let failed = 0;

    for (const email of emails) {
      sources.push(
        emailSource(email.subject, emailPlainText(email.text_body, email.html_body), {
          email_id: email.id,
          received_at: email.received_at,
        }),
      );
      const attachments = await processOfferAttachmentContents(supabaseAdmin, email.id);
      failed += attachments.failed;
      for (const source of attachments.sources) {
        sources.push({ ...source, email_id: email.id, received_at: email.received_at });
      }
    }

    const first = emails[0]!;
    const result = await extractOfferFields({
      subject: first.subject,
      from: first.forwarded_by_email,
      sources,
    });

    const data = stampProvenance(normaliseExtraction(result.data), sources);
    const warnings = combineWarnings(
      extractionWarnings(data),
      findingWarnings(result.findings),
      failed ? [`${failed} Anhang/Anhänge konnten nicht gelesen werden.`] : [],
      emails.length > 1
        ? [
            `Der Vorschlag beruht auf ${emails.length} E-Mails. Bitte widersprüchliche Angaben prüfen.`,
          ]
        : [],
    );

    const supplierName = data.supplier_name?.value;
    await supabaseAdmin
      .from("supplier_offer_cases")
      .update({
        consolidated_data: data as never,
        consolidation_warnings: warnings as never,
        extraction_status: "done",
        extraction_error: null,
        supplier_name: typeof supplierName === "string" ? supplierName : null,
      })
      .eq("id", caseId);

    return {
      data,
      warnings,
      sourceNames: sources.map((source) => source.source_name),
      emailCount: emails.length,
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "unbekannter Fehler";
    await supabaseAdmin
      .from("supplier_offer_cases")
      .update({ extraction_status: "failed", extraction_error: message })
      .eq("id", caseId);
    throw new Error(message);
  }
}

/** Kennzeichnet ein Dossier als «Quellen geändert — Auswertung nötig». */
export async function markCaseStale(supabaseAdmin: AdminClient, caseId: string): Promise<void> {
  await supabaseAdmin
    .from("supplier_offer_cases")
    .update({ extraction_status: "pending" })
    .eq("id", caseId);
}

/** Legt für eine E-Mail ein eigenes Dossier an (keine automatische Zuordnung). */
export async function createCaseForEmail(
  supabaseAdmin: AdminClient,
  email: { id: string; subject: string | null; original_sender_email: string | null },
  actorId: string | null,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("supplier_offer_cases")
    .insert({
      title: email.subject?.trim() || "Angebot ohne Betreff",
      supplier_name: email.original_sender_email,
      status: "review",
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Dossier konnte nicht angelegt werden.");

  await supabaseAdmin.from("supplier_offer_emails").update({ case_id: data.id }).eq("id", email.id);

  await supabaseAdmin.from("audit_events").insert({
    entity_type: "supplier_offer_case",
    entity_id: data.id,
    action: "case_created",
    actor_id: actorId,
    payload: { email_id: email.id, subject: email.subject } as never,
  });
  return data.id;
}
