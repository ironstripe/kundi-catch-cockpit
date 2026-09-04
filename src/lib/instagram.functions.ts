/**
 * Instagram-Publikation über den Automatisierungsdienst (Make.com).
 *
 * Auswahl, Text und Freigabe laufen serverseitig: Rolle, Reihenfolge
 * (erst WhatsApp) und Doppelpost-Schutz werden hier verbindlich geprüft.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_SECONDS = 24 * 60 * 60;
const CATCH_IMAGE_BUCKET = "catch-images";

export interface InstagramActionResult {
  status: string;
  message: string;
}

export interface InstagramConfigStatus {
  webhook_configured: boolean;
  callback_configured: boolean;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type Supa = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

async function assertEditor(supa: Supa, userId: string) {
  const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
    supa.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supa.rpc("has_role", { _user_id: userId, _role: "editor" }),
  ]);
  if (!isAdmin && !isEditor) throw new Error("Keine Berechtigung für Instagram.");
}

async function loadCatch(catchId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("catches")
    .select(
      "id, catch_number, product_name, status, published_at, instagram_selected, instagram_caption, instagram_asset_path, instagram_status, instagram_attempt",
    )
    .eq("id", catchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Catch nicht gefunden.");
  return { row: data, supabaseAdmin };
}

/** Catch für Instagram auswählen (nur nach bestätigter WhatsApp-Publikation). */
export const selectForInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { catchId: string; caption: string; assetPath: string | null }) => input)
  .handler(async ({ data, context }): Promise<InstagramActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadCatch(data.catchId);
    if (!row.published_at) {
      throw new Error("Instagram ist erst nach der WhatsApp-Publikation verfügbar.");
    }
    const { error } = await supabaseAdmin
      .from("catches")
      .update({
        instagram_selected: true,
        instagram_caption: data.caption,
        instagram_asset_path: data.assetPath,
        instagram_status: "ready",
        instagram_error: null,
      })
      .eq("id", data.catchId);
    if (error) throw error;

    await supabaseAdmin.from("audit_events").insert({
      entity_type: "catch",
      entity_id: data.catchId,
      action: "instagram_selected",
      actor_id: context.userId,
      payload: { catch_number: row.catch_number },
    });
    return { status: "ready", message: "Für Instagram ausgewählt." };
  });

/** Auswahl wieder zurücknehmen, solange nichts veröffentlicht wurde. */
export const unselectForInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { catchId: string }) => input)
  .handler(async ({ data, context }): Promise<InstagramActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadCatch(data.catchId);
    if (row.instagram_status === "published" || row.instagram_status === "publishing") {
      throw new Error("Die Veröffentlichung läuft bereits oder ist abgeschlossen.");
    }
    const { error } = await supabaseAdmin
      .from("catches")
      .update({ instagram_selected: false, instagram_status: "not_selected", instagram_error: null })
      .eq("id", data.catchId);
    if (error) throw error;
    return { status: "not_selected", message: "Auswahl aufgehoben." };
  });

/** Textänderung speichern. */
export const saveInstagramCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { catchId: string; caption: string; assetPath?: string | null }) => input)
  .handler(async ({ data, context }): Promise<InstagramActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    const { row, supabaseAdmin } = await loadCatch(data.catchId);
    if (row.instagram_status === "published" || row.instagram_status === "publishing") {
      throw new Error("Der Text kann nach der Freigabe nicht mehr geändert werden.");
    }
    const update: Record<string, unknown> = { instagram_caption: data.caption };
    if (data.assetPath !== undefined) update["instagram_asset_path"] = data.assetPath;
    const { error } = await supabaseAdmin.from("catches").update(update).eq("id", data.catchId);
    if (error) throw error;
    return { status: row.instagram_status, message: "Text gespeichert." };
  });

