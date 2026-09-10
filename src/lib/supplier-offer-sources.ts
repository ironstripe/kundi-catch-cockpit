/**
 * Quellenmodell des Angebotseingangs.
 *
 * Eine Quelle ist entweder die E-Mail selbst oder ein gelesener Anhang.
 * Reine Regeln — keine Netz- oder Dateizugriffe, damit alles prüfbar bleibt.
 */

export type OfferSourceType = "email" | "pdf" | "spreadsheet" | "image" | "eml";

export interface OfferExtractionSource {
  source_type: OfferSourceType;
  source_name: string;
  text: string;
  truncated: boolean;
  /** E-Mail, aus der diese Quelle stammt (Angebotsdossier mit mehreren E-Mails). */
  email_id?: string | null;
  /** Empfangszeitpunkt der Quelle, damit Neueres von Bestätigtem unterscheidbar bleibt. */
  received_at?: string | null;
}

/** Harte Grenzen, damit eine grosse Datei nie die Auswertung sprengt. */
export const SOURCE_LIMITS = {
  /** Grösste akzeptierte Datei (Bucket-Limit). */
  maxBytes: 25 * 1024 * 1024,
  /** Zeichen pro Quelle. */
  maxChars: 20_000,
  /** Seiten pro PDF. */
  maxPdfPages: 30,
  /** Zeilen pro Tabellenblatt. */
  maxRows: 300,
  /** Spalten pro Tabellenblatt. */
  maxColumns: 50,
  /** Anhänge pro Auswertung. */
  maxAttachments: 8,
} as const;

/** Unter dieser Textmenge gilt ein PDF als reines Bild-PDF. */
export const MIN_PDF_TEXT_CHARS = 200;

export type ContentExtractionStatus = "pending" | "processing" | "done" | "unsupported" | "failed";

export const CONTENT_STATUS_LABELS: Record<ContentExtractionStatus, string> = {
  pending: "Noch nicht gelesen",
  processing: "Wird gelesen",
  done: "Inhalt gelesen",
  unsupported: "Nicht unterstützt",
  failed: "Lesen fehlgeschlagen",
};

const SPREADSHEET_MIMES = new Set([
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/** Nicht unterstützte Tabellenformate — lieber ehrlich melden als falsch lesen. */
const UNSUPPORTED_MIMES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

export function isUnsupportedContentMime(mime: string): boolean {
  return UNSUPPORTED_MIMES.has(mime);
}

/** Ordnet einen Dateityp einer Quellenart zu; `null` heisst «nicht lesbar». */
export function sourceTypeForMime(mime: string): OfferSourceType | null {
  const normalised = mime.toLowerCase().split(";")[0]!.trim();
  if (normalised === "application/pdf") return "pdf";
  if (SPREADSHEET_MIMES.has(normalised)) return "spreadsheet";
  if (normalised === "message/rfc822") return "eml";
  if (normalised.startsWith("image/")) return "image";
  return null;
}

/** Deko-Anhänge werden nie an die Auswertung geschickt. */
const NON_INFORMATIVE_KINDS = new Set(["other"]);

export function shouldReadAttachment(kind: string, mime: string): boolean {
  const type = sourceTypeForMime(mime);
  if (!type) return false;
  if (type === "image") {
    // Bilder nur, wenn sie laut Einordnung Produktangaben tragen.
    return !NON_INFORMATIVE_KINDS.has(kind);
  }
  return true;
}

export function truncateSourceText(
  text: string,
  max: number = SOURCE_LIMITS.maxChars,
): { text: string; truncated: boolean } {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= max) return { text: cleaned, truncated: false };
  return { text: `${cleaned.slice(0, max)}\n…`, truncated: true };
}

/** Sehr wenig Text in einem PDF heisst: gescannt, nicht gelesen. */
export function pdfTextIsUsable(text: string): boolean {
  return text.replace(/\s+/g, "").length >= MIN_PDF_TEXT_CHARS;
}

/** Einfacher CSV-Leser (Komma oder Semikolon, Anführungszeichen erlaubt). */
export function parseCsv(content: string): string[][] {
  const delimiter =
    (content.match(/;/g)?.length ?? 0) > (content.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    if (quoted) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value !== ""));
}

/** Tabellenzeilen als lesbaren Text mit Grenzen darstellen. */
export function rowsToText(
  sheetName: string,
  rows: string[][],
): { text: string; truncated: boolean; rows: number } {
  const limited = rows.slice(0, SOURCE_LIMITS.maxRows);
  const truncated = rows.length > limited.length;
  const lines = limited.map((row) =>
    row
      .slice(0, SOURCE_LIMITS.maxColumns)
      .map((value) => value.replace(/\s+/g, " ").trim())
      .join(" | "),
  );
  return {
    text: [`Blatt: ${sheetName}`, ...lines].join("\n"),
    truncated,
    rows: limited.length,
  };
}

/** Kopfangaben einer weitergeleiteten `.eml` — ohne verschachtelte Weiterverarbeitung. */
export function parseEml(content: string): string {
  const separator = content.indexOf("\n\n");
  const head = separator > -1 ? content.slice(0, separator) : content.slice(0, 4000);
  const body = separator > -1 ? content.slice(separator + 2) : "";
  const keep = /^(from|to|subject|date|von|an|betreff|datum)\s*:/i;
  const headerLines = head
    .split("\n")
    .filter((line) => keep.test(line))
    .map((line) => line.trim());
  const plain = body
    .replace(/<[^>]+>/g, " ")
    .replace(/=\r?\n/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  return [...headerLines, "", plain].join("\n").trim();
}

/** Quellen als klar getrennte Blöcke für die Auswertung. */
export function formatSourcesForPrompt(sources: OfferExtractionSource[]): string {
  return sources
    .map((source) =>
      [
        `--- QUELLE (${source.source_type}): ${source.source_name}${source.truncated ? " [gekürzt]" : ""}${
          source.received_at ? ` | empfangen: ${source.received_at}` : ""
        } ---`,
        source.text || "(kein Text)",
      ].join("\n"),
    )
    .join("\n\n");
}
