/**
 * Angebotsdossiers: serverseitige Aktionen.
 *
 * Rolle, Reihenfolge und Einmaligkeit der Übernahme werden hier verbindlich
 * geprüft. E-Mails werden ausschliesslich durch eine bewusste Handlung
 * zusammengeführt — es gibt keine automatische Zuordnung.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createCaseForEmail,
  markCaseStale,
  runCaseExtraction,
} from "@/lib/offer-case-extraction.server";
import { SUPPLIER_OFFER_BUCKET } from "@/lib/supplier-offer-extraction";
import {
  extractionWarnings,
  fieldValue,
  hasManualEdits,
  MANUAL_EDIT_MARKER,
  missingRequiredFields,
  normaliseExtraction,
  OFFER_FIELD_LABELS,
  type ExtractedOffer,
} from "@/lib/supplier-offer-extraction";

export interface CaseActionResult {
  status: string;
  message: string;
}

type Supa = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function assertEditor(supa: Supa, userId: string) {
  const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
    supa.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supa.rpc("has_role", { _user_id: userId, _role: "editor" }),
  ]);
  if (!isAdmin && !isEditor) throw new Error("Keine Berechtigung für den Angebotseingang.");
}

async function loadCase(caseId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("supplier_offer_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Angebotsdossier nicht gefunden.");
  return { row: data, supabaseAdmin };
}

async function audit(
  supabaseAdmin: AdminClient,
  args: {
    caseId: string;
    action: string;
    actorId: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await supabaseAdmin.from("audit_events").insert({
    entity_type: "supplier_offer_case",
    entity_id: args.caseId,
    action: args.action,
    actor_id: args.actorId,
    payload: (args.payload ?? {}) as never,
  });
}

/** Konsolidierte Auswertung über alle Quellen des Dossiers. */
export const retryCaseExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; confirmOverwrite?: boolean }) => input)
  .handler(async ({ data, context }): Promise<CaseActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadCase(data.caseId);
    if (row.status === "converted") throw new Error("Das Dossier wurde bereits übernommen.");

    // Von Hand geprüfte Werte werden nie ungefragt überschrieben.
    if (!data.confirmOverwrite && hasManualEdits(normaliseExtraction(row.consolidated_data))) {
      throw new Error(MANUAL_EDIT_MARKER);
    }

    const result = await runCaseExtraction(supabaseAdmin, data.caseId);
    await audit(supabaseAdmin, {
      caseId: data.caseId,
      action: "case_extracted",
      actorId: context.userId,
      payload: { sources: result.sourceNames, emails: result.emailCount },
    });
    return {
      status: "review",
      message: `Auswertung abgeschlossen — einbezogen: ${result.sourceNames.join(", ")}.`,
    };
  });

/** Geprüfte Werte des Dossiers speichern. */
export const saveCaseFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; values: Record<string, unknown> }) => input)
  .handler(async ({ data, context }): Promise<CaseActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadCase(data.caseId);
    if (row.status === "converted") throw new Error("Das Dossier wurde bereits übernommen.");

    const previous = normaliseExtraction(row.consolidated_data);
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
      .from("supplier_offer_cases")
      .update({
        consolidated_data: next as never,
        consolidation_warnings: extractionWarnings(next) as never,
      })
      .eq("id", data.caseId);
    if (error) throw error;

    await audit(supabaseAdmin, {
      caseId: data.caseId,
      action: "case_conflict_resolved",
      actorId: context.userId,
    });
    return { status: row.status, message: "Änderungen gespeichert." };
  });

/** Titel des Dossiers ändern. */
export const renameCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; title: string }) => input)
  .handler(async ({ data, context }): Promise<CaseActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const title = data.title.trim();
    if (!title) throw new Error("Der Titel darf nicht leer sein.");
    const { supabaseAdmin } = await loadCase(data.caseId);
    const { error } = await supabaseAdmin
      .from("supplier_offer_cases")
      .update({ title })
      .eq("id", data.caseId);
    if (error) throw error;
    return { status: "ok", message: "Titel gespeichert." };
  });

/** Dossier ablegen oder wieder in Bearbeitung nehmen. */
export const setCaseIgnored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; ignored: boolean }) => input)
  .handler(async ({ data, context }): Promise<CaseActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadCase(data.caseId);
    if (row.status === "converted") throw new Error("Das Dossier wurde bereits übernommen.");

    const status = data.ignored ? "ignored" : "review";
    const { error } = await supabaseAdmin
      .from("supplier_offer_cases")
      .update({ status })
      .eq("id", data.caseId);
    if (error) throw error;
    await audit(supabaseAdmin, {
      caseId: data.caseId,
      action: data.ignored ? "case_ignored" : "case_reopened",
      actorId: context.userId,
    });
    return {
      status,
      message: data.ignored ? "Dossier abgelegt." : "Dossier wieder in Bearbeitung.",
    };
  });

