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
import { emailPlainText, extractOfferFields } from "@/lib/supplier-offer-ai.server";
import {
  extractionWarnings,
  fieldValue,
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
export const retryOfferExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string }) => input)
  .handler(async ({ data, context }): Promise<OfferActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadOffer(data.offerId);
    if (row.status === "converted") throw new Error("Das Angebot wurde bereits übernommen.");

    await supabaseAdmin
      .from("supplier_offer_emails")
      .update({ status: "extracting", extraction_status: "running", extraction_error: null })
      .eq("id", row.id);

    const { data: attachments } = await supabaseAdmin
      .from("supplier_offer_attachments")
      .select("file_name")
      .eq("offer_id", row.id);

    try {
      const result = await extractOfferFields({
        subject: row.subject,
        from: row.forwarded_by_email,
        body: emailPlainText(row.text_body, row.html_body),
        attachmentNames: (attachments ?? []).map((item) => item.file_name),
      });
      await supabaseAdmin
        .from("supplier_offer_emails")
        .update({
          status: "review",
          extraction_status: "done",
          extracted_data: result.data as never,
          extraction_warnings: extractionWarnings(result.data) as never,
          extraction_error: null,
        })
        .eq("id", row.id);
      await audit(supabaseAdmin, {
        offerId: row.id,
        action: "offer_extracted",
        actorId: context.userId,
        payload: { model: result.model, retry: true },
      });
      return { status: "review", message: "Auswertung abgeschlossen." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Fehler";
      await supabaseAdmin
        .from("supplier_offer_emails")
        .update({ status: "review", extraction_status: "failed", extraction_error: message })
        .eq("id", row.id);
      await audit(supabaseAdmin, {
        offerId: row.id,
        action: "offer_extraction_failed",
        actorId: context.userId,
        payload: { error: message },
      });
      throw new Error(message);
    }
  });

/** Vollständige E-Mail und fehlende Anhänge erneut bei Resend holen. */
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
export const saveOfferFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string; values: Record<string, unknown> }) => input)
  .handler(async ({ data, context }): Promise<OfferActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadOffer(data.offerId);
    if (row.status === "converted") throw new Error("Das Angebot wurde bereits übernommen.");

    const previous = normaliseExtraction(row.extracted_data);
    const next = normaliseExtraction(data.values);
    for (const key of Object.keys(next) as (keyof ExtractedOffer)[]) {
      const before = previous[key];
      const after = next[key];
      if (after && before && after.value !== before.value) {
        after.source_excerpt = before.source_excerpt;
        after.confidence = null;
      }
    }

    const { error } = await supabaseAdmin
      .from("supplier_offer_emails")
      .update({
        extracted_data: next as never,
        extraction_warnings: extractionWarnings(next) as never,
        status: row.status === "new" ? "review" : row.status,
      })
      .eq("id", row.id);
    if (error) throw error;

    await audit(supabaseAdmin, {
      offerId: row.id,
      action: "offer_edited",
      actorId: context.userId,
    });
    return { status: "review", message: "Änderungen gespeichert." };
  });

/** Angebot als nicht relevant markieren (oder wieder öffnen). */
export const setOfferIgnored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string; ignored: boolean }) => input)
  .handler(async ({ data, context }): Promise<OfferActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadOffer(data.offerId);
    if (row.status === "converted") throw new Error("Das Angebot wurde bereits übernommen.");

    const status = data.ignored ? "ignored" : "review";
    const { error } = await supabaseAdmin
      .from("supplier_offer_emails")
      .update({ status })
      .eq("id", row.id);
    if (error) throw error;
    await audit(supabaseAdmin, {
      offerId: row.id,
      action: data.ignored ? "offer_ignored" : "offer_reopened",
      actorId: context.userId,
    });
    return {
      status,
      message: data.ignored ? "Angebot abgelegt." : "Angebot wieder in Bearbeitung.",
    };
  });

