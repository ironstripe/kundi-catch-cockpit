/**
 * Anhangsinhalte lesen: PDF, Tabellen, Bilder und weitergeleitete Nachrichten.
 *
 * Alles läuft serverseitig auf den bereits privat abgelegten Dateien. Eine
 * defekte Datei bricht nie den ganzen Vorgang ab — sie wird als «Lesen
 * fehlgeschlagen» protokolliert und bleibt sichtbar.
 */

import { SUPPLIER_OFFER_BUCKET } from "@/lib/supplier-offer-extraction";
import {
  isUnsupportedContentMime,
  parseCsv,
  parseEml,
  pdfTextIsUsable,
  rowsToText,
  shouldReadAttachment,
  SOURCE_LIMITS,
  sourceTypeForMime,
  truncateSourceText,
  type ContentExtractionStatus,
  type OfferExtractionSource,
  type OfferSourceType,
} from "@/lib/supplier-offer-sources";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

import { callResponsesApi, type ResponsePart } from "@/lib/ai-gateway.server";

export interface ContentExtractionResult {
  status: ContentExtractionStatus;
  text: string;
  error: string | null;
  meta: Record<string, unknown>;
  sourceType: OfferSourceType | null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Sichtbaren Text aus einem Bild oder Bild-PDF wortgetreu abschreiben. */
async function transcribeVisual(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  const block: ResponsePart =
    mimeType === "application/pdf"
      ? { type: "input_file", filename: fileName, file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl };

  return callResponsesApi({
    instructions:
      "Schreibe den sichtbaren Text der Datei wortgetreu ab. Erfinde nichts, ergänze nichts, fasse nicht zusammen. Gib nur den Text zurück.",
    parts: [{ type: "input_text", text: `Datei: ${fileName}` }, block],
    labels: {
      busy: "Das Lesen ist zurzeit ausgelastet.",
      credits: "Für das Lesen fehlt Guthaben im Arbeitsbereich.",
      failed: "Das Lesen ist fehlgeschlagen",
    },
  });
}

async function readPdf(
  bytes: Uint8Array,
  fileName: string,
): Promise<{ text: string; meta: Record<string, unknown> }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const document = await getDocumentProxy(bytes);
  const pages = Math.min(document.numPages, SOURCE_LIMITS.maxPdfPages);
  const { text } = await extractText(document);
  const perPage: string[] = Array.isArray(text) ? text : [String(text ?? "")];
  const joined = perPage.slice(0, pages).join("\n");

  if (pdfTextIsUsable(joined)) {
    return {
      text: joined,
      meta: { pages: document.numPages, read_pages: pages, mode: "text" },
    };
  }

  // Bild-PDF: nicht als gelesen ausgeben, sondern sichtbaren Text abschreiben.
  const visual = await transcribeVisual(bytes, "application/pdf", fileName);
  if (!visual) throw new Error("Das PDF enthält keinen lesbaren Text.");
  return { text: visual, meta: { pages: document.numPages, mode: "vision" } };
}

async function readSpreadsheet(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ text: string; meta: Record<string, unknown>; truncated: boolean }> {
  if (mimeType === "text/csv") {
    const rows = parseCsv(new TextDecoder().decode(bytes));
    const result = rowsToText("CSV", rows);
    return {
      text: result.text,
      truncated: result.truncated,
      meta: { sheets: ["CSV"], rows: result.rows },
    };
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);

  const parts: string[] = [];
  const sheets: string[] = [];
  let truncated = false;
  for (const sheet of workbook.worksheets) {
    sheets.push(sheet.name);
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        // Formeln werden nicht berechnet — nur das gespeicherte Ergebnis zählt.
        const text =
          value && typeof value === "object" && "result" in value
            ? String((value as { result?: unknown }).result ?? "")
            : value === null || value === undefined
              ? ""
              : String(value);
        cells.push(text);
      });
      if (cells.some((cell) => cell.trim() !== "")) rows.push(cells);
    });
    const result = rowsToText(sheet.name, rows);
    truncated = truncated || result.truncated;
    parts.push(result.text);
  }
  return { text: parts.join("\n\n"), truncated, meta: { sheets } };
}

