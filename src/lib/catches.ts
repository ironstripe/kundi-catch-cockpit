import { supabase } from "@/integrations/supabase/client";
import { parseNumberInput, type CalculationInput } from "@/lib/catch-calculation";
import type { ReconciliationInput } from "@/lib/catch-reconciliation";
import { ACTIVE_STATUSES, type CatchStatus, type Temperature } from "@/lib/catch-domain";
import { zurichLocalToIso } from "@/lib/format";

export const CATCH_IMAGE_BUCKET = "catch-images";

export interface CatchFormValues {
  product_name: string;
  temperature: Temperature;
  description: string;
  packaging: string;
  expiry_date: string;
  supplier_id: string;
  purchase_quantity: string;
  quantity_unit: string;
  purchase_price: string;
  delivery_cost: string;
  delivery_included: boolean;
  regular_price: string;
  catch_price: string;
  location_ids: string[];
  available_from: string;
  available_until: string;
  handicap_reason: string;
  handicap_story: string;
  internal_note: string;
}

export const EMPTY_CATCH_FORM: CatchFormValues = {
  product_name: "",
  temperature: "fresh",
  description: "",
  packaging: "",
  expiry_date: "",
  supplier_id: "",
  purchase_quantity: "",
  quantity_unit: "kg",
  purchase_price: "",
  delivery_cost: "0.00",
  delivery_included: false,
  regular_price: "",
  catch_price: "",
  location_ids: [],
  available_from: "",
  available_until: "",
  handicap_reason: "",
  handicap_story: "",
  internal_note: "",
};