/** Art eines Anhangs setzen und optional als Hauptbild markieren. */
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

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Angebot in einen Catch-Entwurf übernehmen — genau einmal möglich. */
export const convertOfferToCatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      offerId: string;
      values?: Record<string, unknown>;
      imageAttachmentId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<OfferActionResult & { catchId: string }> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadOffer(data.offerId);
    if (row.converted_catch_id) throw new Error("Das Angebot wurde bereits übernommen.");

    const offer = normaliseExtraction(data.values ?? row.extracted_data);
    const missing = missingRequiredFields(offer);
    if (missing.length) {
      throw new Error(
        `Es fehlen Pflichtangaben: ${missing.map((key) => OFFER_FIELD_LABELS[key]).join(", ")}.`,
      );
    }

    // Lieferant nur zuordnen, wenn er in den Stammdaten existiert.
    const supplierName = fieldValue(offer, "supplier_name");
    let supplierId: string | null = null;
    if (typeof supplierName === "string" && supplierName.trim()) {
      const { data: supplier } = await supabaseAdmin
        .from("suppliers")
        .select("id")
        .ilike("name", supplierName.trim())
        .maybeSingle();
      supplierId = supplier?.id ?? null;
    }

    const temperature = fieldValue(offer, "temperature") === "frozen" ? "frozen" : "fresh";
    const availableFrom = fieldValue(offer, "available_from");
    const details = [
      fieldValue(offer, "origin") ? `Herkunft: ${fieldValue(offer, "origin")}` : null,
      fieldValue(offer, "certification")
        ? `Zertifizierung: ${fieldValue(offer, "certification")}`
        : null,
      fieldValue(offer, "size_calibration")
        ? `Grösse: ${fieldValue(offer, "size_calibration")}`
        : null,
      fieldValue(offer, "glazing") ? `Glasur: ${fieldValue(offer, "glazing")}` : null,
    ].filter(Boolean);

    const internalNote = [
      `Aus Lieferantenangebot vom ${new Date(row.received_at).toLocaleDateString("de-CH")}.`,
      row.original_sender_email ? `Ursprünglicher Absender: ${row.original_sender_email}` : null,
      row.forwarded_by_email ? `Weitergeleitet von: ${row.forwarded_by_email}` : null,
      fieldValue(offer, "article_number")
        ? `Artikelnummer: ${fieldValue(offer, "article_number")}`
        : null,
      fieldValue(offer, "other_conditions")
        ? `Konditionen: ${fieldValue(offer, "other_conditions")}`
        : null,
      fieldValue(offer, "delivery_location")
        ? `Liefer- oder Abholort: ${fieldValue(offer, "delivery_location")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: created, error: createError } = await supabaseAdmin
      .from("catches")
      .insert({
        product_name: String(fieldValue(offer, "product_name")),
        temperature,
        status: "draft",
        description: details.join(" · ") || null,
        packaging: (fieldValue(offer, "packaging") as string | null) ?? null,
        expiry_date: (fieldValue(offer, "expiry_date") as string | null) ?? null,
        supplier_id: supplierId,
        purchase_quantity: numberOrNull(fieldValue(offer, "available_quantity")) ?? 0,
        quantity_unit: (fieldValue(offer, "quantity_unit") as string | null) ?? "kg",
        purchase_price: numberOrNull(fieldValue(offer, "purchase_price")),
        regular_price: numberOrNull(fieldValue(offer, "regular_price")),
        delivery_cost: numberOrNull(fieldValue(offer, "delivery_cost")) ?? 0,
        available_from: typeof availableFrom === "string" ? `${availableFrom}T00:00:00Z` : null,
        handicap_reason: (fieldValue(offer, "offer_reason") as string | null) ?? null,
        internal_note: internalNote || null,
        created_by: context.userId,
        source_offer_id: row.id,
      })
      .select("id, catch_number")
      .single();
    if (createError || !created) {
      throw new Error(createError?.message ?? "Der Catch-Entwurf konnte nicht angelegt werden.");
    }

    // Gewähltes Produktbild in die Catch-Bilder übernehmen.
    const attachmentId = data.imageAttachmentId ?? null;
    if (attachmentId) {
      const { data: attachment } = await supabaseAdmin
        .from("supplier_offer_attachments")
        .select("storage_path, file_name, mime_type")
        .eq("id", attachmentId)
        .eq("offer_id", row.id)
        .maybeSingle();
      if (attachment) {
        try {
          const download = await supabaseAdmin.storage
            .from(SUPPLIER_OFFER_BUCKET)
            .download(attachment.storage_path);
          if (download.data) {
            const bytes = new Uint8Array(await download.data.arrayBuffer());
            const target = `${created.id}/${crypto.randomUUID()}-${attachment.file_name.replace(/[^\w.-]+/g, "_")}`;
            const upload = await supabaseAdmin.storage
              .from("catch-images")
              .upload(target, bytes as unknown as ArrayBuffer, {
                contentType: attachment.mime_type,
                upsert: false,
              });
            if (!upload.error) {
              await supabaseAdmin.from("catch_images").insert({
                catch_id: created.id,
                storage_path: target,
                is_primary: true,
                sort_order: 0,
              });
            }
          }
        } catch (error) {
          console.error(
            "[offer-convert] Bildübernahme fehlgeschlagen",
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("supplier_offer_emails")
      .update({
        status: "converted",
        converted_catch_id: created.id,
        converted_by: context.userId,
        converted_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .is("converted_catch_id", null);
    if (updateError) throw updateError;

    await audit(supabaseAdmin, {
      offerId: row.id,
      action: "offer_converted",
      actorId: context.userId,
      payload: { catch_id: created.id, catch_number: created.catch_number },
    });

    return {
      status: "converted",
      message: "Catch-Entwurf erstellt.",
      catchId: created.id,
    };
  });

export interface InboundConfigStatus {
  webhook_secret_configured: boolean;
  api_key_configured: boolean;
  inbound_address: string;
  webhook_url: string;
}

/** Diagnose für Admins: Ist der Angebotseingang vollständig eingerichtet? */
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
