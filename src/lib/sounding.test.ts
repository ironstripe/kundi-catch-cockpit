import { describe, expect, it } from "vitest";

import { calculateCatch } from "@/lib/catch-calculation";
import type { CatchDetail } from "@/lib/catches";
import {
  buildSoundingSnapshot,
  looksLikeTeamsUrl,
  readyBlockReason,
  responseCommentRequired,
  reviewUrlFor,
  soundingCompletionBlockReason,
  soundingMessage,
  soundingStartBlockReason,
  validateResponse,
  validateTeamsUrl,
  type ReviewDecision,
  type ReviewResponse,
  type ReviewRound,
} from "@/lib/sounding";

function response(decision: ReviewDecision): ReviewResponse {
  return {
    id: `r-${decision}`,
    review_round_id: "round-1",
    user_id: "user-1",
    user_name: "Test",
    decision,
    comment: decision === "approved" ? null : "Begründung",
    created_at: "2026-09-15T10:00:00.000Z",
    updated_at: "2026-09-15T10:00:00.000Z",
  };
}

function round(
  status: ReviewRound["status"],
  responses: ReviewResponse[] = [],
): Pick<ReviewRound, "status" | "responses"> {
  return { status, responses };
}

const catchItem: CatchDetail = {
  id: "catch-1",
  catch_number: "KC-2026-001",
  product_name: "Silberlachs-Filet",
  article_number: "ART-4711",
  internal_handling_cost_per_unit: 2.5,
  temperature: "frozen",
  status: "draft",
  available_from: "2026-09-18T08:00:00.000Z",
  purchase_quantity: 100,
  quantity_unit: "kg",
  catch_price: 7.9,
  purchase_price: 6.5,
  delivery_cost: 0,
  delivery_included: true,
  regular_price: 12.5,
  vat_rate: 2.6,
  purchase_price_includes_vat: false,
  purchase_vat_rate: 2.6,
  delivery_cost_includes_vat: false,
  delivery_vat_rate: 8.1,
  vat_basis_confirmed: true,
  updated_at: "2026-09-15T10:00:00.000Z",
  expected_sell_through: null,
  image_path: "catch-1/bild.jpg",
  location_names: ["Kundelfingerhof"],
  location_ids: ["loc-1"],
  locations: [
    {
      id: "loc-1",
      name: "Kundelfingerhof",
      address: "Kundelfingerhof 1, 8245 Feuerthalen",
      pickup_note: null,
    },
  ],
  online_shop_url: null,
  supplier_id: "sup-1",
  supplier_name: "Fischhandel Nord",
  published_at: null,
  published_text: null,
  published_image_path: null,
  remaining_quantity: null,
  inventory_counted_at: null,
  learning: null,
  closed_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  sample_check_status: "passed",
  sample_checked_at: "2026-09-15T12:30:00.000Z",
  sample_checked_by: "user-9",
  sample_check_note: "Geschmack und Konsistenz einwandfrei.",
  description: null,
  packaging: null,
  expiry_date: null,
  available_until: null,
  handicap_reason: "surplus",
  handicap_story: "Zu viel produziert.",
  internal_note: "Nur intern: Reservation Team",
  created_at: "2026-09-14T10:00:00.000Z",
  closed_by: null,
  reopened_at: null,
  reopened_by: null,
  reopen_reason: null,
  cancelled_by: null,
  reconciliation_snapshot: null,
  published_by: null,
  post_generated_text: null,
  post_final_text: null,
  post_generated_at: null,
  post_source_signature: null,
  post_outdated_decision: null,
  instagram_selected: false,
  instagram_caption: null,
  instagram_asset_path: null,
  instagram_status: "not_selected",
  instagram_approved_by: null,
  instagram_approved_at: null,
  instagram_publish_at: null,
  instagram_published_at: null,
  instagram_permalink: null,
  instagram_error: null,
};

const calculation = calculateCatch({
  purchase_quantity: 100,
  quantity_unit: "kg",
  purchase_price: 6.5,
  delivery_cost: 0,
  regular_price: 12.5,
  catch_price: 7.9,
  vat_rate: 2.6,
  purchase_price_includes_vat: false,
  purchase_vat_rate: 2.6,
  delivery_cost_includes_vat: false,
  delivery_vat_rate: 8.1,
  internal_handling_cost_per_unit: 0.5,
});

