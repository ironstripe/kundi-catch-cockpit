/**
 * Herkunft eines ausgewerteten Werts: welche E-Mail und welche Quelle ihn belegt.
 */

import { OFFER_FIELD_KEYS, type ExtractedOffer } from "@/lib/supplier-offer-extraction";
import type { OfferExtractionSource } from "@/lib/supplier-offer-sources";

/** Ordnet jedem ausgewerteten Wert die E-Mail zu, aus der seine Quelle stammt. */
export function stampProvenance(
  data: ExtractedOffer,
  sources: OfferExtractionSource[],
): ExtractedOffer {
  const byName = new Map(sources.map((source) => [source.source_name.toLowerCase(), source]));
  for (const key of OFFER_FIELD_KEYS) {
    const field = data[key];
    if (!field?.source_name) continue;
    const needle = field.source_name.toLowerCase();
    const match =
      byName.get(needle) ??
      sources.find(
        (source) =>
          source.source_name.toLowerCase().includes(needle) ||
          needle.includes(source.source_name.toLowerCase()),
      );
    if (!match) continue;
    field.source_email_id = match.email_id ?? null;
    field.source_received_at = match.received_at ?? null;
    if (!field.source_type) field.source_type = match.source_type;
  }
  return data;
}
