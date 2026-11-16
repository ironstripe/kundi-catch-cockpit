/**
 * Getrennte Einkaufs- und Verkaufsbasis («Packungsmodus»).
 *
 * Gemeinsames, validiertes Mengenmodell für Formular, Kalkulation, Detail,
 * Post, Nachkalkulation und Exporte. Die Originaleingaben (Einkaufspreis pro
 * 100 g / kg / Packung, Gewichte in g oder kg) liegen versioniert in
 * `catches.pricing_basis`.
 *
 * Rollout-Grenze: Die bestehenden Spalten bleiben dimensionskonsistent —
 * `quantity_unit = 'Stk'` (= Verkaufspackung), `purchase_quantity` = Anzahl
 * voller Verkaufspackungen, `purchase_price` = gesamter Einkaufsbetrag ÷
 * Packungen (gleiche Steuerbasis), `catch_price`/`regular_price` pro
 * Verkaufspackung. Ein älteres Frontend rechnet damit dieselbe Investition,
 * denselben Umsatz und denselben DB, nie einen Packungspreis als kg-Preis.
 * Die gespeicherte Basis trägt einen Fingerabdruck dieser Spalten; ändert ein
 * älteres Frontend sie, wird die Basis ignoriert und die Legacy-Sicht gilt.
 */

import { parseNumberInput } from "@/lib/catch-calculation";

export type MassUnit = "g" | "kg";
export type PurchaseBasis = "per_100g" | "per_kg" | "per_pack";

export const PACK_LEGACY_UNIT = "Stk";

export interface WeightInput {
  value: number | null;
  unit: MassUnit;
}

export interface PricingBasisV1 {
  version: 1;
  purchase_basis: PurchaseBasis;
  /** Einkaufspreis wie erfasst (pro 100 g, pro kg oder pro Einkaufspackung). */
  purchase_rate: number | null;
  /** Gesamtes Einkaufsgewicht (bei Preis pro 100 g / kg). */
  purchase_total_weight: WeightInput | null;
  /** Ganze Einkaufspackungen (bei Preis pro Packung). */
  purchase_pack_count: number | null;
  purchase_pack_weight: WeightInput | null;
  /** Nettogewicht einer Verkaufspackung. */
  sale_pack_weight: WeightInput | null;
  /** Fingerabdruck der abgeleiteten Legacy-Spalten (Rollout-Schutz). */
  legacy: {
    purchase_quantity: number;
    purchase_price: number | null;
    catch_price: number | null;
    regular_price: number | null;
  };
}

/** Masse in Milligramm als ganze Zahl — vermeidet binäre Rundung an Grenzen. */
export function toMilligrams(weight: WeightInput | null | undefined): number | null {
  if (!weight || weight.value === null || !Number.isFinite(weight.value) || weight.value <= 0) {
    return null;
  }
  const factor = weight.unit === "kg" ? 1_000_000 : 1_000;
  const mg = Math.round(weight.value * factor);
  return mg > 0 && Number.isSafeInteger(mg) ? mg : null;
}

export interface PackModel {
  total_mg: number;
  total_kg: number;
  sale_pack_mg: number;
  sale_pack_kg: number;
  /** Volle Verkaufspackungen (Kapazität). */
  capacity: number;
  /** Nicht zugeteiltes Restgewicht in kg. */
  unallocated_kg: number;
  /** Gesamter Einkaufsbetrag in der erfassten Steuerbasis. */
  purchase_total: number;
  /** Einkaufsbetrag pro voller Verkaufspackung (inkl. Restanteil). */
  purchase_price_per_sale_pack: number;
  /** Einkaufsbetrag pro kg in der erfassten Steuerbasis. */
  purchase_price_per_kg: number;
}

