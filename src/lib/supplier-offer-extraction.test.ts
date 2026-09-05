import { describe, expect, it } from "vitest";

import {
  extractionWarnings,
  fieldValue,
  looksLikeForward,
  missingRequiredFields,
  normaliseExtraction,
  originalSenderFromBody,
  parseOfferDate,
  parseOfferNumber,
  parseTemperature,
} from "@/lib/supplier-offer-extraction";
import { htmlToText } from "@/lib/supplier-offer-ai.server";
import {
  attachmentMime,
  classifyAttachment,
  isAllowedMime,
  isDecorativeImage,
  needsResendLookup,
} from "@/lib/supplier-offer-attachments.server";
import {
  addressOf,
  matchesInboundAddress,
} from "@/routes/api/public/webhooks/resend";

describe("Zahlen und Datumsangaben", () => {
  it("liest Schweizer und internationale Schreibweisen", () => {
    expect(parseOfferNumber("CHF 8.20/kg")).toBe(8.2);
    expect(parseOfferNumber("12'500.50")).toBe(12500.5);
    expect(parseOfferNumber("1.250,75")).toBe(1250.75);
    expect(parseOfferNumber("keine Angabe")).toBeNull();
    expect(parseOfferNumber(null)).toBeNull();
  });

  it("liest Datumsangaben in beiden Schreibweisen", () => {
    expect(parseOfferDate("2026-04-05")).toBe("2026-04-05");
    expect(parseOfferDate("5.4.2026")).toBe("2026-04-05");
    expect(parseOfferDate("bald")).toBeNull();
  });

  it("erkennt frisch und tiefgekühlt", () => {
    expect(parseTemperature("TK-Ware")).toBe("frozen");
    expect(parseTemperature("frisch, gekühlt")).toBe("fresh");
    expect(parseTemperature("unklar")).toBeNull();
  });
});

describe("Auswertungsschema", () => {
  it("füllt fehlende Felder mit null statt zu raten", () => {
    const result = normaliseExtraction({
      product_name: { value: "Lachsfilet", unit: null, confidence: 0.9, source_excerpt: "Lachsfilet" },
    });
    expect(fieldValue(result, "product_name")).toBe("Lachsfilet");
    expect(fieldValue(result, "purchase_price")).toBeNull();
    expect(result.purchase_price?.confidence).toBeNull();
  });

  it("meldet fehlende Pflichtangaben", () => {
    const result = normaliseExtraction({ product_name: { value: "Dorade" } });
    expect(missingRequiredFields(result)).toEqual(["available_quantity", "purchase_price"]);
  });

  it("warnt bei Preis- und Mengenkonflikten", () => {
    const result = normaliseExtraction({
      purchase_price: { value: 20 },
      regular_price: { value: 10 },
      available_quantity: { value: 5 },
      carton_count: { value: 9 },
      currency: { value: "EUR" },
    });
    const warnings = extractionWarnings(result);
    expect(warnings.some((w) => w.includes("Einkaufspreis liegt über"))).toBe(true);
    expect(warnings.some((w) => w.includes("Anzahl Kartons"))).toBe(true);
    expect(warnings.some((w) => w.includes("EUR"))).toBe(true);
  });

  it("markiert unsicher erkannte Werte", () => {
    const result = normaliseExtraction({
      product_name: { value: "Kabeljau", confidence: 0.2 },
    });
    expect(extractionWarnings(result).some((w) => w.includes("unsicher"))).toBe(true);
  });
});

describe("Weiterleitung und Original-Absender", () => {
  it("unterscheidet die weiterleitende Person vom Lieferanten", () => {
    const body = [
      "Hallo zusammen, siehe unten.",
      "---------- Weitergeleitete Nachricht ----------",
      "Von: Ana Silva <ana@fischhandel.pt>",
      "Betreff: Sonderposten Dorade",
    ].join("\n");
    expect(looksLikeForward("Fwd: Sonderposten", body)).toBe(true);
    expect(originalSenderFromBody(body)).toEqual({
      email: "ana@fischhandel.pt",
      name: "Ana Silva",
    });
  });

  it("gibt null zurück, wenn kein Absender erkennbar ist", () => {
    expect(originalSenderFromBody("Nur ein Text")).toEqual({ email: null, name: null });
  });
});

describe("Webhook-Filter", () => {
  it("nimmt nur exakt die zentrale Adresse an", () => {
    expect(matchesInboundAddress(["kundi-catch@rinueeldii.resend.app"], "kundi-catch@rinueeldii.resend.app")).toBe(true);
    expect(matchesInboundAddress(["Kundi-Catch@Rinueeldii.Resend.App"], "kundi-catch@rinueeldii.resend.app")).toBe(true);
    expect(matchesInboundAddress(["info@example.com"], "kundi-catch@rinueeldii.resend.app")).toBe(false);
    expect(matchesInboundAddress([], "kundi-catch@rinueeldii.resend.app")).toBe(false);
  });

  it("liest Adressen in beiden Formaten", () => {
    expect(addressOf("Ana Silva <ANA@fisch.pt>")).toEqual({
      address: "ana@fisch.pt",
      name: "Ana Silva",
    });
    expect(addressOf({ email: "Team@Kundi.ch", name: "Team" })).toEqual({
      address: "team@kundi.ch",
      name: "Team",
    });
  });
});

describe("Anhänge", () => {
  it("lässt nur erlaubte Dateitypen zu", () => {
    expect(isAllowedMime("image/jpeg")).toBe(true);
    expect(isAllowedMime("application/pdf")).toBe(true);
    expect(isAllowedMime("application/x-msdownload")).toBe(false);
  });

  it("erkennt den Dateityp aus dem Namen", () => {
    expect(attachmentMime({ filename: "angebot.PDF" })).toBe("application/pdf");
    expect(attachmentMime({ filename: "bild.webp" })).toBe("image/webp");
  });

  it("ordnet Anhänge grob ein", () => {
    expect(classifyAttachment({ filename: "Preisliste.xlsx" })).toBe("price_list");
    expect(classifyAttachment({ filename: "Etikett.png" })).toBe("product_label");
    expect(classifyAttachment({ filename: "dorade.jpg" })).toBe("product_image");
  });

  it("überspringt Logos und Signaturbilder", () => {
    expect(isDecorativeImage({ filename: "logo.png" }, 50_000)).toBe(true);
    expect(isDecorativeImage({ filename: "dorade.jpg" }, 4_000)).toBe(true);
    expect(isDecorativeImage({ filename: "dorade.jpg" }, 400_000)).toBe(false);
    expect(isDecorativeImage({ filename: "liste.pdf" }, 2_000)).toBe(false);
  });

  it("erkennt, wann die Mail nachgeladen werden muss", () => {
    expect(needsResendLookup({ text: "Hallo", attachments: [] })).toBe(false);
    expect(needsResendLookup({ attachments: [] })).toBe(true);
    expect(needsResendLookup({ text: "Hallo", attachments: [{ filename: "a.pdf" }] })).toBe(true);
  });
});

describe("Textaufbereitung", () => {
  it("entfernt Markup und Skripte", () => {
    const html = "<div><script>alert(1)</script><p>Dorade&nbsp;2&nbsp;kg</p><p>CHF 8.20</p></div>";
    expect(htmlToText(html)).toBe("Dorade 2 kg\nCHF 8.20");
  });
});
