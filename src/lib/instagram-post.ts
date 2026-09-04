/**
 * Deterministische Erzeugung des Instagram-Teasers.
 *
 * Kein KI-Dienst. Bewusst kurz: kein Abbild des WhatsApp-Posts,
 * keine Mengen, keine Abholorte, keine Verfügbarkeitsdetails.
 */

import { HANDICAP_REASON_LABELS, type HandicapReason } from "@/lib/catch-domain";

export const INSTAGRAM_HEADLINE = "KUNDI CATCH";
export const INSTAGRAM_CLAIM = "Guter Fisch. Kleines Handicap. Grosser Fang.";
export const INSTAGRAM_PURPOSE = "Gut essen. Food Waste vermeiden.";

export const DEFAULT_INSTAGRAM_CTA =
  "Die aktuellen Kundi Catches gibt es zuerst in unserer WhatsApp-Gruppe.\nJetzt über den Link in der Bio beitreten.";

/** Maximale Länge des Handicap-Hinweises im Teaser. */
export const HANDICAP_HINT_MAX = 120;

export interface InstagramSource {
  product_name: string;
  handicap_reason: string | null;
  handicap_story: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

/** Erster Satz der Handicap-Story, gekürzt — sonst das Label des Grundes. */
export function handicapHint(source: InstagramSource): string | null {
  const story = clean(source.handicap_story);
  if (story) {
    const firstSentence = story.split(/(?<=[.!?])\s/)[0] ?? story;
    const base = firstSentence.trim();
    if (base.length <= HANDICAP_HINT_MAX) return base;
    const cut = base.slice(0, HANDICAP_HINT_MAX);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }
  const reason = clean(source.handicap_reason);
  if (!reason) return null;
  return HANDICAP_REASON_LABELS[reason as HandicapReason] ?? reason;
}

/** Vollständiger Instagram-Text. Optionale Teile entfallen restlos. */
export function generateInstagramCaption(
  source: InstagramSource,
  callToAction: string = DEFAULT_INSTAGRAM_CTA,
): string {
  const product = clean(source.product_name) ?? "Kundi Catch";
  const hint = handicapHint(source);
  const cta = clean(callToAction) ? callToAction.trim() : DEFAULT_INSTAGRAM_CTA;

  const blocks = [
    `${INSTAGRAM_HEADLINE}\n${INSTAGRAM_CLAIM}`,
    hint ? `${product} — ${hint}` : product,
    cta,
    INSTAGRAM_PURPOSE,
  ];
  return blocks.join("\n\n");
}

/** Signatur der Eingabewerte — erkennt, ob der Text veraltet ist. */
export function instagramSourceSignature(
  source: InstagramSource,
  callToAction: string = DEFAULT_INSTAGRAM_CTA,
): string {
  return [
    clean(source.product_name) ?? "",
    handicapHint(source) ?? "",
    clean(callToAction) ?? "",
  ].join("|");
}
