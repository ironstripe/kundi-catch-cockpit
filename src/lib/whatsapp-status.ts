import type { CatchStatus } from "@/lib/catch-domain";

/**
 * UI-Interpretation der Publikationsfelder — unabhängig vom Lebenszyklus-Status,
 * der weiterhin die verbindliche Quelle für den Catch selbst bleibt.
 */
export type WhatsappStatus = "draft" | "ready" | "published" | "archived" | "unpublished";

export const WHATSAPP_STATUS_LABELS: Record<WhatsappStatus, string> = {
  draft: "Entwurf",
  ready: "Bereit für WhatsApp",
  published: "Publiziert",
  archived: "Archiviert",
  unpublished: "Nicht publiziert",
};

export function whatsappStatus(input: {
  status: CatchStatus;
  published_text: string | null;
  published_at: string | null;
}): WhatsappStatus {
  const hasSnapshot = Boolean(input.published_text) || Boolean(input.published_at);
  if (input.status === "closed" || input.status === "cancelled") {
    return hasSnapshot ? "archived" : "unpublished";
  }
  if (input.status === "published") return "published";
  if (input.status === "ready") return "ready";
  return "draft";
}