describe("Musterprüfung als Voraussetzung", () => {
  it("blockiert das Sounding, solange die Musterprüfung aussteht", () => {
    expect(soundingStartBlockReason("pending", true)).toBe(
      "Die Musterprüfung ist noch ausstehend.",
    );
  });

  it("blockiert das Sounding nach nicht bestandener Musterprüfung", () => {
    expect(soundingStartBlockReason("failed", true)).toContain("nicht bestanden");
  });

  it("verlangt eine vollständige Kalkulation", () => {
    expect(soundingStartBlockReason("passed", false)).toBe(
      "Die Kalkulation ist noch nicht vollständig.",
    );
  });

  it("gibt das Sounding nach bestandener Musterprüfung frei", () => {
    expect(soundingStartBlockReason("passed", true)).toBeNull();
  });
});

describe("Abschluss des Soundings", () => {
  it("braucht mindestens eine Rückmeldung", () => {
    expect(soundingCompletionBlockReason("passed", round("requested"))).toBe(
      "Es fehlt eine Rückmeldung.",
    );
  });

  it("braucht mindestens eine Zustimmung — eine Rückfrage genügt nicht", () => {
    expect(
      soundingCompletionBlockReason("passed", round("feedback_received", [response("question")])),
    ).toBe("Es braucht mindestens eine Zustimmung.");
  });

  it("blockiert bei offenem Stopp", () => {
    expect(
      soundingCompletionBlockReason(
        "passed",
        round("feedback_received", [response("approved"), response("stop")]),
      ),
    ).toContain("Stopp");
  });

  it("erlaubt den Abschluss mit einer Zustimmung", () => {
    expect(
      soundingCompletionBlockReason("passed", round("feedback_received", [response("approved")])),
    ).toBeNull();
  });

  it("blockiert, wenn die Musterprüfung nicht bestanden ist", () => {
    expect(
      soundingCompletionBlockReason("failed", round("feedback_received", [response("approved")])),
    ).toBe("Die Musterprüfung ist nicht bestanden.");
  });
});

describe("Freigabe auf «Bereit»", () => {
  it("nennt die ausstehende Musterprüfung", () => {
    expect(readyBlockReason("pending", null)).toBe("Die Musterprüfung ist noch ausstehend.");
  });

  it("nennt die nicht bestandene Musterprüfung", () => {
    expect(readyBlockReason("failed", null)).toBe("Die Musterprüfung wurde nicht bestanden.");
  });

  it("verlangt ein gestartetes Sounding", () => {
    expect(readyBlockReason("passed", null)).toBe("Das Sounding wurde noch nicht gestartet.");
  });

  it("verlangt eine Rückmeldung", () => {
    expect(readyBlockReason("passed", round("requested"))).toBe("Es fehlt eine Rückmeldung.");
  });

  it("verlangt den Abschluss", () => {
    expect(readyBlockReason("passed", round("feedback_received", [response("approved")]))).toBe(
      "Das Sounding wurde noch nicht abgeschlossen.",
    );
  });

  it("blockiert ein überholtes Sounding", () => {
    expect(readyBlockReason("passed", round("outdated", [response("approved")]))).toBe(
      "Der Catch wurde nach dem Sounding verändert und muss erneut geprüft werden.",
    );
  });

  it("gibt nach abgeschlossenem Sounding frei", () => {
    expect(readyBlockReason("passed", round("completed", [response("approved")]))).toBeNull();
  });
});

describe("Rückmeldungen", () => {
  it("verlangt einen Kommentar bei Rückfrage und Stopp", () => {
    expect(responseCommentRequired("question")).toBe(true);
    expect(responseCommentRequired("stop")).toBe(true);
    expect(responseCommentRequired("approved")).toBe(false);
    expect(validateResponse("stop", "  ")).toContain("Kommentar");
    expect(validateResponse("approved", "")).toBeNull();
  });
});

