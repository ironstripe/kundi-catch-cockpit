/**
 * Serverseitiger Zugang zum Lovable-AI-Gateway (Responses-API).
 *
 * Alle Aufrufe laufen als Datenstrom, weil Auswertungen mit Nachdenken
 * mehrere Minuten dauern können. Zurückgegeben wird nur der fertige Text.
 */

const RESPONSES_URL = "https://ai.gateway.lovable.dev/v1/responses";

export const AI_MODEL = "openai/gpt-6-astra";

export type ResponsePart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

export interface ResponsesRequest {
  instructions: string;
  parts: ResponsePart[];
  /** Striktes JSON-Schema, wenn eine feste Struktur erwartet wird. */
  schema?: { name: string; schema: Record<string, unknown> };
  /** Fehlermeldungen in der Sprache der Oberfläche. */
  labels: { busy: string; credits: string; failed: string };
}

function readableError(status: number, labels: ResponsesRequest["labels"]): string {
  if (status === 429) return labels.busy;
  if (status === 402 || status === 403) return labels.credits;
  return `${labels.failed} (HTTP ${status}).`;
}

/** Ruft ein Modell auf und liefert den vollständigen Antworttext. */
export async function callResponsesApi(request: ResponsesRequest): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error(`${request.labels.failed} (LOVABLE_API_KEY fehlt).`);

  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      input: [{ role: "user", content: request.parts }],
      instructions: request.instructions,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      ...(request.schema
        ? {
            text: {
              format: {
                type: "json_schema",
                name: request.schema.name,
                strict: true,
                schema: request.schema.schema,
              },
            },
          }
        : {}),
    }),
  });

  if (!response.ok || !response.body) {
    const detail = response.ok ? "kein Datenstrom" : await response.text();
    console.error(`[ai-gateway] ${response.status}: ${String(detail).slice(0, 400)}`);
    throw new Error(readableError(response.status, request.labels));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let event: { type?: string; delta?: string; response?: { output_text?: string } };
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
      }
      if (event.type === "response.completed" && !text && event.response?.output_text) {
        text = event.response.output_text;
      }
    }
  }

  return text.trim();
}
