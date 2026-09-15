import { describe, expect, it } from "vitest";

import { zurichLocalToIso } from "@/lib/format";
import {
  optimizedFileName,
  supportsImageClipboard,
  supportsTextClipboard,
} from "@/lib/whatsapp-image";
import { PROTECTED_BRAND_TEXTS } from "@/lib/app-settings";
import { pickupSummary } from "@/lib/pickup-display";
import {
  isValidProductUrl,
  normaliseProductUrl,
  validateProductUrl,
} from "@/lib/product-link";
import {
  BRAND_CLAIM,
  BRAND_PURPOSE,
  POST_TEMPLATE_VERSION,
  isTemplateOnlyChange,
  signatureTemplateVersion,
  generatePostText,
  parsePostLine,
  postPrice,
  postSourceSignature,
  unitLabel,
  type PostSource,
} from "@/lib/whatsapp-post";

const felchen: PostSource = {
  product_name: "Felchenfilets mit Haut",
  description: "40–70 g, 10 % Glasur",
  packaging: "5-kg-Karton",
  expiry_date: "2027-01-19",
  regular_price: 10.75,
  catch_price: 7.9,
  quantity_unit: "kg",
  locations: [
    {
      name: "Stadtladen Schaffhausen",
      address: "Kirchhofplatz 10, 8200 Schaffhausen",
      pickup_note: null,
    },
  ],
  online_shop_url: null,
  available_from: zurichLocalToIso("2026-09-04T14:00"),
  available_until: null,
  handicap_story:
    "Unser Lieferant baut seinen Lagerbestand ab. Mit dem Fisch stimmt alles. Es ist einfach zu viel davon da.",
  image_path: "bild.jpg",
};

const expected = `🐟 *FOOD CATCH*

*Guter Fisch. Kleines Handicap. Grosser Fang.*

Unser Lieferant baut seinen Lagerbestand ab. Mit dem Fisch stimmt alles. Es ist einfach zu viel davon da.

*Felchenfilets mit Haut*
40–70 g, 10 % Glasur
5-kg-Karton

~CHF 10.75/kg~ → *CHF 7.90/kg* 🔥
26.5 % günstiger
inkl. MWST

MHD: 19.01.2027
*Nur solange Vorrat.*

📍 Abholung:
Stadtladen Schaffhausen
Kirchhofplatz 10
📅 Ab: 04.09.2026 ab 14:00 Uhr

*Gut essen. Food Waste vermeiden.*`;