async function emailCount(supabaseAdmin: AdminClient, caseId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("supplier_offer_emails")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);
  return count ?? 0;
}

/** Leeres, noch nicht übernommenes Dossier entfernen. */
async function dropIfEmpty(supabaseAdmin: AdminClient, caseId: string): Promise<boolean> {
  const { data: row } = await supabaseAdmin
    .from("supplier_offer_cases")
    .select("id, status, converted_catch_id")
    .eq("id", caseId)
    .maybeSingle();
  if (!row || row.converted_catch_id) return false;
  if ((await emailCount(supabaseAdmin, caseId)) > 0) return false;
  await supabaseAdmin.from("supplier_offer_cases").delete().eq("id", caseId);
  return true;
}

async function reExtractQuietly(supabaseAdmin: AdminClient, caseId: string): Promise<string> {
  try {
    const result = await runCaseExtraction(supabaseAdmin, caseId);
    return ` Auswertung aktualisiert (${result.sourceNames.length} Quellen).`;
  } catch {
    return " Die Auswertung konnte nicht automatisch aktualisiert werden — bitte «Auswertung wiederholen» nutzen.";
  }
}

/** E-Mail bewusst einem anderen Dossier zuweisen. */
export const assignEmailToCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { emailId: string; targetCaseId: string }) => input)
  .handler(async ({ data, context }): Promise<CaseActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row: target, supabaseAdmin } = await loadCase(data.targetCaseId);
    if (target.status === "converted") {
      throw new Error("In ein bereits übernommenes Dossier kann nichts verschoben werden.");
    }

    const { data: email } = await supabaseAdmin
      .from("supplier_offer_emails")
      .select("id, case_id, subject")
      .eq("id", data.emailId)
      .maybeSingle();
    if (!email) throw new Error("E-Mail nicht gefunden.");
    if (email.case_id === data.targetCaseId) {
      throw new Error("Die E-Mail gehört bereits zu diesem Dossier.");
    }

    const sourceCaseId = email.case_id;
    const { error } = await supabaseAdmin
      .from("supplier_offer_emails")
      .update({ case_id: data.targetCaseId })
      .eq("id", data.emailId);
    if (error) throw error;

    await audit(supabaseAdmin, {
      caseId: data.targetCaseId,
      action: "case_email_assigned",
      actorId: context.userId,
      payload: { email_id: data.emailId, from_case_id: sourceCaseId },
    });

    let note = "";
    if (sourceCaseId) {
      const removed = await dropIfEmpty(supabaseAdmin, sourceCaseId);
      if (!removed) {
        await markCaseStale(supabaseAdmin, sourceCaseId);
        note = " Das Ursprungsdossier muss neu ausgewertet werden.";
      }
    }

    const extraction = await reExtractQuietly(supabaseAdmin, data.targetCaseId);
    return { status: "ok", message: `E-Mail zugewiesen.${extraction}${note}` };
  });

/** E-Mail aus einem Dossier lösen und in ein neues Dossier stellen. */
export const createCaseFromEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { emailId: string; title?: string }) => input)
  .handler(async ({ data, context }): Promise<CaseActionResult & { caseId: string }> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: email } = await supabaseAdmin
      .from("supplier_offer_emails")
      .select("id, case_id, subject, original_sender_email, received_at")
      .eq("id", data.emailId)
      .maybeSingle();
    if (!email) throw new Error("E-Mail nicht gefunden.");

    const sourceCaseId = email.case_id;
    const caseId = await createCaseForEmail(
      supabaseAdmin,
      {
        id: email.id,
        subject: data.title?.trim() || email.subject,
        original_sender_email: email.original_sender_email,
      },
      context.userId,
    );

    if (sourceCaseId) {
      const removed = await dropIfEmpty(supabaseAdmin, sourceCaseId);
      if (!removed) await markCaseStale(supabaseAdmin, sourceCaseId);
    }

    const extraction = await reExtractQuietly(supabaseAdmin, caseId);
    return { status: "ok", caseId, message: `Neues Angebotsdossier erstellt.${extraction}` };
  });

