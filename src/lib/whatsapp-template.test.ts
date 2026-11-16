import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_HEADER,
  DEFAULT_TEMPLATE_SETTINGS,
  ensureCatchMarker,
  normalizeTemplate,
  validateTemplate,
  validateTemplateText,
} from "@/lib/app-settings";
import {
  POST_TEMPLATE_VERSION,
  generatePostText,
  isTemplateOnlyChange,
  postSourceSignature,
  signatureTemplateVersion,
  type PostSource,
} from "@/lib/whatsapp-post";

const STADT_NOTE = "(Eintritt via EC Karte - ausser Postfinance)";
const source: PostSource = {
  product_name: "Felchen",
  description: null,
  packaging: null,
  expiry_date: null,
  regular_price: null,
  catch_price: 7.9,
  quantity_unit: "kg",
  locations: [
    { name: "Hofladen Kundelfingerhof", address: null, pickup_note: null },
    { name: "Stadtladen Schaffhausen", address: "Kirchhofplatz 10", pickup_note: STADT_NOTE },
  ],
  available_from: null,
  available_until: null,
  handicap_story: null,
  image_path: null,
  online_shop_url: null,
};

describe("WhatsApp-Vorlage", () => {
  it("ältere gespeicherte Vorlagen behalten die bisherigen Standardtexte", () => {
    const old = normalizeTemplate({ pickup_label: "Abholen:", show_expiry: false, extra: 1 });
    expect(old.header).toBe(DEFAULT_POST_HEADER);
    expect(old.pickup_label).toBe("Abholen:");
    expect(old.show_expiry).toBe(false);
    expect((old as unknown as { extra: number }).extra).toBe(1);
    expect(old.block_order).toEqual(DEFAULT_TEMPLATE_SETTINGS.block_order);
  });

  it("Standardvorlage ergibt unveränderte Signatur-Version", () => {
    expect(signatureTemplateVersion(postSourceSignature(source))).toBe(POST_TEMPLATE_VERSION);
    expect(postSourceSignature(source, normalizeTemplate({}))).toBe(postSourceSignature(source));
  });

  it("geänderter Titel erscheint im Text und gilt als Vorlagenänderung", () => {
    const t = normalizeTemplate({ header: "🐟 *NEU* - teilen!" });
    expect(generatePostText(source, t).split("\n")[0]).toBe("🐟 *NEU* - teilen!");
    const before = postSourceSignature(source);
    const after = postSourceSignature(source, t);
    expect(after).not.toBe(before);
    expect(isTemplateOnlyChange(before, after)).toBe(true);
    expect(signatureTemplateVersion(after)).toBe(POST_TEMPLATE_VERSION);
  });

  it("frühere Schalter, Reihenfolge und ausgeblendete Abschnitte steuern den Post nicht mehr", () => {
    const legacy = normalizeTemplate({
      intro: "Hallo zusammen!",
      hidden_blocks: ["claim", "story", "shop", "stock"],
      block_order: ["pickup", "intro", "product"],
      show_expiry: false,
      show_available_until: false,
      show_discount: false,
      detail_order: ["packaging", "description"],
    });
    const full: PostSource = {
      ...source,
      expiry_date: "2026-12-01",
      available_until: "2026-09-06T14:00:00.000Z",
      regular_price: 10,
      handicap_story: "Kleine Delle.",
      online_shop_url: "https://shop.example.ch/x",
    };
    const text = generatePostText(full, legacy);
    expect(text).toContain("Guter Fisch");
    expect(text).toContain("Kleine Delle.");
    expect(text).toContain("MHD: 01.12.2026");
    expect(text).toContain("Verfügbar bis");
    expect(text).toContain("21.0 % günstiger");
    expect(text).toContain("https://shop.example.ch/x");
    expect(text.indexOf("Hallo zusammen!")).toBeLessThan(text.indexOf("*Felchen*"));
    expect(text.indexOf("*Felchen*")).toBeLessThan(text.indexOf("📍 Abholung:"));
    expect(text).not.toMatch(/\n{3,}/);
    expect(postSourceSignature(full, legacy)).toBe(
      postSourceSignature(full, normalizeTemplate({ intro: "Hallo zusammen!" })),
    );
  });

  it("Standardtext: Titel, Claim, {{catch}}, Abschluss; Ausgabe wie bisher", () => {
    expect(DEFAULT_TEMPLATE_SETTINGS.text).toBe(
      `${DEFAULT_POST_HEADER}\n\n*Guter Fisch. Kleines Handicap. Grosser Fang.*\n\n{{catch}}\n\n*Gut essen. Food Waste vermeiden.*`,
    );
    const text = generatePostText(source);
    expect(text.split("\n")[0]).toBe(DEFAULT_POST_HEADER);
    expect(text.endsWith("*Gut essen. Food Waste vermeiden.*")).toBe(true);
  });

  it("gespeicherte eigene Formulierung (alt) wird zum Text; neuer Text hat Vorrang", () => {
    const old = normalizeTemplate({ header: "Teilt!", claim: "", footer: "Danke" });
    expect(old.text).toBe("Teilt!\n\n{{catch}}\n\nDanke");
    const next = normalizeTemplate({ header: "Teilt!", text: "Mein Text\nZeile 2\n\n{{catch}}" });
    expect(generatePostText(source, next).startsWith("Mein Text\nZeile 2\n\n*Felchen*")).toBe(true);
  });

  it("fehlender Platzhalter: Fakten genau einmal am Ende; doppelter: nur einmal", () => {
    const none = generatePostText(source, normalizeTemplate({ text: "Nur Titel" }));
    expect(none.startsWith("Nur Titel\n\n*Felchen*")).toBe(true);
    expect(none.split("*Felchen*").length - 1).toBe(1);
    const twice = generatePostText(
      source,
      normalizeTemplate({ text: "A\n\n{{catch}}\n\nB\n\n{{ CATCH }}\n\nC" }),
    );
    expect(twice.split("*Felchen*").length - 1).toBe(1);
    expect(twice).toContain("B\n\nC");
    expect(ensureCatchMarker("Text")).toBe("Text\n\n{{catch}}");
    expect(validateTemplateText("{{catch}}")).toMatch(/Vorlagentext/);
    expect(validateTemplateText("<b>x</b> {{catch}}")).toMatch(/HTML/);
    expect(validateTemplateText(DEFAULT_TEMPLATE_SETTINGS.text)).toBeNull();
  });

  it("Signatur reagiert auf neuen Text, nicht auf alte Schalter", () => {
    const base = postSourceSignature(source);
    expect(postSourceSignature(source, normalizeTemplate({ show_expiry: false }))).toBe(base);
    expect(postSourceSignature(source, normalizeTemplate({ text: "Neu {{catch}}" }))).not.toBe(
      base,
    );
  });

  it("Stadtladen-Hinweis genau einmal und nur beim Stadtladen", () => {
    const t = normalizeTemplate({ header: "Anders", pickup_label: "Hier:" });
    const both = generatePostText(source, t);
    expect(both.split(STADT_NOTE).length - 1).toBe(1);
    expect(both).toMatch(/Kirchhofplatz 10\n {2}\(Eintritt via EC Karte - ausser Postfinance\)/);
    const hof = generatePostText({ ...source, locations: [source.locations[0]!] }, t);
    expect(hof).not.toContain("EC Karte");
  });

  it("Validierung: Titel Pflicht, Längen, kein HTML", () => {
    expect(validateTemplate(DEFAULT_TEMPLATE_SETTINGS)).toBeNull();
    expect(validateTemplate({ ...DEFAULT_TEMPLATE_SETTINGS, header: " " })).toMatch(/Titel/);
    expect(validateTemplate({ ...DEFAULT_TEMPLATE_SETTINGS, intro: "x".repeat(1001) })).toMatch(
      /1000/,
    );
    expect(validateTemplate({ ...DEFAULT_TEMPLATE_SETTINGS, footer: "<b>hi</b>" })).toMatch(/HTML/);
  });
});