async function dispatch(catchId: string, userId: string, retry: boolean, publishAt: string | null) {
  const { row, supabaseAdmin } = await loadCatch(catchId);
  if (!row.published_at) throw new Error("Instagram ist erst nach der WhatsApp-Publikation verfügbar.");
  if (!row.instagram_selected) throw new Error("Dieser Catch ist nicht für Instagram ausgewählt.");
  if (row.instagram_status === "published") throw new Error("Dieser Catch wurde bereits veröffentlicht.");
  if (row.instagram_status === "publishing") throw new Error("Die Veröffentlichung läuft bereits.");
  if (retry && row.instagram_status !== "failed") throw new Error("Es gibt keinen fehlgeschlagenen Versuch.");
  if (!row.instagram_caption?.trim()) throw new Error("Es ist kein Instagram-Text vorhanden.");
  if (!row.instagram_asset_path) throw new Error("Es ist kein Instagram-Bild vorhanden.");

  const webhookUrl = process.env["MAKE_INSTAGRAM_WEBHOOK_URL"];
  const webhookSecret = process.env["MAKE_INSTAGRAM_WEBHOOK_SECRET"] ?? "";
  const callbackSecret = process.env["INSTAGRAM_CALLBACK_SECRET"] ?? "";
  if (!webhookUrl) throw new Error("Die Instagram-Automatisierung ist noch nicht eingerichtet.");

  const attempt = (row.instagram_attempt ?? 0) + 1;
  const idempotencyKey = `${catchId}:${attempt}`;
  const approvedAt = new Date().toISOString();

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(CATCH_IMAGE_BUCKET)
    .createSignedUrl(row.instagram_asset_path, SIGNED_URL_SECONDS);
  if (signError || !signed) throw new Error("Das Bild konnte nicht bereitgestellt werden.");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, name")
    .eq("id", userId)
    .maybeSingle();

  const { error: lockError } = await supabaseAdmin
    .from("catches")
    .update({
      instagram_status: "publishing",
      instagram_attempt: attempt,
      instagram_idempotency_key: idempotencyKey,
      instagram_approved_by: userId,
      instagram_approved_at: approvedAt,
      instagram_publish_at: publishAt,
      instagram_error: null,
    })
    .eq("id", catchId);
  if (lockError) throw lockError;

  await supabaseAdmin.from("audit_events").insert({
    entity_type: "catch",
    entity_id: catchId,
    action: retry ? "instagram_retried" : "instagram_approved",
    actor_id: userId,
    payload: { idempotency_key: idempotencyKey, publish_at: publishAt },
  });

  const origin = process.env["APP_PUBLIC_URL"] ?? "";
  const payload = {
    catch_id: catchId,
    catch_number: row.catch_number,
    idempotency_key: idempotencyKey,
    caption: row.instagram_caption,
    image_url: signed.signedUrl,
    publish_at: publishAt,
    approved_by: { id: userId, name: profile?.name ?? null },
    callback_url: `${origin}/api/public/instagram/callback`,
    callback_token: callbackSecret ? await hmacHex(callbackSecret, idempotencyKey) : null,
  };
  const body = JSON.stringify(payload);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kundi-signature": webhookSecret ? await hmacHex(webhookSecret, body) : "",
      },
      body,
    });
    if (!response.ok) throw new Error(`Automatisierung antwortete mit ${response.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    await supabaseAdmin
      .from("catches")
      .update({ instagram_status: "failed", instagram_error: message })
      .eq("id", catchId);
    await supabaseAdmin.from("audit_events").insert({
      entity_type: "catch",
      entity_id: catchId,
      action: "instagram_failed",
      actor_id: userId,
      payload: { idempotency_key: idempotencyKey, error: message },
    });
    throw new Error(`Übermittlung fehlgeschlagen: ${message}`);
  }

  return { status: "publishing", message: "Veröffentlichung gestartet." };
}

/** Freigeben und veröffentlichen. */
export const approveAndPublishInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { catchId: string; publishAt: string | null }) => input)
  .handler(async ({ data, context }): Promise<InstagramActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    return dispatch(data.catchId, context.userId, false, data.publishAt);
  });

/** Erneut versuchen nach einem Fehler. */
export const retryInstagramPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { catchId: string; publishAt: string | null }) => input)
  .handler(async ({ data, context }): Promise<InstagramActionResult> => {
    await assertEditor(context.supabase as unknown as Supa, context.userId);
    return dispatch(data.catchId, context.userId, true, data.publishAt);
  });

/** Ist die Automatisierung serverseitig hinterlegt? */
export const getInstagramConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<InstagramConfigStatus> => ({
    webhook_configured: Boolean(process.env["MAKE_INSTAGRAM_WEBHOOK_URL"]),
    callback_configured: Boolean(process.env["INSTAGRAM_CALLBACK_SECRET"]),
  }));

/** Verbindungstest: sendet einen Testaufruf an die Automatisierung. */
export const testInstagramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InstagramActionResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Keine Berechtigung.");
    const webhookUrl = process.env["MAKE_INSTAGRAM_WEBHOOK_URL"];
    if (!webhookUrl) throw new Error("Die Instagram-Automatisierung ist noch nicht eingerichtet.");
    const body = JSON.stringify({ test: true, sent_at: new Date().toISOString() });
    const secret = process.env["MAKE_INSTAGRAM_WEBHOOK_SECRET"] ?? "";
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kundi-signature": secret ? await hmacHex(secret, body) : "",
      },
      body,
    });
    if (!response.ok) throw new Error(`Automatisierung antwortete mit ${response.status}`);
    return { status: "ok", message: "Verbindung erfolgreich." };
  });
