/**
 * Resend-Webhook für den Angebotseingang.
 *
 * Verarbeitet ausschliesslich `email.received` an die zentrale Angebotsadresse.
 * Der Endpunkt ist notwendigerweise öffentlich, deshalb wird jede Anfrage
 * zuerst gegen die Svix-Signatur geprüft.
 */

import { createFileRoute } from "@tanstack/react-router";

import {
  ensurePrimaryImage,
  fetchFullEmail,
  storeAttachments,
  type InboundEmailPayload,
} from "@/lib/supplier-offer-attachments.server";
import { emailPlainText, extractOfferFields } from "@/lib/supplier-offer-ai.server";
import {
  extractionWarnings,
  originalSenderFromBody,
} from "@/lib/supplier-offer-extraction";

export const DEFAULT_INBOUND_ADDRESS = "kundi-catch@rinueeldii.resend.app";

type SvixHeaders = { id: string; timestamp: string; signature: string };

function readSvixHeaders(request: Request): SvixHeaders | null {
  const id = request.headers.get("svix-id") ?? request.headers.get("webhook-id");
  const timestamp =
    request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp");
  const signature =
    request.headers.get("svix-signature") ?? request.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return null;
  return { id, timestamp, signature };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Svix-Schema: HMAC-SHA256 über `${id}.${timestamp}.${rawBody}`. */
export async function verifySignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
): Promise<boolean> {
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(headers.timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) return false;

  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${rawBody}`);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  const expected = bytesToBase64(digest);

  return headers.signature
    .split(" ")
    .map((part) => (part.includes(",") ? part.split(",")[1]! : part))
    .some((candidate) => timingSafeEqual(candidate, expected));
}

type ResendAddress = string | { address?: string; email?: string; name?: string };

type InboundEmail = InboundEmailPayload & {
  from?: ResendAddress;
  to?: ResendAddress[] | ResendAddress;
};

export function addressOf(value: ResendAddress | undefined): {
  address: string;
  name: string | null;
} {
  if (!value) return { address: "", name: null };
  if (typeof value === "string") {
    const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    if (match) return { address: match[2]!.trim().toLowerCase(), name: match[1] || null };
    return { address: value.trim().toLowerCase(), name: null };
  }
  const address = (value.address ?? value.email ?? "").trim().toLowerCase();
  return { address, name: value.name ?? null };
}

function recipientList(value: InboundEmail["to"]): ResendAddress[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Nur exakt die zentrale Angebotsadresse startet den Prozess. */
export function matchesInboundAddress(recipients: string[], inbound: string): boolean {
  const target = inbound.trim().toLowerCase();
  return recipients.some((address) => address.trim().toLowerCase() === target);
}

const ok = (message: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: true, message, ...extra }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

type AdminClientType = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function logDelivery(
  supabaseAdmin: AdminClientType,
  entry: {
    resend_email_id?: string | null;
    recipients?: string | null;
    from_address?: string | null;
    subject?: string | null;
    outcome: string;
    detail?: string | null;
    offer_id?: string | null;
  },
) {
  const { error } = await supabaseAdmin.from("inbound_email_log").insert({
    resend_email_id: entry.resend_email_id ?? null,
    recipients: entry.recipients ?? null,
    from_address: entry.from_address ?? null,
    subject: entry.subject ?? null,
    outcome: entry.outcome,
    detail: entry.detail ?? null,
    offer_id: entry.offer_id ?? null,
  });
  if (error) console.error("[resend-webhook] Protokolleintrag fehlgeschlagen", error.message);
}

export const Route = createFileRoute("/api/public/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[resend-webhook] RESEND_WEBHOOK_SECRET ist nicht gesetzt");
          return new Response("Not configured", { status: 500 });
        }
        const inboundAddress = process.env["RESEND_INBOUND_ADDRESS"] ?? DEFAULT_INBOUND_ADDRESS;

        const rawBody = await request.text();
        const headers = readSvixHeaders(request);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (!headers || !(await verifySignature(secret, headers, rawBody))) {
          await logDelivery(supabaseAdmin, {
            outcome: "invalid_signature",
            detail: headers
              ? "Signatur ungültig — prüfe, ob RESEND_WEBHOOK_SECRET zum Resend-Webhook passt."
              : "Anfrage ohne Signaturkopf.",
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { type?: string; data?: InboundEmail };
        try {
          payload = JSON.parse(rawBody) as { type?: string; data?: InboundEmail };
        } catch {
          await logDelivery(supabaseAdmin, { outcome: "error", detail: "Unlesbarer Inhalt." });
          return ok("ignored");
        }

        if (payload.type !== "email.received") {
          await logDelivery(supabaseAdmin, {
            outcome: "ignored",
            detail: `Ereignis ${payload.type ?? "unbekannt"}`,
          });
          return ok("ignored");
        }

        const data = payload.data ?? {};
        const resendEmailId = data.email_id ?? data.id;
        const recipients = recipientList(data.to).map((entry) => addressOf(entry).address);
        const forwarder = addressOf(data.from);
        const base = {
          resend_email_id: resendEmailId ?? null,
          recipients: recipients.join(", ") || null,
          from_address: forwarder.address || null,
          subject: data.subject ?? null,
        };

        if (!resendEmailId) {
          await logDelivery(supabaseAdmin, { ...base, outcome: "error", detail: "Keine E-Mail-ID." });
          return ok("ignored");
        }

        if (!matchesInboundAddress(recipients, inboundAddress)) {
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "ignored_recipient",
            detail: `Nicht an ${inboundAddress} gerichtet.`,
          });
          return ok("ignored recipient");
        }

        const { data: existing, error: existingError } = await supabaseAdmin
          .from("supplier_offer_emails")
          .select("id")
          .eq("resend_email_id", resendEmailId)
          .maybeSingle();
        if (existingError) {
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "error",
            detail: existingError.message,
          });
          return new Response("Lookup failed", { status: 500 });
        }
        if (existing) {
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "duplicate",
            offer_id: existing.id,
          });
          return ok("duplicate", { offer_id: existing.id });
        }

        let full: InboundEmail = data;
        let retrievalFailed = false;
        try {
          full = (await fetchFullEmail(resendEmailId, data)) as InboundEmail;
        } catch (error) {
          retrievalFailed = true;
          console.error(
            "[resend-webhook] Abruf fehlgeschlagen",
            error instanceof Error ? error.message : error,
          );
        }

        const bodyText = emailPlainText(full.text ?? null, full.html ?? null);
        const original = originalSenderFromBody(bodyText);

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("supplier_offer_emails")
          .insert({
            resend_email_id: resendEmailId,
            message_id: full.message_id ?? null,
            status: "new",
            forwarded_by_email: forwarder.address || null,
            forwarded_by_name: forwarder.name,
            original_sender_email: original.email,
            original_sender_name: original.name,
            to_address: inboundAddress,
            subject: full.subject ?? null,
            text_body: full.text ?? null,
            html_body: full.html ?? null,
            received_at: full.received_at ?? full.created_at ?? new Date().toISOString(),
            extraction_status: "pending",
          })
          .select("id")
          .single();
        if (insertError || !inserted) {
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "error",
            detail: insertError?.message ?? "Speichern fehlgeschlagen.",
          });
          return new Response("Insert failed", { status: 500 });
        }

        const offerId = inserted.id;
        await supabaseAdmin.from("audit_events").insert({
          entity_type: "supplier_offer",
          entity_id: offerId,
          action: "offer_received",
          actor_id: null,
          payload: { from: forwarder.address || null, subject: full.subject ?? null },
        });

        const attachmentResult = await storeAttachments(supabaseAdmin, {
          offerId,
          resendEmailId,
          attachments: full.attachments,
        });
        await ensurePrimaryImage(supabaseAdmin, offerId);

        // Auswertung ist «best effort»: ein Fehler verwirft die E-Mail nie.
        let extractionOutcome = "processed";
        try {
          await supabaseAdmin
            .from("supplier_offer_emails")
            .update({ status: "extracting", extraction_status: "running" })
            .eq("id", offerId);

          const result = await extractOfferFields({
            subject: full.subject ?? null,
            from: forwarder.address || null,
            body: bodyText,
            attachmentNames: (full.attachments ?? []).map(
              (item) => item.filename ?? item.name ?? "anhang",
            ),
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
            .eq("id", offerId);
          await supabaseAdmin.from("audit_events").insert({
            entity_type: "supplier_offer",
            entity_id: offerId,
            action: "offer_extracted",
            actor_id: null,
            payload: { model: result.model },
          });
        } catch (error) {
          extractionOutcome = "extraction_failed";
          const message = error instanceof Error ? error.message : "unbekannter Fehler";
          await supabaseAdmin
            .from("supplier_offer_emails")
            .update({
              status: "review",
              extraction_status: "failed",
              extraction_error: message,
            })
            .eq("id", offerId);
          await supabaseAdmin.from("audit_events").insert({
            entity_type: "supplier_offer",
            entity_id: offerId,
            action: "offer_extraction_failed",
            actor_id: null,
            payload: { error: message },
          });
        }

        const outcome = retrievalFailed
          ? "retrieval_failed"
          : attachmentResult.failed
            ? "attachment_failed"
            : extractionOutcome;

        await logDelivery(supabaseAdmin, {
          ...base,
          outcome,
          offer_id: offerId,
          detail: attachmentResult.detail,
        });

        return ok("stored", { offer_id: offerId });
      },
    },
  },
});
