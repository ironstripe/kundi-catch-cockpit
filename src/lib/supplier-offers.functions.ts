/**
 * Angebotseingang: serverseitige Aktionen.
 *
 * Rolle, Reihenfolge und Einmaligkeit der Übernahme werden hier verbindlich
 * geprüft — die Oberfläche blendet Aktionen nur zusätzlich aus.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ensurePrimaryImage,
  fetchFullEmail,
  storeAttachments,
  SUPPLIER_OFFER_BUCKET,
  type InboundEmailPayload,
} from "@/lib/supplier-offer-attachments.server";
import { emailPlainText, emailSource, extractOfferFields } from "@/lib/supplier-offer-ai.server";
import { processOfferAttachmentContents } from "@/lib/supplier-offer-content.server";
import {
  combineWarnings,
  extractionWarnings,
  fieldValue,
  findingWarnings,
  hasManualEdits,
  MANUAL_EDIT_MARKER,
  missingRequiredFields,
  normaliseExtraction,
  OFFER_FIELD_LABELS,
  type ExtractedOffer,
} from "@/lib/supplier-offer-extraction";

export interface OfferActionResult {
  status: string;
  message: string;
}

type Supa = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

async function assertEditor(supa: Supa, userId: string) {
  const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
    supa.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supa.rpc("has_role", { _user_id: userId, _role: "editor" }),
  ]);
  if (!isAdmin && !isEditor) throw new Error("Keine Berechtigung für den Angebotseingang.");
}

async function loadOffer(offerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("supplier_offer_emails")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Angebot nicht gefunden.");
  return { row: data, supabaseAdmin };
}

async function audit(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  args: {
    offerId: string;
    action: string;
    actorId: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await supabaseAdmin.from("audit_events").insert({
    entity_type: "supplier_offer",
    entity_id: args.offerId,
    action: args.action,
    actor_id: args.actorId,
    payload: (args.payload ?? {}) as never,
  });
}

/** Auswertung erneut ausführen — idempotent, überschreibt das Ergebnis. */
export const retryOfferRetrieval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string }) => input)
  .handler(async ({ data, context }): Promise<OfferActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadOffer(data.offerId);

    const payload: InboundEmailPayload = { email_id: row.resend_email_id };
    if (row.subject) payload.subject = row.subject;
    if (row.text_body) payload.text = row.text_body;
    if (row.html_body) payload.html = row.html_body;
    const full = await fetchFullEmail(row.resend_email_id, payload);

    await supabaseAdmin
      .from("supplier_offer_emails")
      .update({
        text_body: full.text ?? row.text_body,
        html_body: full.html ?? row.html_body,
      })
      .eq("id", row.id);

    const { data: existing } = await supabaseAdmin
      .from("supplier_offer_attachments")
      .select("file_name")
      .eq("offer_id", row.id);

    const result = await storeAttachments(supabaseAdmin, {
      offerId: row.id,
      resendEmailId: row.resend_email_id,
      attachments: full.attachments,
      existingNames: (existing ?? []).map((item) => item.file_name),
    });
    await ensurePrimaryImage(supabaseAdmin, row.id);

    return {
      status: "ok",
      message: result.detail ?? "Es waren keine weiteren Anhänge vorhanden.",
    };
  });

/** Korrigierte Felder speichern. */
export const updateOfferAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { offerId: string; attachmentId: string; kind?: string; primary?: boolean }) => input,
  )
  .handler(async ({ data, context }): Promise<OfferActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { supabaseAdmin } = await loadOffer(data.offerId);

    if (data.primary) {
      await supabaseAdmin
        .from("supplier_offer_attachments")
        .update({ is_primary_image: false })
        .eq("offer_id", data.offerId);
    }
    const patch: Record<string, unknown> = {};
    if (data.kind) patch["kind"] = data.kind;
    if (data.primary !== undefined) patch["is_primary_image"] = data.primary;

    const { error } = await supabaseAdmin
      .from("supplier_offer_attachments")
      .update(patch as never)
      .eq("id", data.attachmentId)
      .eq("offer_id", data.offerId);
    if (error) throw error;

    if (data.primary) {
      await audit(supabaseAdmin, {
        offerId: data.offerId,
        action: "offer_image_selected",
        actorId: context.userId,
        payload: { attachment_id: data.attachmentId },
      });
    }
    return { status: "ok", message: "Anhang aktualisiert." };
  });

export interface InboundConfigStatus {
  webhook_secret_configured: boolean;
  api_key_configured: boolean;
  inbound_address: string;
  webhook_url: string;
}

export const getInboundConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboundConfigStatus> => {
    const { data: isAdmin } = await (context.supabase as unknown as Supa).rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Nur Administratoren sehen die Diagnose.");
    const origin = process.env["SITE_URL"] ?? "https://kundi-catch-core.lovable.app";
    return {
      webhook_secret_configured: Boolean(process.env["RESEND_WEBHOOK_SECRET"]),
      api_key_configured: Boolean(process.env["RESEND_API_KEY"]),
      inbound_address: process.env["RESEND_INBOUND_ADDRESS"] ?? "kundi-catch@rinueeldii.resend.app",
      webhook_url: `${origin}/api/public/webhooks/resend`,
    };
  });

/** Inhalt eines einzelnen Anhangs erneut lesen. */
export const retryAttachmentContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string; attachmentId: string }) => input)
  .handler(async ({ data, context }): Promise<OfferActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { supabaseAdmin } = await loadOffer(data.offerId);

    const result = await processOfferAttachmentContents(supabaseAdmin, data.offerId, {
      force: true,
      attachmentId: data.attachmentId,
    });
    return {
      status: result.read ? "done" : "failed",
      message: result.read
        ? "Inhalt gelesen. Für neue Angaben bitte die Auswertung wiederholen."
        : "Der Inhalt konnte nicht gelesen werden.",
    };
  });
