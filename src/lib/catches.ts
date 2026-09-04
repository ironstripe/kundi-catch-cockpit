import { supabase } from "@/integrations/supabase/client";
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
  expected_sell_through: number | null;
  image_path: string | null;
  location_names: string[];
}

export interface CatchDetail extends CatchListItem {
  description: string | null;
  packaging: string | null;
  expiry_date: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_price: number | null;
  delivery_cost: number;
  delivery_included: boolean;
  regular_price: number | null;
  available_until: string | null;
  handicap_reason: string | null;
  handicap_story: string | null;
  internal_note: string | null;
  location_ids: string[];
  created_at: string;
  updated_at: string;
}

const LIST_SELECT = `
  id, catch_number, product_name, temperature, status, available_from,
  purchase_quantity, quantity_unit, catch_price, expected_sell_through,
  catch_images ( storage_path, is_primary, sort_order ),
  catch_locations ( location_id, locations ( id, name ) )
`;

const DETAIL_SELECT = `
  id, catch_number, product_name, temperature, status, description, packaging,
  expiry_date, supplier_id, purchase_quantity, quantity_unit, purchase_price,
  delivery_cost, delivery_included, regular_price, catch_price, available_from,
  available_until, handicap_reason, handicap_story, internal_note,
  expected_sell_through, created_at, updated_at,
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
    expected_sell_through:
      row.expected_sell_through === null ? null : Number(row.expected_sell_through),
    image_path: primaryImagePath(row),
    location_names: (row.catch_locations ?? [])
      .map((cl: any) => cl.locations?.name)
      .filter(Boolean),
  };
}

function mapDetail(row: any): CatchDetail {
  return {
    ...mapList(row),
    description: row.description,
    packaging: row.packaging,
    expiry_date: row.expiry_date,
    supplier_id: row.supplier_id,
    supplier_name: row.suppliers?.name ?? null,
    purchase_price: row.purchase_price === null ? null : Number(row.purchase_price),
    delivery_cost: Number(row.delivery_cost ?? 0),
    delivery_included: Boolean(row.delivery_included),
    regular_price: row.regular_price === null ? null : Number(row.regular_price),
    available_until: row.available_until,
    handicap_reason: row.handicap_reason,
    handicap_story: row.handicap_story,
    internal_note: row.internal_note,
    location_ids: (row.catch_locations ?? []).map((cl: any) => cl.location_id),
    created_at: row.created_at,
    updated_at: row.updated_at,
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

export async function fetchClosedCatches(): Promise<CatchListItem[]> {
  const { data, error } = await supabase
    .from("catches")
    .select(LIST_SELECT)
    .in("status", ["closed", "cancelled"])
    .order("updated_at", { ascending: false })
    .limit(20);
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
    payload: { status },
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