export interface PackModelResult {
  model: PackModel | null;
  /** Feld -> Meldung; leer bei vollständigem Modell. */
  issues: { field: string; message: string }[];
  /** true, wenn Angaben schlicht fehlen (kein Fehler, nur unvollständig). */
  incomplete: boolean;
}

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Leitet Gesamtgewicht, Kapazität und Einkaufsbetrag ab. Nie geraten. */
export function derivePackModel(
  basis: Pick<
    PricingBasisV1,
    | "purchase_basis"
    | "purchase_rate"
    | "purchase_total_weight"
    | "purchase_pack_count"
    | "purchase_pack_weight"
    | "sale_pack_weight"
  >,
): PackModelResult {
  const issues: { field: string; message: string }[] = [];
  let incomplete = false;
  const flag = (field: string, raw: unknown, message: string) => {
    if (raw === null || raw === undefined) incomplete = true;
    else issues.push({ field, message });
  };

  let totalMg: number | null = null;
  if (basis.purchase_basis === "per_pack") {
    const count = basis.purchase_pack_count;
    const packMg = toMilligrams(basis.purchase_pack_weight);
    if (!(typeof count === "number" && Number.isInteger(count) && count > 0)) {
      flag(
        "purchase_pack_count",
        count,
        "Anzahl Einkaufspackungen als ganze Zahl über 0 erfassen.",
      );
    }
    if (packMg === null) {
      flag(
        "purchase_pack_weight",
        basis.purchase_pack_weight?.value ?? null,
        "Nettogewicht pro Einkaufspackung muss grösser als 0 sein.",
      );
    }
    if (typeof count === "number" && Number.isInteger(count) && count > 0 && packMg !== null) {
      totalMg = count * packMg;
    }
  } else {
    totalMg = toMilligrams(basis.purchase_total_weight);
    if (totalMg === null) {
      flag(
        "purchase_total_weight",
        basis.purchase_total_weight?.value ?? null,
        "Gesamtes Einkaufsgewicht muss grösser als 0 sein.",
      );
    }
  }

  const rate = basis.purchase_rate;
  if (!(typeof rate === "number" && Number.isFinite(rate) && rate >= 0)) {
    flag("purchase_rate", rate, "Einkaufspreis darf nicht negativ sein.");
  }

  const saleMg = toMilligrams(basis.sale_pack_weight);
  if (saleMg === null) {
    flag(
      "sale_pack_weight",
      basis.sale_pack_weight?.value ?? null,
      "Nettogewicht pro Verkaufspackung muss grösser als 0 sein.",
    );
  }

  if (issues.length > 0 || totalMg === null || saleMg === null || typeof rate !== "number") {
    return { model: null, issues, incomplete: incomplete || issues.length === 0 };
  }

  const capacity = Math.floor(totalMg / saleMg);
  if (capacity < 1) {
    return {
      model: null,
      issues: [
        {
          field: "sale_pack_weight",
          message: "Die Verkaufspackung ist schwerer als die gesamte Einkaufsmenge.",
        },
      ],
      incomplete: false,
    };
  }

  const totalKg = totalMg / 1_000_000;
  let purchaseTotal: number;
  if (basis.purchase_basis === "per_pack") purchaseTotal = rate * (basis.purchase_pack_count ?? 0);
  else if (basis.purchase_basis === "per_kg") purchaseTotal = (rate * totalMg) / 1_000_000;
  else purchaseTotal = (rate * totalMg) / 100_000;

  return {
    model: {
      total_mg: totalMg,
      total_kg: totalKg,
      sale_pack_mg: saleMg,
      sale_pack_kg: saleMg / 1_000_000,
      capacity,
      unallocated_kg: (totalMg - capacity * saleMg) / 1_000_000,
      purchase_total: purchaseTotal,
      purchase_price_per_sale_pack: purchaseTotal / capacity,
      purchase_price_per_kg: purchaseTotal / totalKg,
    },
    issues: [],
    incomplete: false,
  };
}

/** Abgeleitete, dimensionskonsistente Legacy-Spalten. */
export function legacyColumnsFor(model: PackModel | null) {
  return {
    quantity_unit: PACK_LEGACY_UNIT,
    purchase_quantity: model ? model.capacity : 0,
    purchase_price: model ? model.purchase_price_per_sale_pack : null,
  };
}

