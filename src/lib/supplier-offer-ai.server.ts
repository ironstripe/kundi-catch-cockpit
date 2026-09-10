/**
 * Strukturierte Auswertung eines Lieferantenangebots.
 *
 * Es werden ausschliesslich Angaben übernommen, die wortgetreu in einer der
 * Quellen stehen (E-Mail oder gelesener Anhang). Fehlende Angaben bleiben leer
 * — es wird nichts geschätzt, ergänzt oder als Werbetext formuliert.
 */

import { AI_MODEL, callResponsesApi } from "@/lib/ai-gateway.server";
import {
  normaliseExtraction,
  OFFER_FIELD_KEYS,
  OFFER_FIELD_LABELS,
  type ExtractedOffer,
} from "@/lib/supplier-offer-extraction";
import { formatSourcesForPrompt, type OfferExtractionSource } from "@/lib/supplier-offer-sources";

const MODEL = AI_MODEL;
const MAX_BODY_CHARS = 24_000;

/** Entfernt Markup, damit nur der lesbare Text ausgewertet wird. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function emailPlainText(text: string | null, html: string | null): string {
  const plain = (text ?? "").trim() || (html ? htmlToText(html) : "");
  return plain.slice(0, MAX_BODY_CHARS);
}

function fieldSchema(description: string) {
  return {
    type: ["object", "null"],
    properties: {
      value: { type: ["string", "number", "null"], description },
      unit: { type: ["string", "null"] },
      confidence: { type: ["number", "null"] },
      source_excerpt: { type: ["string", "null"] },
      source_name: { type: ["string", "null"] },
      source_type: { type: ["string", "null"] },
    },
    required: ["value", "unit", "confidence", "source_excerpt", "source_name", "source_type"],
    additionalProperties: false,
  };
}

function buildSchema() {
  const properties: Record<string, unknown> = {};
  for (const key of OFFER_FIELD_KEYS) {
    properties[key] = fieldSchema(OFFER_FIELD_LABELS[key]);
  }
  properties["conflicts"] = {
    type: "array",
    items: { type: "string" },
  };
  properties["multiple_products"] = { type: "boolean" };
  return {
    type: "object",
    properties,
    required: [...OFFER_FIELD_KEYS, "conflicts", "multiple_products"],
    additionalProperties: false,
  };
}

const SYSTEM_PROMPT = [
  "Du liest weitergeleitete Lieferantenangebote für Fisch und Meeresfrüchte und trägst die Angaben in ein festes Formular ein.",
  "Die Angaben stammen aus mehreren klar getrennten Quellen: der E-Mail und den gelesenen Anhängen.",
  "Übernimm nur, was wortgetreu in einer Quelle steht. Rate nichts, rechne nichts um, ergänze nichts.",
  "Fehlt eine Angabe, setze value auf null.",
  "confidence ist eine Zahl zwischen 0 und 1. source_excerpt ist die kurze Textstelle, auf der der Wert beruht.",
  "source_name ist der Name der Quelle (Dateiname oder 'E-Mail'), source_type ist email, pdf, spreadsheet, image oder eml.",
  "Bevorzuge konkrete Produktangaben gegenüber Fusszeilen oder allgemeinen Firmenangaben.",
  "Der ursprüngliche Lieferant ist der Absender im weitergeleiteten Kopf, nicht die Person, die weitergeleitet hat.",
  "Eine Haltbarkeitsdauer (zum Beispiel «360 Tage») ist kein Mindesthaltbarkeitsdatum: expiry_date bleibt dann null.",
  "Stück pro Gebinde ist nicht die verfügbare Menge; available_quantity bleibt null, wenn keine Liefermenge genannt ist.",
  "Unterscheide Preis pro Kilo, pro Stück und pro Karton sowie Netto- und Bruttogewicht; halte die Einheit in unit fest.",
  "Widersprüche zwischen Quellen entscheidest du nicht: nenne sie in conflicts und lasse den strittigen Wert unverändert unsicher.",
  "Enthalten die Quellen mehrere verschiedene Produkte, setze multiple_products auf true und führe nichts zusammen.",
  "Nützliche Angaben ohne eigenes Feld gehören knapp und belegt in other_conditions — nie die ganze Spezifikation.",
  "Antworte ausschliesslich mit dem JSON-Objekt.",
].join(" ");

export interface ExtractionFindings {
  conflicts: string[];
  multiple_products: boolean;
}

export interface ExtractionOutcome {
  data: ExtractedOffer;
  model: string;
  findings: ExtractionFindings;
  sources: { source_name: string; source_type: string; truncated: boolean }[];
}

/** Ruft die Auswertung auf; wirft mit verständlicher Meldung bei Fehlern. */
export async function extractOfferFields(args: {
  subject: string | null;
  from: string | null;
  sources: OfferExtractionSource[];
}): Promise<ExtractionOutcome> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Die Auswertung ist nicht konfiguriert (LOVABLE_API_KEY fehlt).");

  const userContent = [
    `Betreff: ${args.subject ?? "(kein Betreff)"}`,
    `Weitergeleitet von: ${args.from ?? "unbekannt"}`,
    `Quellen: ${args.sources.map((source) => source.source_name).join(", ") || "keine"}`,
    "",
    formatSourcesForPrompt(args.sources),
  ].join("\n");

  const content = await callResponsesApi({
    instructions: SYSTEM_PROMPT,
    parts: [{ type: "input_text", text: userContent }],
    schema: { name: "supplier_offer", schema: buildSchema() },
    labels: {
      busy: "Die Auswertung ist zurzeit ausgelastet. Bitte später erneut versuchen.",
      credits: "Für die Auswertung fehlt Guthaben im Arbeitsbereich.",
      failed: "Die Auswertung ist fehlgeschlagen",
    },
  });

  const jsonText = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Die Auswertung lieferte kein lesbares Ergebnis.");
  }

  const record = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const conflicts = Array.isArray(record["conflicts"])
    ? (record["conflicts"] as unknown[]).map((entry) => String(entry)).filter(Boolean)
    : [];

  return {
    data: normaliseExtraction(parsed),
    model: MODEL,
    findings: { conflicts, multiple_products: record["multiple_products"] === true },
    sources: args.sources.map((source) => ({
      source_name: source.source_name,
      source_type: source.source_type,
      truncated: source.truncated,
    })),
  };
}

/** Die E-Mail selbst als Quelle. */
export function emailSource(
  subject: string | null,
  body: string,
  meta: { email_id?: string | null; received_at?: string | null } = {},
): OfferExtractionSource {
  return {
    source_type: "email",
    source_name: subject ? `E-Mail: ${subject}` : "E-Mail",
    text: body,
    truncated: false,
    email_id: meta.email_id ?? null,
    received_at: meta.received_at ?? null,
  };
}
