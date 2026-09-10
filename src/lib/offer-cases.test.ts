import { describe, expect, it } from "vitest";

import { stampProvenance } from "@/lib/offer-case-provenance";
import { caseNeedsAction, caseProductName, type CaseListItem } from "@/lib/offer-cases";
import { EMPTY_FIELD, normaliseExtraction } from "@/lib/supplier-offer-extraction";
import type { OfferExtractionSource } from "@/lib/supplier-offer-sources";

function source(partial: Partial<OfferExtractionSource>): OfferExtractionSource {
  return {
    source_type: "pdf",
    source_name: "Spezifikation.pdf",
    text: "",
    truncated: false,
    email_id: "email-1",
    received_at: "2026-09-10T08:00:00Z",
    ...partial,
  };
}

function listItem(partial: Partial<CaseListItem>): CaseListItem {
  return {
    id: "case-1",
    title: "Silberlachs",
    supplier_name: "Stadel Fischimport AG",
    status: "review",
    extraction_status: "done",
    consolidated_data: {},
    warning_count: 0,
    email_count: 1,
    attachment_count: 2,
    first_received_at: "2026-09-10T08:00:00Z",
    last_received_at: "2026-09-11T08:00:00Z",
    converted_catch_id: null,
    ...partial,
  };
}

describe("Angebotsdossier — Übersicht", () => {
  it("markiert Dossiers zur Prüfung als handlungsbedürftig", () => {
    expect(caseNeedsAction(listItem({ status: "review" }))).toBe(true);
  });

  it("markiert fehlgeschlagene Auswertungen als handlungsbedürftig", () => {
    expect(caseNeedsAction(listItem({ status: "ready", extraction_status: "failed" }))).toBe(true);
  });

  it("lässt übernommene Dossiers in Ruhe", () => {
    expect(caseNeedsAction(listItem({ status: "converted" }))).toBe(false);
  });

  it("zeigt fehlendes Produkt ehrlich an", () => {
    expect(caseProductName({})).toBe("Kein Produkt erkannt");
    expect(
      caseProductName(
        normaliseExtraction({ product_name: { ...EMPTY_FIELD, value: "Silberlachs" } }),
      ),
    ).toBe("Silberlachs");
  });
});

describe("Angebotsdossier — Herkunft", () => {
  const sources = [
    source({ source_type: "email", source_name: "E-Mail: Preisbestätigung", email_id: "email-2" }),
    source({ source_name: "Produktspezifikation C-60.pdf", email_id: "email-1" }),
  ];

  it("ordnet einen Wert der belegenden E-Mail zu", () => {
    const data = normaliseExtraction({
      origin: { ...EMPTY_FIELD, value: "Kanada", source_name: "Produktspezifikation C-60.pdf" },
    });
    const result = stampProvenance(data, sources);
    expect(result.origin?.source_email_id).toBe("email-1");
    expect(result.origin?.source_received_at).toBe("2026-09-10T08:00:00Z");
  });

  it("lässt Werte ohne Quellenangabe unverändert", () => {
    const data = normaliseExtraction({ origin: { ...EMPTY_FIELD, value: "Kanada" } });
    const result = stampProvenance(data, sources);
    expect(result.origin?.source_email_id).toBeNull();
  });

  it("erfindet keine Zuordnung für unbekannte Quellen", () => {
    const data = normaliseExtraction({
      origin: { ...EMPTY_FIELD, value: "Kanada", source_name: "Unbekannt.pdf" },
    });
    const result = stampProvenance(data, sources);
    expect(result.origin?.source_email_id).toBeNull();
  });
});
