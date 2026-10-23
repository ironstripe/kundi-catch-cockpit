import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_HEADER,
  DEFAULT_TEMPLATE_SETTINGS,
  normalizeTemplate,
  validateTemplate,
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
    const t = { ...DEFAULT_TEMPLATE_SETTINGS, header: "🐟 *NEU* - teilen!" };
    expect(generatePostText(source, t).split("\n")[0]).toBe("🐟 *NEU* - teilen!");
    const before = postSourceSignature(source);
    const after = postSourceSignature(source, t);
    expect(after).not.toBe(before);
    expect(isTemplateOnlyChange(before, after)).toBe(true);
    expect(signatureTemplateVersion(after)).toBe(POST_TEMPLATE_VERSION);
  });

  it("Einleitung, ausgeblendeter Claim und Reihenfolge ergeben sauberen Text", () => {
    const t = {
      ...DEFAULT_TEMPLATE_SETTINGS,
      intro: "Hallo zusammen!",
      hidden_blocks: ["claim" as const],
      block_order: ["pickup" as const, "intro" as const, "product" as const],
    };
    const text = generatePostText(source, normalizeTemplate(t));
    expect(text).not.toContain("Guter Fisch");
    expect(text).not.toMatch(/\n{3,}/);
    expect(text.indexOf("📍 Abholung:")).toBeLessThan(text.indexOf("Hallo zusammen!"));
    expect(text.indexOf("Hallo zusammen!")).toBeLessThan(text.indexOf("*Felchen*"));
  });

  it("leere optionale Bausteine entfallen; Pflichtabschnitte bleiben", () => {
    const t = normalizeTemplate({
      footer: "  ",
      claim: "",
      hidden_blocks: ["product", "price", "pickup"],
    });
    expect(t.hidden_blocks).toEqual([]);
    const text = generatePostText(source, t);
    expect(text).not.toContain("Gut essen");
    expect(text).toContain("*Felchen*");
    expect(text.endsWith("\n")).toBe(false);
  });

  it("Stadtladen-Hinweis genau einmal und nur beim Stadtladen", () => {
    const t = { ...DEFAULT_TEMPLATE_SETTINGS, header: "Anders", pickup_label: "Hier:" };
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
