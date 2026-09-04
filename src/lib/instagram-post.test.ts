import { describe, expect, it } from "vitest";

import {
  DEFAULT_INSTAGRAM_CTA,
  generateInstagramCaption,
  handicapHint,
  instagramSourceSignature,
} from "@/lib/instagram-post";

describe("generateInstagramCaption", () => {
  const base = {
    product_name: "Felchenfilets TK",
    handicap_reason: "short_expiry",
    handicap_story: "Kurzes Mindesthaltbarkeitsdatum. Qualität top, Zeit knapp.",
  };

  it("erzeugt den freigegebenen Aufbau", () => {
    const text = generateInstagramCaption(base);
    expect(text).toBe(
      [
        "KUNDI CATCH\nGuter Fisch. Kleines Handicap. Grosser Fang.",
        "Felchenfilets TK — Kurzes Mindesthaltbarkeitsdatum.",
        DEFAULT_INSTAGRAM_CTA,
        "Gut essen. Food Waste vermeiden.",
      ].join("\n\n"),
    );
  });

  it("ist deterministisch", () => {
    expect(generateInstagramCaption(base)).toBe(generateInstagramCaption(base));
  });

  it("nennt keine Mengen, Preise oder Abholorte", () => {
    const text = generateInstagramCaption(base);
    expect(text).not.toMatch(/CHF|kg|Abholung/);
  });

  it("nutzt das Label des Grundes ohne Story", () => {
    expect(handicapHint({ ...base, handicap_story: null })).toBeTruthy();
  });

  it("kommt ohne Handicap-Angaben aus", () => {
    const text = generateInstagramCaption({
      product_name: "Eglifilets",
      handicap_reason: null,
      handicap_story: null,
    });
    expect(text).toContain("Eglifilets");
    expect(text).not.toContain("—");
  });

  it("kürzt lange Storys", () => {
    const hint = handicapHint({
      ...base,
      handicap_story: `${"sehr lange Beschreibung ".repeat(20)}`,
    });
    expect(hint!.length).toBeLessThanOrEqual(121);
    expect(hint!.endsWith("…")).toBe(true);
  });

  it("erkennt geänderte Eingaben über die Signatur", () => {
    expect(instagramSourceSignature(base)).not.toBe(
      instagramSourceSignature({ ...base, product_name: "Andere" }),
    );
  });
});
