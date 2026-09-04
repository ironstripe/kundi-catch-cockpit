import { describe, expect, it } from "vitest";

import { filterHistory } from "@/routes/_authenticated/history";
import type { CatchListItem } from "@/lib/catches";

function row(overrides: Partial<CatchListItem>): CatchListItem {
  return {
    id: crypto.randomUUID(),
    catch_number: "KC-2026-001",
    product_name: "Felchenfilets mit Haut",
    temperature: "frozen",
    status: "closed",
    purchase_quantity: 100,
    quantity_unit: "kg",
    purchase_price: 6.5,
    delivery_cost: 0,
    delivery_included: false,
    regular_price: 10.75,
    catch_price: 7.9,
    available_from: null,
    available_until: null,
    expected_sell_through: null,
    image_path: null,
    location_ids: [],
    location_names: ["Stadtladen Schaffhausen"],
    supplier_id: null,
    supplier_name: "Kundelfingerhof",
    published_at: "2026-09-04T10:00:00.000Z",
    remaining_quantity: 12,
    inventory_counted_at: "2026-09-05T10:00:00.000Z",
    learning: "Menge nächstes Mal auf 120 kg erhöhen.",
    closed_at: new Date().toISOString(),
    cancelled_at: null,
    cancellation_reason: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  } as CatchListItem;
}

const rows = [
  row({}),
  row({
    catch_number: "KC-2026-002",
    product_name: "Egli-Filets",
    temperature: "fresh",
    supplier_name: "Fischerei Bodensee",
    location_names: ["Hofladen Kundelfingerhof"],
    quantity_unit: "Stück",
    learning: "Portionen waren zu klein.",
    status: "cancelled",
    closed_at: null,
    cancelled_at: new Date().toISOString(),
  }),
  row({
    catch_number: "KC-2025-009",
    product_name: "Forelle",
    closed_at: new Date(Date.now() - 400 * 86_400_000).toISOString(),
  }),
];

describe("filterHistory", () => {
  it("gibt ohne Filter alle Zeilen zurück", () => {
    expect(filterHistory(rows, {})).toHaveLength(3);
  });

  it("filtert nach Frisch / TK", () => {
    expect(filterHistory(rows, { temperature: "fresh" })).toHaveLength(1);
    expect(filterHistory(rows, { temperature: "frozen" })).toHaveLength(2);
  });

  it("filtert nach Status, Lieferant und Standort", () => {
    expect(filterHistory(rows, { status: "cancelled" })).toHaveLength(1);
    expect(filterHistory(rows, { supplier: "Fischerei Bodensee" })).toHaveLength(1);
    expect(filterHistory(rows, { location: "Stadtladen Schaffhausen" })).toHaveLength(2);
  });

  it("filtert nach Zeitraum", () => {
    expect(filterHistory(rows, { period: "30" })).toHaveLength(2);
    expect(filterHistory(rows, { period: "alle" })).toHaveLength(3);
  });

  it("sucht über Catch-Nummer, Produkt, Lieferant, Standort und Learning", () => {
    expect(filterHistory(rows, { q: "kc-2026-002" })).toHaveLength(1);
    expect(filterHistory(rows, { q: "egli" })).toHaveLength(1);
    expect(filterHistory(rows, { q: "bodensee" })).toHaveLength(1);
    expect(filterHistory(rows, { q: "hofladen" })).toHaveLength(1);
    expect(filterHistory(rows, { q: "120 kg" })).toHaveLength(2);
    expect(filterHistory(rows, { q: "nicht vorhanden" })).toHaveLength(0);
  });

  it("kombiniert Filter und Suche", () => {
    expect(filterHistory(rows, { q: "felchen", status: "closed", period: "30" })).toHaveLength(1);
    expect(filterHistory(rows, { q: "felchen", status: "cancelled" })).toHaveLength(0);
  });
});