function close(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

function readWeight(raw: unknown): WeightInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { unit?: unknown; value?: unknown };
  const unit = r.unit === "g" || r.unit === "kg" ? r.unit : null;
  if (!unit) return null;
  const value = typeof r.value === "number" && Number.isFinite(r.value) ? r.value : null;
  return { value, unit };
}

function readNumber(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/**
 * Liest die gespeicherte Basis. Ungültig, unbekannte Version oder nicht mehr
 * passende Legacy-Spalten → null (Legacy-Interpretation gilt).
 */
export function readPricingBasis(
  raw: unknown,
  row: {
    quantity_unit: string;
    purchase_quantity: number | null;
    purchase_price: number | null;
    catch_price: number | null;
    regular_price: number | null;
  },
): PricingBasisV1 | null {
  if (!raw || typeof raw !== "object") return null;
  type Raw = { [K in keyof PricingBasisV1]?: unknown };
  const r = raw as Raw;
  if (r.version !== 1) return null;
  const basis = r.purchase_basis;
  if (basis !== "per_100g" && basis !== "per_kg" && basis !== "per_pack") return null;
  if (row.quantity_unit !== PACK_LEGACY_UNIT) return null;
  const legacy = (r.legacy ?? {}) as { [K in keyof PricingBasisV1["legacy"]]?: unknown };
  const fingerprint = {
    purchase_quantity: readNumber(legacy.purchase_quantity) ?? 0,
    purchase_price: readNumber(legacy.purchase_price),
    catch_price: readNumber(legacy.catch_price),
    regular_price: readNumber(legacy.regular_price),
  };
  if (
    !close(fingerprint.purchase_quantity, row.purchase_quantity ?? 0) ||
    !close(fingerprint.purchase_price, row.purchase_price) ||
    !close(fingerprint.catch_price, row.catch_price) ||
    !close(fingerprint.regular_price, row.regular_price)
  ) {
    return null;
  }
  const count = readNumber(r.purchase_pack_count);
  return {
    version: 1,
    purchase_basis: basis,
    purchase_rate: readNumber(r.purchase_rate),
    purchase_total_weight: readWeight(r.purchase_total_weight),
    purchase_pack_count: count,
    purchase_pack_weight: readWeight(r.purchase_pack_weight),
    sale_pack_weight: readWeight(r.sale_pack_weight),
    legacy: fingerprint,
  };
}

/** Gewicht ohne überflüssige Nullen: 2.5 kg, 500 g. */
export function formatWeight(kg: number): string {
  if (kg === 0) return "0 kg";
  if (kg < 1) {
    const g = Math.round(kg * 1_000_000) / 1000;
    return `${trim(g)} g`;
  }
  return `${trim(kg)} kg`;
}

function trim(value: number): string {
  return String(Number(value.toFixed(3)));
}

/** «2.5-kg-Packung» / «500-g-Packung». */
export function salePackLabel(basis: PricingBasisV1 | null | undefined): string | null {
  const mg = toMilligrams(basis?.sale_pack_weight);
  if (mg === null) return null;
  return `${formatWeight(mg / 1_000_000).replace(" ", "-")}-Packung`;
}

export const PURCHASE_BASIS_LABELS: Record<PurchaseBasis, string> = {
  per_100g: "pro 100 g",
  per_kg: "pro kg",
  per_pack: "pro Einkaufspackung",
};

/** Formulartext -> Gewicht. */
export function weightFromText(value: string, unit: MassUnit): WeightInput | null {
  if (value.trim() === "") return null;
  return { value: parseNumberInput(value) ?? Number.NaN, unit };
}

/** Anzeige-Einheit einer Menge: im Packungsmodus «Packungen» statt «Stk». */
export function quantityUnitDisplay(
  unit: string,
  basis: PricingBasisV1 | null | undefined,
): string {
  const label = salePackLabel(basis);
  return label ? `× ${label}` : unit;
}
