/**
 * Anhänge weitergeleiteter Lieferantenangebote holen, prüfen und ablegen.
 *
 * Resend liefert im Webhook nur die Metadaten der Anhänge; die Bytes müssen
 * über die Resend-API nachgeladen werden. Die Ablage erfolgt im privaten
 * Bucket `supplier-offers`.
 */

export { SUPPLIER_OFFER_BUCKET } from "@/lib/supplier-offer-extraction";
import { SUPPLIER_OFFER_BUCKET } from "@/lib/supplier-offer-extraction";

/** Grösster akzeptierter Anhang (Bucket-Limit). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Nur diese Dateitypen werden übernommen. */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "message/rfc822",
] as const;

export type AttachmentKind =
  "product_image" | "product_label" | "specification" | "price_list" | "other";

export type ResendAttachment = {
  id?: string;
  filename?: string;
  name?: string;
  content_type?: string;
  contentType?: string;
  content?: string;
  content_url?: string;
  download_url?: string;
  url?: string;
  size?: number;
  content_id?: string;
  disposition?: string;
};

export type InboundEmailPayload = {
  email_id?: string;
  id?: string;
  message_id?: string;
  from?: unknown;
  to?: unknown;
  subject?: string;
  text?: string;
  html?: string;
  raw?: string;
  created_at?: string;
  received_at?: string;
  attachments?: ResendAttachment[];
};

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function attachmentName(attachment: ResendAttachment): string {
  return attachment.filename ?? attachment.name ?? "anhang";
}

export function attachmentMime(attachment: ResendAttachment): string {
  const declared = (attachment.content_type ?? attachment.contentType ?? "").toLowerCase();
  if (declared) return declared.split(";")[0]!.trim();
  const name = attachmentName(attachment).toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (name.endsWith(".xls")) return "application/vnd.ms-excel";
  if (name.endsWith(".eml")) return "message/rfc822";
  return "application/octet-stream";
}

export function isAllowedMime(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/** Logos und Signaturbilder gehören nicht in den Angebotseingang. */
export function isDecorativeImage(attachment: ResendAttachment, byteLength: number): boolean {
  const name = attachmentName(attachment).toLowerCase();
  const mime = attachmentMime(attachment);
  if (!mime.startsWith("image/")) return false;
  if (/(logo|signatur|signature|icon|footer|banner|smime)/.test(name)) return true;
  if (attachment.content_id && attachment.disposition === "inline") return true;
  return byteLength > 0 && byteLength < 12 * 1024;
}

/** Grobe Einordnung des Anhangs — im Detail jederzeit korrigierbar. */
export function classifyAttachment(attachment: ResendAttachment): AttachmentKind {
  const name = attachmentName(attachment).toLowerCase();
  const mime = attachmentMime(attachment);
  if (/(etikett|label|nährwert|naehrwert|ingredient)/.test(name)) return "product_label";
  if (/(preis|price|offerte|angebot|liste)/.test(name)) return "price_list";
  if (/(spec|spezifikation|datenblatt|zertifikat|certificate|msc|asc)/.test(name)) {
    return "specification";
  }
  if (mime.startsWith("image/")) return "product_image";
  if (
    mime === "text/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet"
  ) {
    return "price_list";
  }
  return "other";
}

function safeName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(-120);
}

function hasContent(attachment: ResendAttachment) {
  return Boolean(
    attachment.content ?? attachment.content_url ?? attachment.download_url ?? attachment.url,
  );
}

/** True, wenn Text oder Anhang-Bytes im Webhook-Payload fehlen. */
export function needsResendLookup(data: InboundEmailPayload): boolean {
  const hasBody = Boolean(data.text || data.html);
  const attachments = data.attachments;
  if (!Array.isArray(attachments)) return true;
  if (attachments.some((a) => !hasContent(a))) return true;
  return !hasBody;
}

/** Holt die vollständige E-Mail (Text und Anhang-Links) über die Resend-API. */
export async function fetchFullEmail(
  emailId: string,
  data: InboundEmailPayload,
): Promise<InboundEmailPayload> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey || !needsResendLookup(data)) return data;

  let current = data;
  for (const url of [
    `https://api.resend.com/emails/inbound/${emailId}`,
    `https://api.resend.com/emails/${emailId}`,
  ]) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!response.ok) continue;
      const body = (await response.json()) as InboundEmailPayload;
      const merged: InboundEmailPayload = { ...current, ...body };
      if (Array.isArray(body.attachments) && body.attachments.length) {
        merged.attachments = body.attachments;
      }
      if (!needsResendLookup(merged)) return merged;
      current = merged;
    } catch (error) {
      console.error(
        `[resend] Abruf fehlgeschlagen für ${emailId}:`,
        error instanceof Error ? error.message : "unbekannter Fehler",
      );
    }
  }
  return current;
}