/** Zwei Dossiers zusammenführen — alle E-Mails wandern, Quellen bleiben erhalten. */
export const mergeCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceCaseId: string; targetCaseId: string }) => input)
  .handler(async ({ data, context }): Promise<CaseActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    if (data.sourceCaseId === data.targetCaseId) {
      throw new Error("Quelle und Ziel sind dasselbe Dossier.");
    }
    const { row: source, supabaseAdmin } = await loadCase(data.sourceCaseId);
    const { row: target } = await loadCase(data.targetCaseId);
    if (source.status === "converted" || target.status === "converted") {
      throw new Error("Bereits übernommene Dossiers können nicht zusammengeführt werden.");
    }

    const moved = await emailCount(supabaseAdmin, data.sourceCaseId);
    const { error } = await supabaseAdmin
      .from("supplier_offer_emails")
      .update({ case_id: data.targetCaseId })
      .eq("case_id", data.sourceCaseId);
    if (error) throw error;

    await dropIfEmpty(supabaseAdmin, data.sourceCaseId);
    await audit(supabaseAdmin, {
      caseId: data.targetCaseId,
      action: "cases_merged",
      actorId: context.userId,
      payload: { source_case_id: data.sourceCaseId, moved_emails: moved },
    });

    const extraction = await reExtractQuietly(supabaseAdmin, data.targetCaseId);
    return {
      status: "ok",
      message: `${moved} E-Mail(s) übernommen.${extraction}`,
    };
  });

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Dossier in genau einen Catch-Entwurf übernehmen. */
export const convertCaseToCatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      values?: Record<string, unknown>;
      imageAttachmentId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<CaseActionResult & { catchId: string }> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadCase(data.caseId);
    if (row.converted_catch_id) throw new Error("Das Dossier wurde bereits übernommen.");

    const offer = normaliseExtraction(data.values ?? row.consolidated_data);
    const missing = missingRequiredFields(offer);
    if (missing.length) {
      throw new Error(
        `Es fehlen Pflichtangaben: ${missing.map((key) => OFFER_FIELD_LABELS[key]).join(", ")}.`,
      );
    }

    const { data: emails } = await supabaseAdmin
      .from("supplier_offer_emails")
      .select("id, received_at, subject, original_sender_email, forwarded_by_email")
      .eq("case_id", data.caseId)
      .order("received_at", { ascending: true });
    const sourceEmails = emails ?? [];
    if (!sourceEmails.length) throw new Error("Dieses Dossier enthält keine E-Mail.");
    const first = sourceEmails[0]!;

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
      `Aus Angebotsdossier «${row.title}» mit ${sourceEmails.length} E-Mail(s).`,
      ...sourceEmails.map(
        (email) =>
          `· ${new Date(email.received_at).toLocaleDateString("de-CH")}: ${
            email.subject ?? "(kein Betreff)"
          } — ${email.original_sender_email ?? email.forwarded_by_email ?? "unbekannt"}`,
      ),
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
        source_offer_id: first.id,
        source_case_id: data.caseId,
      })
      .select("id, catch_number")
      .single();
    if (createError || !created) {
      throw new Error(createError?.message ?? "Der Catch-Entwurf konnte nicht angelegt werden.");
    }

    // Gewähltes Produktbild aus einer beliebigen E-Mail des Dossiers übernehmen.
    const attachmentId = data.imageAttachmentId ?? null;
    if (attachmentId) {
      const { data: attachment } = await supabaseAdmin
        .from("supplier_offer_attachments")
        .select("storage_path, file_name, mime_type, offer_id")
        .eq("id", attachmentId)
        .maybeSingle();
      const belongs = attachment
        ? sourceEmails.some((email) => email.id === attachment.offer_id)
        : false;
      if (attachment && belongs) {
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
            "[case-convert] Bildübernahme fehlgeschlagen",
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("supplier_offer_cases")
      .update({
        status: "converted",
        consolidated_data: offer as never,
        converted_catch_id: created.id,
        converted_by: context.userId,
        converted_at: new Date().toISOString(),
      })
      .eq("id", data.caseId)
      .is("converted_catch_id", null);
    if (updateError) throw updateError;

    await supabaseAdmin
      .from("supplier_offer_emails")
      .update({ status: "converted" })
      .eq("case_id", data.caseId);

    await audit(supabaseAdmin, {
      caseId: data.caseId,
      action: "case_converted",
      actorId: context.userId,
      payload: {
        catch_id: created.id,
        catch_number: created.catch_number,
        emails: sourceEmails.map((email) => email.id),
      },
    });

    return { status: "converted", message: "Catch-Entwurf erstellt.", catchId: created.id };
  });
