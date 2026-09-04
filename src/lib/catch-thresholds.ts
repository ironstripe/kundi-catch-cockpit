/**
 * Zentrale Schwellenwerte der Catch-Ampel.
 * Nur hier ändern — alle Komponenten lesen diese Werte.
 */
export interface CatchThresholds {
  /** Mindest-Rohmarge in Prozent für «Guter Catch». */
  minimum_green_margin: number;
  /** Mindest-Preisvorteil in Prozent für «Guter Catch». */
  minimum_green_discount: number;
  /** Höchster Break-even-Abverkauf in Prozent für «Guter Catch». */
  maximum_green_break_even: number;
  /** Höchster Break-even-Abverkauf in Prozent für «Knapp kalkuliert». */
  maximum_orange_break_even: number;
}

export const DEFAULT_CATCH_THRESHOLDS: CatchThresholds = {
  minimum_green_margin: 15,
  minimum_green_discount: 25,
  maximum_green_break_even: 85,
  maximum_orange_break_even: 95,
};