describe("Steckbrief und Teams-Nachricht", () => {
  const snapshot = buildSoundingSnapshot(catchItem, calculation, "Ivo Streiff");
  /** Schweizer Formate nutzen geschützte Leerzeichen — für Vergleiche normalisieren. */
  const message = soundingMessage(
    snapshot,
    reviewUrlFor("catch-1", "https://cockpit.example"),
  ).replace(/[\u00a0\u202f]/g, " ");

  it("hält die geprüften Werte fest", () => {
    expect(snapshot.gross_catch_price).toBe(7.9);
    expect(snapshot.net_investment).toBeCloseTo(650, 2);
    expect(snapshot.maximum_contribution_margin).toBeCloseTo(119.98, 2);
    expect(snapshot.internal_handling_cost_per_unit).toBe(0.5);
    expect(snapshot.internal_handling_cost_total).toBeCloseTo(50, 2);
    expect(snapshot.db_ii).toBeCloseTo(69.98, 2);
    expect(snapshot.sample_check_status).toBe("passed");
    expect(snapshot.sample_checked_by_name).toBe("Ivo Streiff");
  });

  it("verwendet den Bruttopreis inkl. MWST", () => {
    expect(message).toContain("Verkaufspreis: CHF 7.90 inkl. MWST");
  });

  it("verwendet Netto-Deckungsbeitrag und Netto-Rohmarge", () => {
    expect(message).toContain("DB I: CHF 119.98");
    expect(message).toContain("Interner Aufwand: CHF 50.00");
    expect(message).toContain("DB II: CHF 69.98");
    expect(message).toContain("Rohmarge: 15.6 %");
  });

  it("nennt Musterprüfung, Menge und den geschützten Review-Link", () => {
    expect(message).toContain("🐟 FOOD CATCH – Sounding");
    expect(message).toContain("Menge: 100 kg");
    expect(message).toContain("Artikelnummer: ART-4711");
    expect(message).toContain("Musterprüfung: ✅ Bestanden");
    expect(message).toContain("https://cockpit.example/catches/catch-1/review");
  });

  it("enthält keine WhatsApp-Formulierung und keine internen Notizen", () => {
    expect(message.toLowerCase()).not.toContain("whatsapp");
    expect(message).not.toContain("Reservation Team");
    expect(message).not.toContain("catch-1/bild.jpg");
  });
});

describe("Teams-Gruppenchat-Link", () => {
  it("verlangt eine https-Adresse", () => {
    expect(validateTeamsUrl("http://teams.microsoft.com/x")).toBe(
      "Der Link muss mit https:// beginnen.",
    );
    expect(validateTeamsUrl("teams")).toContain("vollständige Adresse");
    expect(validateTeamsUrl("")).toBeNull();
    expect(validateTeamsUrl("https://teams.microsoft.com/l/chat/1")).toBeNull();
  });

  it("erkennt Microsoft-Teams-Adressen", () => {
    expect(looksLikeTeamsUrl("https://teams.microsoft.com/l/chat/1")).toBe(true);
    expect(looksLikeTeamsUrl("https://example.com/chat")).toBe(false);
  });
});

describe("Produktlink im Sounding", () => {
  it("übernimmt Abholorte und Produktlink in den Steckbrief", () => {
    const snapshot = buildSoundingSnapshot(
      { ...catchItem, online_shop_url: "https://shop.example/silberlachs" },
      calculation,
      "Anna Muster",
    );
    expect(snapshot.online_shop_url).toBe("https://shop.example/silberlachs");
    expect(snapshot.locations[0]?.address).toBe("Kundelfingerhof 1, 8245 Feuerthalen");
  });

  it("nennt den Onlineshop in der Teams-Nachricht nur, wenn ein Link hinterlegt ist", () => {
    const withLink = soundingMessage(
      buildSoundingSnapshot(
        { ...catchItem, online_shop_url: "https://shop.example/silberlachs" },
        calculation,
        null,
      ),
      "https://cockpit.example/catches/catch-1/review",
    );
    const withoutLink = soundingMessage(
      buildSoundingSnapshot(catchItem, calculation, null),
      "https://cockpit.example/catches/catch-1/review",
    );
    expect(withLink).toContain("Onlineshop: https://shop.example/silberlachs");
    expect(withLink.trim().endsWith("https://cockpit.example/catches/catch-1/review")).toBe(true);
    expect(withoutLink).not.toContain("Onlineshop:");
  });
});
