import type { CatchStatus, QuantityUnit, Temperature } from "@/lib/catch-domain";

/**
 * Beispieldaten für Schritt 1 (Fundament).
 * Diese Inhalte sind bewusst als Platzhalter markiert und werden später
 * durch echte Daten aus der Datenbank ersetzt.
 */
export interface SampleCatch {
  id: string;
  catchNumber: string;
  productName: string;
  temperature: Temperature;
  location: string;
  availableFrom: string;
  status: CatchStatus;
  purchaseQuantity: number;
  quantityUnit: QuantityUnit;
  catchPrice: number;
  expectedSellThrough: number;
}

export const runningCatches: SampleCatch[] = [
  {
    id: "sample-1",
    catchNumber: "KC-2026-014",
    productName: "Felchenfilets TK",
    temperature: "frozen",
    location: "Hofladen Kundelfingerhof",
    availableFrom: "2026-09-05",
    status: "published",
    purchaseQuantity: 42,
    quantityUnit: "kg",
    catchPrice: 27.5,
    expectedSellThrough: 0.85,
  },
  {
    id: "sample-2",
    catchNumber: "KC-2026-015",
    productName: "Frischer Lachs",
    temperature: "fresh",
    location: "Fischzucht Kundelfingerhof",
    availableFrom: "2026-09-06",
    status: "ready",
    purchaseQuantity: 18,
    quantityUnit: "kg",
    catchPrice: 34.9,
    expectedSellThrough: 0.72,
  },
  {
    id: "sample-3",
    catchNumber: "KC-2026-016",
    productName: "Rauchforelle",
    temperature: "fresh",
    location: "Hofstube Kundelfingerhof",
    availableFrom: "2026-09-08",
    status: "draft",
    purchaseQuantity: 60,
    quantityUnit: "Stk",
    catchPrice: 9.8,
    expectedSellThrough: 0.6,
  },
];

export const closedCatches: SampleCatch[] = [
  {
    id: "sample-4",
    catchNumber: "KC-2026-012",
    productName: "Felchenfilets TK",
    temperature: "frozen",
    location: "Hofladen Kundelfingerhof",
    availableFrom: "2026-08-22",
    status: "closed",
    purchaseQuantity: 35,
    quantityUnit: "kg",
    catchPrice: 26.5,
    expectedSellThrough: 0.93,
  },
  {
    id: "sample-5",
    catchNumber: "KC-2026-011",
    productName: "Rauchforelle",
    temperature: "fresh",
    location: "Hofstube Kundelfingerhof",
    availableFrom: "2026-08-15",
    status: "cancelled",
    purchaseQuantity: 24,
    quantityUnit: "Stk",
    catchPrice: 9.5,
    expectedSellThrough: 0,
  },
];