/** Liest den Inhalt einer einzelnen Datei; wirft nie. */
export async function extractAttachmentContent(args: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  kind: string;
}): Promise<ContentExtractionResult> {
  const sourceType = sourceTypeForMime(args.mimeType);
  const base = { sourceType } as const;

  if (args.bytes.byteLength > SOURCE_LIMITS.maxBytes) {
    return { ...base, status: "failed", text: "", error: "Datei überschreitet 25 MB.", meta: {} };
  }
  if (isUnsupportedContentMime(args.mimeType) || !sourceType) {
    return {
      ...base,
      status: "unsupported",
      text: "",
      error: `Dateityp ${args.mimeType} kann nicht gelesen werden.`,
      meta: {},
    };
  }
  if (!shouldReadAttachment(args.kind, args.mimeType)) {
    return {
      ...base,
      status: "unsupported",
      text: "",
      error: "Dieser Anhang enthält laut Einordnung keine Angebotsangaben.",
      meta: {},
    };
  }

  try {
    let raw = "";
    let meta: Record<string, unknown> = {};
    let truncatedByReader = false;

    if (sourceType === "pdf") {
      const result = await readPdf(args.bytes, args.fileName);
      raw = result.text;
      meta = result.meta;
    } else if (sourceType === "spreadsheet") {
      const result = await readSpreadsheet(args.bytes, args.mimeType);
      raw = result.text;
      meta = result.meta;
      truncatedByReader = result.truncated;
    } else if (sourceType === "eml") {
      raw = parseEml(new TextDecoder().decode(args.bytes));
      meta = { mode: "eml" };
    } else {
      raw = await transcribeVisual(args.bytes, args.mimeType, args.fileName);
      meta = { mode: "vision" };
      if (!raw) throw new Error("Im Bild ist kein Text erkennbar.");
    }

    const { text, truncated } = truncateSourceText(raw);
    if (!text) throw new Error("Die Datei enthält keinen lesbaren Text.");

    return {
      ...base,
      status: "done",
      text,
      error: null,
      meta: { ...meta, truncated: truncated || truncatedByReader },
    };
  } catch (error) {
    return {
      ...base,
      status: "failed",
      text: "",
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim Lesen.",
      meta: {},
    };
  }
}

interface AttachmentRow {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  kind: string;
  content_extraction_status: string;
  extracted_text: string | null;
  extraction_meta: unknown;
}

/**
 * Liest alle noch ungelesenen Anhänge eines Angebots und liefert die Quellen
 * für die Auswertung. Bereits gelesene Inhalte werden wiederverwendet.
 */
export async function processOfferAttachmentContents(
  supabaseAdmin: AdminClient,
  offerId: string,
  options: { force?: boolean; attachmentId?: string } = {},
): Promise<{ sources: OfferExtractionSource[]; read: number; failed: number }> {
  let query = supabaseAdmin
    .from("supplier_offer_attachments")
    .select(
      "id, file_name, storage_path, mime_type, kind, content_extraction_status, extracted_text, extraction_meta",
    )
    .eq("offer_id", offerId)
    .order("created_at", { ascending: true })
    .limit(SOURCE_LIMITS.maxAttachments);
  if (options.attachmentId) query = query.eq("id", options.attachmentId);

  const { data } = await query;
  const rows = (data ?? []) as unknown as AttachmentRow[];

  const sources: OfferExtractionSource[] = [];
  let read = 0;
  let failed = 0;

  for (const row of rows) {
    const sourceType = sourceTypeForMime(row.mime_type);
    const reuse =
      !options.force && row.content_extraction_status === "done" && Boolean(row.extracted_text);

    if (reuse) {
      const meta = (row.extraction_meta ?? {}) as Record<string, unknown>;
      sources.push({
        source_type: sourceType ?? "pdf",
        source_name: row.file_name,
        text: row.extracted_text!,
        truncated: Boolean(meta["truncated"]),
      });
      continue;
    }

    if (!options.force && ["unsupported", "failed"].includes(row.content_extraction_status)) {
      continue;
    }

    await supabaseAdmin
      .from("supplier_offer_attachments")
      .update({ content_extraction_status: "processing" } as never)
      .eq("id", row.id);

    let result: ContentExtractionResult;
    try {
      const download = await supabaseAdmin.storage
        .from(SUPPLIER_OFFER_BUCKET)
        .download(row.storage_path);
      if (download.error || !download.data) {
        throw new Error("Die abgelegte Datei konnte nicht geöffnet werden.");
      }
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      result = await extractAttachmentContent({
        bytes,
        fileName: row.file_name,
        mimeType: row.mime_type,
        kind: row.kind,
      });
    } catch (error) {
      result = {
        status: "failed",
        text: "",
        error: error instanceof Error ? error.message : "Unbekannter Fehler beim Lesen.",
        meta: {},
        sourceType,
      };
    }

    await supabaseAdmin
      .from("supplier_offer_attachments")
      .update({
        content_extraction_status: result.status,
        extracted_text: result.text || null,
        extraction_error: result.error,
        extracted_at: new Date().toISOString(),
        extraction_meta: result.meta as never,
      } as never)
      .eq("id", row.id);

    if (result.status === "done") {
      read += 1;
      sources.push({
        source_type: result.sourceType ?? "pdf",
        source_name: row.file_name,
        text: result.text,
        truncated: Boolean(result.meta["truncated"]),
      });
    } else if (result.status === "failed") {
      failed += 1;
    }
  }

  return { sources, read, failed };
}