async function downloadBytes(url: string, apiKey: string | undefined) {
  const isResend = url.startsWith("https://api.resend.com");
  const response = await fetch(url, {
    headers: isResend && apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!response.ok) throw new Error(`Download fehlgeschlagen (HTTP ${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

async function attachmentBytes(emailId: string, attachment: ResendAttachment): Promise<Uint8Array> {
  if (attachment.content) return base64ToBytes(attachment.content);

  const apiKey = process.env["RESEND_API_KEY"];
  const direct = attachment.content_url ?? attachment.download_url ?? attachment.url;
  if (direct) return downloadBytes(direct, apiKey);
  if (!apiKey) throw new Error("RESEND_API_KEY fehlt — Anhang kann nicht geholt werden.");

  const ref = attachment.id ?? attachmentName(attachment);
  const candidates = [
    `https://api.resend.com/emails/inbound/${emailId}/attachments/${encodeURIComponent(ref)}`,
    `https://api.resend.com/emails/${emailId}/attachments/${encodeURIComponent(ref)}`,
  ];

  let lastError = "kein Inhalt verfügbar";
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const body = (await response.json()) as ResendAttachment;
        if (body.content) return base64ToBytes(body.content);
        const link = body.content_url ?? body.download_url ?? body.url;
        if (link) return downloadBytes(link, apiKey);
        lastError = "Antwort ohne Inhalt";
        continue;
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unbekannter Fehler";
    }
  }
  throw new Error(lastError);
}

async function storeAttachment(
  supabaseAdmin: AdminClient,
  offerId: string,
  resendEmailId: string,
  attachment: ResendAttachment,
): Promise<"stored" | "skipped"> {
  const fileName = attachmentName(attachment);
  const mimeType = attachmentMime(attachment);
  if (!isAllowedMime(mimeType)) throw new Error(`Dateityp ${mimeType} ist nicht zugelassen.`);
  if ((attachment.size ?? 0) > MAX_ATTACHMENT_BYTES) {
    throw new Error("Datei überschreitet 25 MB.");
  }

  const bytes = await attachmentBytes(resendEmailId, attachment);
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("Datei überschreitet 25 MB.");
  if (isDecorativeImage(attachment, bytes.byteLength)) return "skipped";

  const path = `${offerId}/${crypto.randomUUID()}-${safeName(fileName)}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(SUPPLIER_OFFER_BUCKET)
    .upload(path, bytes as unknown as ArrayBuffer, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabaseAdmin.from("supplier_offer_attachments").insert({
    offer_id: offerId,
    file_name: fileName,
    storage_path: path,
    mime_type: mimeType,
    file_size: bytes.byteLength,
    kind: classifyAttachment(attachment),
    source_reference: attachment.id ?? null,
  });
  if (error) {
    await supabaseAdmin.storage.from(SUPPLIER_OFFER_BUCKET).remove([path]);
    throw error;
  }
  return "stored";
}

/**
 * Legt alle Anhänge einer Mail ab. Wirft nie: das Ergebnis landet als
 * Detailtext im Zustellprotokoll, damit Admins jede Datei nachvollziehen.
 */
export async function storeAttachments(
  supabaseAdmin: AdminClient,
  args: {
    offerId: string;
    resendEmailId: string;
    attachments: ResendAttachment[] | undefined;
    existingNames?: string[];
  },
): Promise<{ stored: number; skipped: number; failed: number; detail: string | null }> {
  const known = new Set(args.existingNames ?? []);
  const list = (args.attachments ?? []).filter((item) => !known.has(attachmentName(item)));
  if (!list.length) return { stored: 0, skipped: 0, failed: 0, detail: null };

  let stored = 0;
  let skipped = 0;
  const problems: string[] = [];
  for (const attachment of list) {
    try {
      const outcome = await storeAttachment(
        supabaseAdmin,
        args.offerId,
        args.resendEmailId,
        attachment,
      );
      if (outcome === "stored") stored += 1;
      else skipped += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Fehler";
      problems.push(`${attachmentName(attachment)}: ${message}`);
      console.error(`[resend] Anhang fehlgeschlagen (${args.resendEmailId}):`, message);
    }
  }

  const parts = [`${stored} von ${list.length} Anhängen gespeichert`];
  if (skipped) parts.push(`${skipped} ausgelassen (Logo oder Signatur)`);
  if (problems.length) parts.push(problems.join("; "));
  return { stored, skipped, failed: problems.length, detail: parts.join(" — ") };
}

/** Erstes Produktbild als Hauptbild markieren, falls noch keines gesetzt ist. */
export async function ensurePrimaryImage(supabaseAdmin: AdminClient, offerId: string) {
  const { data } = await supabaseAdmin
    .from("supplier_offer_attachments")
    .select("id, kind, is_primary_image, created_at")
    .eq("offer_id", offerId)
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  if (rows.some((row) => row.is_primary_image)) return;
  const first = rows.find((row) => row.kind === "product_image");
  if (!first) return;
  await supabaseAdmin
    .from("supplier_offer_attachments")
    .update({ is_primary_image: true })
    .eq("id", first.id);
}