export interface CatchListItem {
  id: string;
  catch_number: string | null;
  product_name: string;
  temperature: Temperature;
  status: CatchStatus;
  available_from: string | null;
  purchase_quantity: number;
  quantity_unit: string;
  catch_price: number | null;
  purchase_price: number | null;
  delivery_cost: number;
  delivery_included: boolean;
  regular_price: number | null;
  updated_at: string;
  expected_sell_through: number | null;
  image_path: string | null;
  location_names: string[];
  location_ids: string[];
  supplier_id: string | null;
  supplier_name: string | null;
  published_at: string | null;
  remaining_quantity: number | null;
  inventory_counted_at: string | null;
  learning: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface CatchDetail extends CatchListItem {
  description: string | null;
  packaging: string | null;
  expiry_date: string | null;
  available_until: string | null;
  handicap_reason: string | null;
  handicap_story: string | null;
  internal_note: string | null;
  created_at: string;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  cancelled_by: string | null;
  reconciliation_snapshot: Record<string, unknown> | null;
  published_by: string | null;
  published_text: string | null;
  published_image_path: string | null;
  post_generated_text: string | null;
  post_final_text: string | null;
  post_generated_at: string | null;
  post_source_signature: string | null;
  post_outdated_decision: string | null;
}

const LIST_SELECT = `
  id, catch_number, product_name, temperature, status, available_from,
  purchase_quantity, quantity_unit, catch_price, expected_sell_through,
  purchase_price, delivery_cost, delivery_included, regular_price, updated_at, published_at,
  supplier_id, remaining_quantity, inventory_counted_at, learning,
  closed_at, cancelled_at, cancellation_reason,
  suppliers ( id, name ),
  catch_images ( storage_path, is_primary, sort_order ),
  catch_locations ( location_id, locations ( id, name ) )
`;

const DETAIL_SELECT = `
  id, catch_number, product_name, temperature, status, description, packaging,
  expiry_date, supplier_id, purchase_quantity, quantity_unit, purchase_price,
  delivery_cost, delivery_included, regular_price, catch_price, available_from,
  available_until, handicap_reason, handicap_story, internal_note,
  expected_sell_through, created_at, updated_at,
  published_at, published_by, published_text, published_image_path,
  post_generated_text, post_final_text, post_generated_at,
  post_source_signature, post_outdated_decision,
  remaining_quantity, inventory_counted_at, learning,
  closed_at, closed_by, reopened_at, reopened_by, reopen_reason,
  cancelled_at, cancelled_by, cancellation_reason,
  reconciliation_snapshot,
  suppliers ( id, name ),
  catch_images ( storage_path, is_primary, sort_order ),
  catch_locations ( location_id, locations ( id, name ) )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function primaryImagePath(row: any): string | null {
  const images = (row.catch_images ?? []) as {
    storage_path: string;
    is_primary: boolean;
    sort_order: number;
  }[];
  if (images.length === 0) return null;
  const sorted = [...images].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return sorted[0]?.storage_path ?? null;
}

function mapList(row: any): CatchListItem {
  return {
    id: row.id,
    catch_number: row.catch_number,
    product_name: row.product_name,
    temperature: row.temperature as Temperature,
    status: row.status as CatchStatus,
    available_from: row.available_from,
    purchase_quantity: Number(row.purchase_quantity ?? 0),
    quantity_unit: row.quantity_unit,
    catch_price: row.catch_price === null ? null : Number(row.catch_price),
    purchase_price: row.purchase_price === null ? null : Number(row.purchase_price),
    delivery_cost: Number(row.delivery_cost ?? 0),
    delivery_included: Boolean(row.delivery_included),
    regular_price: row.regular_price === null ? null : Number(row.regular_price),
    updated_at: row.updated_at,
    expected_sell_through:
      row.expected_sell_through === null ? null : Number(row.expected_sell_through),
    published_at: row.published_at ?? null,
    supplier_id: row.supplier_id ?? null,
    supplier_name: row.suppliers?.name ?? null,
    remaining_quantity:
      row.remaining_quantity === null || row.remaining_quantity === undefined
        ? null
        : Number(row.remaining_quantity),
    inventory_counted_at: row.inventory_counted_at ?? null,
    learning: row.learning ?? null,
    closed_at: row.closed_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    cancellation_reason: row.cancellation_reason ?? null,
    image_path: primaryImagePath(row),
    location_names: (row.catch_locations ?? [])
      .map((cl: any) => cl.locations?.name)
      .filter(Boolean),
    location_ids: (row.catch_locations ?? []).map((cl: any) => cl.location_id),
  };
}

function mapDetail(row: any): CatchDetail {
  return {
    ...mapList(row),
    description: row.description,
    packaging: row.packaging,
    expiry_date: row.expiry_date,
    available_until: row.available_until,
    handicap_reason: row.handicap_reason,
    handicap_story: row.handicap_story,
    internal_note: row.internal_note,
    created_at: row.created_at,
    closed_by: row.closed_by ?? null,
    reopened_at: row.reopened_at ?? null,
    reopened_by: row.reopened_by ?? null,
    reopen_reason: row.reopen_reason ?? null,
    cancelled_by: row.cancelled_by ?? null,
    reconciliation_snapshot: row.reconciliation_snapshot ?? null,
    published_by: row.published_by ?? null,
    published_text: row.published_text ?? null,
    published_image_path: row.published_image_path ?? null,
    post_generated_text: row.post_generated_text ?? null,
    post_final_text: row.post_final_text ?? null,
    post_generated_at: row.post_generated_at ?? null,
    post_source_signature: row.post_source_signature ?? null,
    post_outdated_decision: row.post_outdated_decision ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchRunningCatches(): Promise<CatchListItem[]> {
  const { data, error } = await supabase
    .from("catches")
    .select(LIST_SELECT)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapList);
}

export async function fetchClosedCatches(limit = 20): Promise<CatchListItem[]> {
  const { data, error } = await supabase
    .from("catches")
    .select(LIST_SELECT)
    .in("status", ["closed", "cancelled"])
    .order("closed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapList);
}

/** Vollständige Historie (abgeschlossen und abgebrochen) für Suche und Filter. */
export async function fetchHistoryCatches(): Promise<CatchListItem[]> {
  const { data, error } = await supabase
    .from("catches")
    .select(LIST_SELECT)
    .in("status", ["closed", "cancelled"])
    .order("closed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapList);
}

export async function fetchCatch(id: string): Promise<CatchDetail | null> {
  const { data, error } = await supabase
    .from("catches")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDetail(data) : null;
}

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchLocations() {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export function catchDetailToForm(detail: CatchDetail): CatchFormValues {
  const toText = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);
  return {
    product_name: detail.product_name ?? "",
    temperature: detail.temperature,
    description: detail.description ?? "",
    packaging: detail.packaging ?? "",
    expiry_date: detail.expiry_date ?? "",
    supplier_id: detail.supplier_id ?? "",
    purchase_quantity: detail.purchase_quantity ? String(detail.purchase_quantity) : "",
    quantity_unit: detail.quantity_unit ?? "kg",
    purchase_price: toText(detail.purchase_price),
    delivery_cost: detail.delivery_cost.toFixed(2),
    delivery_included: detail.delivery_included,
    regular_price: toText(detail.regular_price),
    catch_price: toText(detail.catch_price),
    location_ids: detail.location_ids,
    available_from: detail.available_from ?? "",
    available_until: detail.available_until ?? "",
    handicap_reason: detail.handicap_reason ?? "",
    handicap_story: detail.handicap_story ?? "",
    internal_note: detail.internal_note ?? "",
  };
}

function num(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface SaveArgs {
  id?: string | undefined;
  values: CatchFormValues;
  status: CatchStatus;
  /** Zusatzangaben fürs Audit-Log, z. B. bestätigte kritische Kalkulation. */
  audit?: Record<string, unknown> | undefined;
}

/** Legt einen Catch an oder aktualisiert ihn inkl. Standortzuordnung. */
export async function saveCatch({ id, values, status, audit }: SaveArgs): Promise<string> {

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const payload = {
    product_name: values.product_name.trim(),
    temperature: values.temperature,
    description: values.description.trim() || null,
    packaging: values.packaging.trim() || null,
    expiry_date: values.expiry_date || null,
    supplier_id: values.supplier_id || null,
    purchase_quantity: num(values.purchase_quantity) ?? 0,
    quantity_unit: values.quantity_unit,
    purchase_price: num(values.purchase_price),
    delivery_cost: values.delivery_included ? 0 : (num(values.delivery_cost) ?? 0),
    delivery_included: values.delivery_included,
    regular_price: num(values.regular_price),
    catch_price: num(values.catch_price),
    available_from: values.available_from ? zurichLocalToIso(values.available_from) : null,
    available_until: values.available_until ? zurichLocalToIso(values.available_until) : null,
    handicap_reason: values.handicap_reason || null,
    handicap_story: values.handicap_story.trim() || null,
    internal_note: values.internal_note.trim() || null,
    status,
  };

  let catchId = id;

  if (catchId) {
    const { error } = await supabase.from("catches").update(payload).eq("id", catchId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("catches")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    catchId = data.id;
  }

  await syncLocations(catchId, values.location_ids);

  await supabase.from("audit_events").insert({
    entity_type: "catch",
    entity_id: catchId,
    action: id ? "updated" : "created",
    actor_id: userId,
    payload: { status, ...(audit ?? {}) },
  });

  return catchId;
}

async function syncLocations(catchId: string, locationIds: string[]) {
  const { data: existing, error } = await supabase
    .from("catch_locations")
    .select("id, location_id")
    .eq("catch_id", catchId);
  if (error) throw error;

  const current = existing ?? [];
  const toRemove = current.filter((row) => !locationIds.includes(row.location_id));
  const toAdd = locationIds.filter((locId) => !current.some((row) => row.location_id === locId));

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("catch_locations")
      .delete()
      .in(
        "id",
        toRemove.map((row) => row.id),
      );
    if (deleteError) throw deleteError;
  }
  if (toAdd.length > 0) {
    const { error: insertError } = await supabase
      .from("catch_locations")
      .insert(toAdd.map((locationId) => ({ catch_id: catchId, location_id: locationId })));
    if (insertError) throw insertError;
  }
}

/** Signierte URL für ein privat gespeichertes Produktbild. */
export async function createSignedImageUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(CATCH_IMAGE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Gespeicherter Catch -> Eingabewerte der Nachkalkulation. */
export function catchToReconciliationInput(item: CatchListItem): ReconciliationInput {
  return {
    ...catchToCalculationInput(item),
    remaining_quantity: item.remaining_quantity,
    published_at: item.published_at,
    inventory_counted_at: item.inventory_counted_at,
  };
}

/** Gespeicherter Catch -> Eingabewerte der Vorkalkulation. */
export function catchToCalculationInput(item: CatchListItem): CalculationInput {
  return {
    purchase_quantity: item.purchase_quantity || null,
    quantity_unit: item.quantity_unit,
    purchase_price: item.purchase_price,
    delivery_cost: item.delivery_included ? 0 : item.delivery_cost,
    regular_price: item.regular_price,
    catch_price: item.catch_price,
  };
}

/** Formularwerte -> Eingabewerte der Vorkalkulation (Live-Vorschau). */
export function formValuesToCalculationInput(values: CatchFormValues): CalculationInput {
  return {
    purchase_quantity: parseNumberInput(values.purchase_quantity),
    quantity_unit: values.quantity_unit,
    purchase_price: parseNumberInput(values.purchase_price),
    delivery_cost: values.delivery_included ? 0 : parseNumberInput(values.delivery_cost),
    regular_price: parseNumberInput(values.regular_price),
    catch_price: parseNumberInput(values.catch_price),
  };
}
