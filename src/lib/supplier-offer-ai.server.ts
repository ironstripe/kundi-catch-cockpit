/**
 * Strukturierte Auswertung eines Lieferantenangebots.
 *
 * Es werden ausschliesslich Angaben übernommen, die wortgetreu in der E-Mail
 * stehen. Fehlende Angaben bleiben leer — es wird nichts geschätzt, ergänzt
 * oder als Werbetext formuliert.
 */

import {
  normaliseExtraction,
  OFFER_FIELD_KEYS,
  OFFER_FIELD_LABELS,
  type ExtractedOffer,
} from "@/lib/supplier-offer-extraction";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
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
    },
    required: ["value", "unit", "confidence", "source_excerpt"],
    additionalProperties: false,
  };
}

function buildSchema() {
  const properties: Record<string, unknown> = {};
  for (const key of OFFER_FIELD_KEYS) {
    properties[key] = fieldSchema(OFFER_FIELD_LABELS[key]);
  }
  return {
    type: "object",
    properties,
    required: OFFER_FIELD_KEYS,
    additionalProperties: false,
  };
}

const SYSTEM_PROMPT = [
  "Du liest weitergeleitete Lieferantenangebote für Fisch und Meeresfrüchte und trägst die Angaben in ein festes Formular ein.",
  "Übernimm nur, was wortgetreu in der E-Mail steht. Rate nichts, rechne nichts um, ergänze nichts.",
  "Fehlt eine Angabe, setze value auf null.",
  "confidence ist eine Zahl zwischen 0 und 1. source_excerpt ist die kurze Textstelle, auf der der Wert beruht.",
  "Der ursprüngliche Lieferant ist der Absender im weitergeleiteten Kopf, nicht die Person, die weitergeleitet hat.",
  "Antworte ausschliesslich mit dem JSON-Objekt.",
].join(" ");

export interface ExtractionOutcome {
  data: ExtractedOffer;
  model: string;
}

/** Ruft die Auswertung auf; wirft mit verständlicher Meldung bei Fehlern. */
export async function extractOfferFields(args: {
  subject: string | null;
  from: string | null;
  body: string;
  attachmentNames: string[];
}): Promise<ExtractionOutcome> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Die Auswertung ist nicht konfiguriert (LOVABLE_API_KEY fehlt).");

  const userContent = [
    `Betreff: ${args.subject ?? "(kein Betreff)"}`,
    `Weitergeleitet von: ${args.from ?? "unbekannt"}`,
    args.attachmentNames.length ? `Anhänge: ${args.attachmentNames.join(", ")}` : "Anhänge: keine",
    "",
    "E-Mail-Inhalt:",
    args.body || "(kein Text)",
  ].join("\n");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "supplier_offer", strict: true, schema: buildSchema() },
      },
    }),
  });

  if (response.status === 429) {
    throw new Error("Die Auswertung ist zurzeit ausgelastet. Bitte später erneut versuchen.");
  }
  if (response.status === 402) {
    throw new Error("Für die Auswertung fehlt Guthaben im Arbeitsbereich.");
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error(`[offer-extraction] Gateway ${response.status}: ${detail}`);
    throw new Error(`Die Auswertung ist fehlgeschlagen (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const jsonText = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Die Auswertung lieferte kein lesbares Ergebnis.");
  }

  return { data: normaliseExtraction(parsed), model: MODEL };
}
