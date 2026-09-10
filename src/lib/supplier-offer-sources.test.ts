import { describe, expect, it } from "vitest";

import {
  findingWarnings,
  hasManualEdits,
  normaliseExtraction,
} from "@/lib/supplier-offer-extraction";
import {
  formatSourcesForPrompt,
  isUnsupportedContentMime,
  parseCsv,
  parseEml,
  pdfTextIsUsable,
  rowsToText,
  shouldReadAttachment,
  SOURCE_LIMITS,
  sourceTypeForMime,
  truncateSourceText,
} from "@/lib/supplier-offer-sources";

describe("Quellenarten", () => {
  it("ordnet lesbare Dateitypen zu", () => {
    expect(sourceTypeForMime("application/pdf")).toBe("pdf");
    expect(sourceTypeForMime("text/csv")).toBe("spreadsheet");
    expect(
      sourceTypeForMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ).toBe("spreadsheet");
    expect(sourceTypeForMime("image/jpeg")).toBe("image");
    expect(sourceTypeForMime("message/rfc822")).toBe("eml");
    expect(sourceTypeForMime("application/zip")).toBeNull();
  });

  it("meldet alte Tabellenformate ehrlich als nicht unterstützt", () => {
    expect(isUnsupportedContentMime("application/vnd.ms-excel")).toBe(true);
    expect(isUnsupportedContentMime("application/vnd.oasis.opendocument.spreadsheet")).toBe(true);
    expect(isUnsupportedContentMime("application/pdf")).toBe(false);
  });

  it("schliesst Bilder ohne Produktbezug aus", () => {
    expect(shouldReadAttachment("product_label", "image/png")).toBe(true);
    expect(shouldReadAttachment("other", "image/png")).toBe(false);
    expect(shouldReadAttachment("other", "application/pdf")).toBe(true);
  });
});

describe("Grenzen", () => {
  it("kürzt zu langen Text und markiert das", () => {
    const result = truncateSourceText("x".repeat(SOURCE_LIMITS.maxChars + 500));
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(SOURCE_LIMITS.maxChars + 2);
  });

  it("lässt kurzen Text unverändert", () => {
    expect(truncateSourceText("Silberlachs")).toEqual({ text: "Silberlachs", truncated: false });
  });

  it("begrenzt Tabellenzeilen und Spalten", () => {
    const rows = Array.from({ length: SOURCE_LIMITS.maxRows + 10 }, () =>
      Array.from({ length: SOURCE_LIMITS.maxColumns + 5 }, (_, index) => `z${index}`),
    );
    const result = rowsToText("Preise", rows);
    expect(result.truncated).toBe(true);
    expect(result.rows).toBe(SOURCE_LIMITS.maxRows);
    expect(result.text.split("\n")[1]!.split(" | ")).toHaveLength(SOURCE_LIMITS.maxColumns);
  });

  it("erkennt Bild-PDF an fehlendem Text", () => {
    expect(pdfTextIsUsable("nur ein paar Zeichen")).toBe(false);
    expect(pdfTextIsUsable("A".repeat(250))).toBe(true);
  });
});

describe("Tabellen und Nachrichten", () => {
  it("liest CSV mit Semikolon und Anführungszeichen", () => {
    const rows = parseCsv('Produkt;Preis\n"Silberlachs; TK";8.20\n');
    expect(rows).toEqual([
      ["Produkt", "Preis"],
      ["Silberlachs; TK", "8.20"],
    ]);
  });

  it("liest Kopfangaben einer weitergeleiteten Nachricht", () => {
    const text = parseEml("From: verkauf@stadel.ch\nSubject: Angebot\nX-Mailer: test\n\nInhalt");
    expect(text).toContain("From: verkauf@stadel.ch");
    expect(text).toContain("Subject: Angebot");
    expect(text).not.toContain("X-Mailer");
    expect(text).toContain("Inhalt");
  });

  it("trennt Quellen im Auswertungstext klar", () => {
    const prompt = formatSourcesForPrompt([
      { source_type: "email", source_name: "E-Mail", text: "Preis 8.20", truncated: false },
      { source_type: "pdf", source_name: "Spec.pdf", text: "Herkunft: Kanada", truncated: true },
    ]);
    expect(prompt).toContain("--- QUELLE (email): E-Mail ---");
    expect(prompt).toContain("--- QUELLE (pdf): Spec.pdf [gekürzt] ---");
  });
});

describe("Herkunft und Hinweise", () => {
  it("behält Quelldatei und Quellenart je Feld", () => {
    const offer = normaliseExtraction({
      origin: {
        value: "Kanada",
        unit: null,
        confidence: 0.99,
        source_excerpt: "Origin: Kanada",
        source_name: "Produktspezifikation.pdf",
        source_type: "pdf",
      },
    });
    expect(offer.origin?.source_name).toBe("Produktspezifikation.pdf");
    expect(offer.origin?.source_type).toBe("pdf");
    expect(offer.purchase_price?.value).toBeNull();
  });

  it("macht aus einer Haltbarkeitsdauer kein Ablaufdatum", () => {
    const offer = normaliseExtraction({ expiry_date: { value: "360 Tage" } });
    expect(offer.expiry_date?.value).toBeNull();
  });

  it("übernimmt Gebindeinhalt nicht als Liefermenge", () => {
    const offer = normaliseExtraction({
      units_per_package: { value: 24 },
      quantity_unit: { value: "Stück" },
    });
    expect(offer.units_per_package?.value).toBe(24);
    expect(offer.available_quantity?.value).toBeNull();
  });

  it("meldet Widersprüche und mehrere Produkte", () => {
    const warnings = findingWarnings({
      conflicts: ["E-Mail nennt 8.20, PDF nennt 9.10"],
      multiple_products: true,
    });
    expect(warnings[0]).toContain("mehrere Produkte");
    expect(warnings[1]).toContain("8.20");
  });

  it("erkennt von Hand geprüfte Werte", () => {
    const manual = normaliseExtraction({
      product_name: { value: "Silberlachs", confidence: null, source_excerpt: "Silberlachs" },
    });
    expect(hasManualEdits(manual)).toBe(true);
    const automatic = normaliseExtraction({
      product_name: { value: "Silberlachs", confidence: 0.9, source_excerpt: "Silberlachs" },
    });
    expect(hasManualEdits(automatic)).toBe(false);
  });
});
