/**
 * Excel-Export des operativen Datenbestands.
 * Die Kennzahlen stammen aus denselben Funktionen wie die Anwendung
 * (`calculateCatch`, `reconcileCatch`) — keine separaten Tabellenformeln.
 */

import { supabase } from "@/integrations/supabase/client";
import { CATCH_STATUS_LABELS, TEMPERATURE_LABELS, type CatchStatus } from "@/lib/catch-domain";
import { calculateCatch } from "@/lib/catch-calculation";
import { formatDuration, reconcileCatch } from "@/lib/catch-reconciliation";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, auditSummary, fetchAuditEvents } from "@/lib/audit";
import { fetchAllLocations, fetchAllSuppliers, fetchCategories } from "@/lib/master-data";
import { ROLE_LABELS, type AppRole } from "@/hooks/use-role";

export const EXPORT_BUCKET = "exports";

const CHF = '"CHF" #,##0.00';
const PERCENT = '0.0"%"';
const DATE = "dd.mm.yyyy";
const DATETIME = "dd.mm.yyyy hh:mm";

interface Column {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
}

/** Dateiname nach Vorgabe: Kundi_Catch_Export_YYYY-MM-DD_HH-mm.xlsx */
export function exportFileName(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [date, time] = parts.split(" ");
  return `Kundi_Catch_Export_${date}_${(time ?? "00:00").replace(":", "-")}.xlsx`;
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

const CATCH_SELECT = `
  id, catch_number, status, product_name, temperature, category, description, packaging,
  expiry_date, purchase_quantity, quantity_unit, purchase_price, delivery_cost,
  delivery_included, regular_price, catch_price, available_from, available_until,
  handicap_story, published_at, closed_at, remaining_quantity, inventory_counted_at,
  learning, created_at, updated_at,
  suppliers ( name ),
  catch_locations ( locations ( name ) )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadCatchRows() {
  const { data, error } = await supabase
    .from("catches")
    .select(CATCH_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

function catchRow(row: any) {
  const input = {
    purchase_quantity: Number(row.purchase_quantity ?? 0),
    quantity_unit: row.quantity_unit ?? "kg",
    purchase_price: row.purchase_price ?? null,
    delivery_cost: Number(row.delivery_cost ?? 0),
    delivery_included: Boolean(row.delivery_included),
    regular_price: row.regular_price ?? null,
    catch_price: row.catch_price ?? null,
  };
  const reconciliation = reconcileCatch({
    ...input,
    remaining_quantity: row.remaining_quantity ?? null,
    published_at: row.published_at ?? null,
    inventory_counted_at: row.inventory_counted_at ?? null,
  });
  const values = reconciliation.values;
  const locations = (row.catch_locations ?? [])
    .map((entry: any) => entry?.locations?.name)
    .filter(Boolean)
    .join(", ");

  return {
    catch_number: row.catch_number ?? "",
    status: CATCH_STATUS_LABELS[row.status as CatchStatus] ?? row.status,
    product_name: row.product_name,
    temperature: TEMPERATURE_LABELS[row.temperature as "fresh" | "frozen"] ?? row.temperature,
    category: row.category ?? "",
    description: row.description ?? "",
    packaging: row.packaging ?? "",
    expiry_date: toDate(row.expiry_date),
    supplier: row.suppliers?.name ?? "",
    purchase_quantity: Number(row.purchase_quantity ?? 0),
    quantity_unit: row.quantity_unit ?? "",
    purchase_price: row.purchase_price ?? null,
    delivery_cost: Number(row.delivery_cost ?? 0),
    regular_price: row.regular_price ?? null,
    catch_price: row.catch_price ?? null,
    locations,
    available_from: toDate(row.available_from),
    available_until: toDate(row.available_until),
    handicap_story: row.handicap_story ?? "",
    published_at: toDate(row.published_at),
    closed_at: toDate(row.closed_at),
    remaining_quantity: row.remaining_quantity ?? null,
    sold_quantity: values?.sold_quantity ?? null,
    sell_through: values?.sell_through_percentage ?? null,
    effective_revenue: values?.effective_revenue ?? null,
    effective_margin: values?.effective_contribution_margin ?? null,
    remaining_value: values?.remaining_inventory_value ?? null,
    duration: formatDuration(values?.action_duration_ms ?? null),
    learning: row.learning ?? "",
    created_at: toDate(row.created_at),
    updated_at: toDate(row.updated_at),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const CATCH_COLUMNS: Column[] = [
  { header: "Catch-Nummer", key: "catch_number", width: 16 },
  { header: "Status", key: "status", width: 14 },
  { header: "Produkt", key: "product_name", width: 28 },
  { header: "Frisch/TK", key: "temperature", width: 12 },
  { header: "Kategorie", key: "category", width: 16 },
  { header: "Beschreibung", key: "description", width: 34 },
  { header: "Verpackung", key: "packaging", width: 18 },
  { header: "MHD", key: "expiry_date", width: 12, numFmt: DATE },
  { header: "Lieferant", key: "supplier", width: 20 },
  { header: "Kaufmenge", key: "purchase_quantity", width: 12, numFmt: "#,##0.00" },
  { header: "Einheit", key: "quantity_unit", width: 10 },
  { header: "Einkaufspreis", key: "purchase_price", width: 14, numFmt: CHF },
  { header: "Lieferkosten", key: "delivery_cost", width: 14, numFmt: CHF },
  { header: "Normalpreis", key: "regular_price", width: 14, numFmt: CHF },
  { header: "Catch-Preis", key: "catch_price", width: 14, numFmt: CHF },
  { header: "Standorte", key: "locations", width: 26 },
  { header: "Verfügbar ab", key: "available_from", width: 18, numFmt: DATETIME },
  { header: "Verfügbar bis", key: "available_until", width: 18, numFmt: DATETIME },
  { header: "Handicap-Story", key: "handicap_story", width: 40 },
  { header: "Publiziert am", key: "published_at", width: 18, numFmt: DATETIME },
  { header: "Abgeschlossen am", key: "closed_at", width: 18, numFmt: DATETIME },
  { header: "Restmenge", key: "remaining_quantity", width: 12, numFmt: "#,##0.00" },
  { header: "Verkaufte Menge", key: "sold_quantity", width: 14, numFmt: "#,##0.00" },
  { header: "Abverkauf", key: "sell_through", width: 12, numFmt: PERCENT },
  { header: "Effektiver Umsatz", key: "effective_revenue", width: 16, numFmt: CHF },
  { header: "Effektiver DB", key: "effective_margin", width: 16, numFmt: CHF },
  { header: "Restwarenwert", key: "remaining_value", width: 16, numFmt: CHF },
  { header: "Aktionsdauer", key: "duration", width: 14 },
  { header: "Learning", key: "learning", width: 40 },
  { header: "Erstellt am", key: "created_at", width: 18, numFmt: DATETIME },
  { header: "Aktualisiert am", key: "updated_at", width: 18, numFmt: DATETIME },
];

/** Erstellt die Arbeitsmappe im Browser; gibt Blob und Dateinamen zurück. */
export async function buildExportWorkbook(
  onProgress?: (label: string) => void,
): Promise<{ blob: Blob; fileName: string }> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kundi Catch Cockpit";
  workbook.created = new Date();

  function addSheet(name: string, columns: Column[], rows: Record<string, unknown>[]) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
      style: column.numFmt ? { numFmt: column.numFmt } : {},
    }));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }

  onProgress?.("Catches werden gelesen …");
  const catches = (await loadCatchRows()).map(catchRow);
  addSheet("Catches", CATCH_COLUMNS, catches);

  onProgress?.("Stammdaten werden gelesen …");
  const [suppliers, locations, categories] = await Promise.all([
    fetchAllSuppliers(),
    fetchAllLocations(),
    fetchCategories(),
  ]);

  addSheet(
    "Lieferanten",
    [
      { header: "Name", key: "name", width: 26 },
      { header: "Kontaktnotiz", key: "contact_note", width: 40 },
      { header: "Aktiv", key: "active", width: 10 },
      { header: "Erstellt am", key: "created_at", width: 18, numFmt: DATETIME },
    ],
    suppliers.map((supplier) => ({
      name: supplier.name,
      contact_note: supplier.contact_note ?? "",
      active: supplier.is_active ? "Ja" : "Nein",
      created_at: toDate(supplier.created_at),
    })),
  );

  addSheet(
    "Standorte",
    [
      { header: "Name", key: "name", width: 26 },
      { header: "Adresse", key: "address", width: 34 },
      { header: "Abholhinweis", key: "pickup_note", width: 34 },
      { header: "Aktiv", key: "active", width: 10 },
      { header: "Erstellt am", key: "created_at", width: 18, numFmt: DATETIME },
    ],
    locations.map((location) => ({
      name: location.name,
      address: location.address ?? "",
      pickup_note: location.pickup_note ?? "",
      active: location.is_active ? "Ja" : "Nein",
      created_at: toDate(location.created_at),
    })),
  );

  addSheet(
    "Kategorien",
    [
      { header: "Name", key: "name", width: 26 },
      { header: "Aktiv", key: "active", width: 10 },
      { header: "Erstellt am", key: "created_at", width: 18, numFmt: DATETIME },
    ],
    categories.map((category) => ({
      name: category.name,
      active: category.is_active ? "Ja" : "Nein",
      created_at: toDate(category.created_at),
    })),
  );

  onProgress?.("Nutzer und Protokoll werden gelesen …");
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, name, email, active, created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  const roleMap = new Map((roles ?? []).map((row) => [row.user_id, row.role as AppRole]));
  addSheet(
    "Nutzer",
    [
      { header: "Name", key: "name", width: 24 },
      { header: "E-Mail", key: "email", width: 30 },
      { header: "Rolle", key: "role", width: 12 },
      { header: "Aktiv", key: "active", width: 10 },
      { header: "Erstellt am", key: "created_at", width: 18, numFmt: DATETIME },
    ],
    (profiles ?? []).map((profile) => ({
      name: profile.name ?? "",
      email: profile.email ?? "",
      role: ROLE_LABELS[roleMap.get(profile.id) ?? "viewer"],
      active: profile.active ? "Ja" : "Nein",
      created_at: toDate(profile.created_at),
    })),
  );

  const events = await fetchAuditEvents();
  addSheet(
    "Audit Log",
    [
      { header: "Zeitpunkt", key: "created_at", width: 18, numFmt: DATETIME },
      { header: "Person", key: "actor", width: 24 },
      { header: "Ereignis", key: "action", width: 24 },
      { header: "Bereich", key: "entity", width: 20 },
      { header: "Grund", key: "reason", width: 30 },
      { header: "Zusammenfassung", key: "summary", width: 50 },
    ],
    events.map((event) => ({
      created_at: toDate(event.created_at),
      actor: event.actor_name,
      action: AUDIT_ACTION_LABELS[event.action] ?? event.action,
      entity: AUDIT_ENTITY_LABELS[event.entity_type] ?? event.entity_type,
      reason: event.reason ?? "",
      summary: auditSummary(event),
    })),
  );

  onProgress?.("Datei wird erstellt …");
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { blob, fileName: exportFileName() };
}

/** Berechnung für den Vergleich in Tests: geplante Werte pro Catch. */
export function plannedValues(input: Parameters<typeof calculateCatch>[0]) {
  return calculateCatch(input);
}
