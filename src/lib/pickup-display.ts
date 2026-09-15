/**
 * Anzeige der Abholorte im Cockpit — Adresse und Abholhinweis
 * kommen immer aus den Standort-Stammdaten.
 */

import type { CatchLocation } from "@/lib/catches";

/** Ein Abholort einzeilig: «Stadtladen Schaffhausen, Kirchhofplatz 10, 8200 Schaffhausen». */
export function pickupLine(location: Pick<CatchLocation, "name" | "address">): string {
  const address = (location.address ?? "").trim();
  return address === "" ? location.name.trim() : `${location.name.trim()}, ${address}`;
}

/** Alle Abholorte für eine Detailzeile; null, wenn keiner gewählt ist. */
export function pickupSummary(locations: Pick<CatchLocation, "name" | "address">[]): string | null {
  const lines = locations.filter((location) => location.name.trim() !== "").map(pickupLine);
  return lines.length === 0 ? null : lines.join(" · ");
}