describe("generatePostText", () => {
  it("erzeugt den Referenzpost mit allen Feldern", () => {
    expect(generatePostText(felchen)).toBe(expected);
  });

  it("ohne Normalpreis nur den Catch-Preis", () => {
    const text = generatePostText({ ...felchen, regular_price: null });
    expect(text).toContain("*FOOD CATCH CHF 7.90/kg* 🔥");
    expect(text).not.toContain("günstiger");
    expect(text).not.toContain("~");
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it("ohne Beschreibung fällt die Zeile weg", () => {
    const text = generatePostText({ ...felchen, description: null });
    expect(text).toContain("*Felchenfilets mit Haut*\n5-kg-Karton");
  });

  it("ohne Verpackung fällt die Zeile weg", () => {
    const text = generatePostText({ ...felchen, packaging: "  " });
    expect(text).not.toContain("5-kg-Karton");
  });

  it("wiederholt die Verpackung nicht, wenn sie in der Beschreibung steht", () => {
    const text = generatePostText({
      ...felchen,
      description: "Praktischer 5-kg-Karton, tiefgekühlt",
    });
    expect(text.match(/5-kg-Karton/g)).toHaveLength(1);
  });

  it("ohne MHD keine MHD-Zeile, aber weiterhin der Vorratshinweis", () => {
    const text = generatePostText({ ...felchen, expiry_date: null });
    expect(text).not.toContain("MHD:");
    expect(text).toContain("*Nur solange Vorrat.*");
  });

  it("listet mehrere Standorte als Aufzählung", () => {
    const text = generatePostText({
      ...felchen,
      locations: [
        { name: "Hofladen Kundelfingerhof", address: null, pickup_note: null },
        {
          name: "Stadtladen Schaffhausen",
          address: "Kirchhofplatz 10, 8200 Schaffhausen",
          pickup_note: "Bitte an der Kasse melden.",
        },
      ],
    });
    expect(text).toContain(
      "📍 Abholung:\n• Hofladen Kundelfingerhof\n• Stadtladen Schaffhausen\n  Kirchhofplatz 10\n  Bitte an der Kasse melden.",
    );
  });

  it("ohne Verfügbarkeitsende keine Zeile «Verfügbar bis»", () => {
    expect(generatePostText(felchen)).not.toContain("Verfügbar bis");
    const withEnd = generatePostText({
      ...felchen,
      available_until: zurichLocalToIso("2026-09-06T18:00"),
    });
    expect(withEnd).toContain("📅 Verfügbar bis: 06.09.2026 bis 18:00 Uhr");
  });

  it("nennt einen negativen Preisvorteil nicht Rabatt", () => {
    const text = generatePostText({ ...felchen, regular_price: 6.5 });
    expect(text).toContain("*FOOD CATCH CHF 7.90/kg* 🔥");
    expect(text).not.toContain("günstiger");
  });

  it("behält Emojis und Zeilenumbrüche", () => {
    const text = generatePostText(felchen);
    expect(text.startsWith("🐟 *FOOD CATCH*")).toBe(true);
    expect(text.split("\n").length).toBeGreaterThan(15);
  });

  it("gibt ohne Catch-Preis keinen Preisblock aus", () => {
    const text = generatePostText({ ...felchen, catch_price: null, regular_price: null });
    expect(text).not.toContain("CHF");
  });
});

describe("postSourceSignature", () => {
  it("bleibt bei unveränderten Daten gleich", () => {
    expect(postSourceSignature(felchen)).toBe(postSourceSignature({ ...felchen }));
  });

  it("ändert sich bei postrelevanten Feldern", () => {
    const base = postSourceSignature(felchen);
    expect(postSourceSignature({ ...felchen, catch_price: 8.5 })).not.toBe(base);
    expect(postSourceSignature({ ...felchen, image_path: "anderes.jpg" })).not.toBe(base);
    expect(
      postSourceSignature({
        ...felchen,
        locations: [
          ...felchen.locations,
          { name: "Hofladen Kundelfingerhof", address: null, pickup_note: null },
        ],
      }),
    ).not.toBe(base);
  });
});

describe("Formatierung", () => {
  it("übersetzt Einheiten für die Anzeige", () => {
    expect(unitLabel("kg")).toBe("kg");
    expect(unitLabel("Stk")).toBe("Stück");
  });

  it("formatiert Preise mit zwei Nachkommastellen", () => {
    expect(postPrice(7.9, "Stk")).toBe("CHF 7.90/Stück");
  });

  it("interpretiert Fettschrift und Durchstreichen nur für die Vorschau", () => {
    const segments = parsePostLine("~CHF 10.75/kg~ → *CHF 7.90/kg* 🔥");
    expect(segments[0]).toEqual({ text: "CHF 10.75/kg", bold: false, strike: true });
    expect(segments[2]).toEqual({ text: "CHF 7.90/kg", bold: true, strike: false });
    expect(segments.map((s) => s.text).join("")).not.toContain("*");
  });
});

describe("Zwischenablage und Bild-Fallback", () => {
  it("erkennt fehlende Bildunterstützung", () => {
    expect(supportsImageClipboard({ clipboard: {} }, false)).toBe(false);
    expect(supportsImageClipboard({ clipboard: { write: () => {} } }, false)).toBe(false);
    expect(supportsImageClipboard({ clipboard: { write: () => {} } }, true)).toBe(true);
  });

  it("erkennt Textunterstützung", () => {
    expect(supportsTextClipboard({ clipboard: {} })).toBe(false);
    expect(supportsTextClipboard({ clipboard: { writeText: () => {} } })).toBe(true);
  });

  it("baut einen sprechenden Dateinamen für den Download", () => {
    expect(optimizedFileName("KC-2026-001", "Felchenfilets mit Haut")).toBe(
      "KC-2026-001-felchenfilets-mit-haut.jpg",
    );
    expect(optimizedFileName(null, "Räucherforelle", "png")).toBe("raeucherforelle.png");
  });
});

describe("Markenarchitektur", () => {
  it("verwendet nur den freigegebenen Claim und Purpose", () => {
    expect(BRAND_CLAIM).toBe("Guter Fisch. Kleines Handicap. Grosser Fang.");
    expect(BRAND_PURPOSE).toBe("Gut essen. Food Waste vermeiden.");
  });

  it("beendet den Post mit dem Purpose und ohne «Schnell sein»", () => {
    const text = generatePostText(felchen);
    expect(text.endsWith("*Gut essen. Food Waste vermeiden.*")).toBe(true);
    expect(text).not.toContain("Schnell sein");
    expect(text).toContain("*Nur solange Vorrat.*");
  });

  it("schützt die freigegebenen Markentexte ohne alte Purpose-Zeile", () => {
    expect([...PROTECTED_BRAND_TEXTS]).toEqual([
      "FOOD CATCH",
      "Kundelfingerhof",
      "Guter Fisch. Kleines Handicap. Grosser Fang.",
      "Nur solange Vorrat.",
      "Gut essen. Food Waste vermeiden.",
    ]);
    expect(PROTECTED_BRAND_TEXTS.join(" ")).not.toContain("Schnell sein");
  });

  it("markiert bestehende Posts der alten Vorlagenversion als veraltet", () => {
    const current = postSourceSignature(felchen);
    const old = JSON.stringify([...(JSON.parse(current) as unknown[]).slice(0, -1), 1]);
    expect(old).not.toBe(current);
    expect(isTemplateOnlyChange(old, current)).toBe(true);
    expect(signatureTemplateVersion(old)).toBe(1);
    expect(signatureTemplateVersion(current)).toBe(POST_TEMPLATE_VERSION);
  });

  it("unterscheidet Datenänderungen von reinen Vorlagenänderungen", () => {
    const current = postSourceSignature(felchen);
    const changed = postSourceSignature({ ...felchen, catch_price: 8.4 });
    expect(isTemplateOnlyChange(changed, current)).toBe(false);
  });
});

describe("Abholorte und Produktlink", () => {
  it("zeigt einen Abholort ohne Adresse nur mit Namen", () => {
    const text = generatePostText({
      ...felchen,
      locations: [{ name: "Hofladen Kundelfingerhof", address: null, pickup_note: null }],
    });
    expect(text).toContain("📍 Abholung:\nHofladen Kundelfingerhof\n📅 Ab:");
  });

  it("hängt einen vorhandenen Abholhinweis an", () => {
    const text = generatePostText({
      ...felchen,
      locations: [
        {
          name: "Stadtladen Schaffhausen",
          address: "Kirchhofplatz 10, 8200 Schaffhausen",
          pickup_note: "Bitte an der Kasse melden.",
        },
      ],
    });
    expect(text).toContain("Kirchhofplatz 10\nBitte an der Kasse melden.");
  });

  it("nennt den Onlineshop nur bei hinterlegtem Produktlink", () => {
    expect(generatePostText(felchen)).not.toContain("Onlineshop");
    const text = generatePostText({
      ...felchen,
      online_shop_url: "https://shop.example/felchenfilets",
    });
    expect(text).toContain("🛒 Im Onlineshop bestellen:\nhttps://shop.example/felchenfilets");
    expect(text.endsWith("*Gut essen. Food Waste vermeiden.*")).toBe(true);
  });

  it("berücksichtigt Adresse und Produktlink in der Signatur", () => {
    const base = postSourceSignature(felchen);
    expect(postSourceSignature({ ...felchen, online_shop_url: "https://shop.example/x" })).not.toBe(
      base,
    );
    expect(
      postSourceSignature({
        ...felchen,
        locations: [{ ...felchen.locations[0]!, address: "Andere Strasse 1, 8200 Schaffhausen" }],
      }),
    ).not.toBe(base);
  });
});

describe("Produktlink-Validierung", () => {
  it("akzeptiert https und localhost", () => {
    expect(validateProductUrl("https://shop.example/produkt")).toBeNull();
    expect(validateProductUrl("http://localhost:8080/produkt")).toBeNull();
    expect(validateProductUrl("  ")).toBeNull();
  });

  it("weist unsichere und fehlerhafte Adressen ab", () => {
    expect(validateProductUrl("javascript:alert(1)")).toContain("https://");
    expect(validateProductUrl("data:text/html,<b>x</b>")).toContain("https://");
    expect(validateProductUrl("http://shop.example/produkt")).toContain("https://");
    expect(validateProductUrl("shop.example")).toContain("vollständige Adresse");
  });

  it("normalisiert Leerzeichen und erkennt gültige Links", () => {
    expect(normaliseProductUrl("  https://shop.example/x  ")).toBe("https://shop.example/x");
    expect(normaliseProductUrl("   ")).toBeNull();
    expect(isValidProductUrl(" https://shop.example/x ")).toBe(true);
    expect(isValidProductUrl(null)).toBe(false);
  });
});

describe("Abholorte in der Cockpit-Anzeige", () => {
  it("fasst Name und Adresse zusammen", () => {
    expect(
      pickupSummary([
        { name: "Stadtladen Schaffhausen", address: "Kirchhofplatz 10, 8200 Schaffhausen" },
        { name: "Hofladen Kundelfingerhof", address: null },
      ]),
    ).toBe("Stadtladen Schaffhausen, Kirchhofplatz 10, 8200 Schaffhausen · Hofladen Kundelfingerhof");
    expect(pickupSummary([])).toBeNull();
  });
});
