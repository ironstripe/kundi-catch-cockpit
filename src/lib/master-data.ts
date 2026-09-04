/**
 * Stammdatenverwaltung: Lieferanten, Standorte und Produktkategorien.
 * Referenzierte Datensätze werden nie gelöscht, sondern deaktiviert.
 */

import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";

export interface Supplier {
  id: string;
  name: string;
  contact_note: string | null;
  internal_note: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LocationRecord {
  id: string;
  name: string;
  address: string | null;
  pickup_note: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export function normaliseName(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Prüft auf Namensdubletten (Gross-/Kleinschreibung und Leerzeichen normalisiert). */
export function hasDuplicateName(
  name: string,
  existing: { id: string; name: string }[],
  ignoreId?: string,
): boolean {
  const target = normaliseName(name);
  return existing.some((item) => item.id !== ignoreId && normaliseName(item.name) === target);
}

export async function fetchAllSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, contact_note, internal_note, is_active, created_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function fetchAllLocations(): Promise<LocationRecord[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, address, pickup_note, is_active, created_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as LocationRecord[];
}

export async function fetchCategories(): Promise<ProductCategory[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, active, sort_order, created_at")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ProductCategory[];
}

/** Zählt Catches, die den Datensatz referenzieren. */
export async function countSupplierReferences(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("catches")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id);
  if (error) throw error;
  return count ?? 0;
}

export async function countLocationReferences(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("catch_locations")
    .select("id", { count: "exact", head: true })
    .eq("location_id", id);
  if (error) throw error;
  return count ?? 0;
}

export interface SupplierInput {
  name: string;
  contact_note: string | null;
  internal_note: string | null;
  is_active: boolean;
}

export async function saveSupplier(input: SupplierInput, id?: string, previous?: Supplier) {
  if (id) {
    const { error } = await supabase.from("suppliers").update(input).eq("id", id);
    if (error) throw error;
    await recordAudit({
      entityType: "supplier",
      entityId: id,
      action: "supplier_updated",
      previous: previous ? { ...previous } : null,
      next: { ...input },
      summary: `Lieferant «${input.name}» geändert`,
    });
    return id;
  }
  const { data, error } = await supabase.from("suppliers").insert(input).select("id").single();
  if (error) throw error;
  await recordAudit({
    entityType: "supplier",
    entityId: data.id,
    action: "supplier_created",
    next: { ...input },
    summary: `Lieferant «${input.name}» erstellt`,
  });
  return data.id;
}

export interface LocationInput {
  name: string;
  address: string | null;
  pickup_note: string | null;
  is_active: boolean;
}

export async function saveLocation(input: LocationInput, id?: string, previous?: LocationRecord) {
  if (id) {
    const { error } = await supabase.from("locations").update(input).eq("id", id);
    if (error) throw error;
    await recordAudit({
      entityType: "location",
      entityId: id,
      action: "location_updated",
      previous: previous ? { ...previous } : null,
      next: { ...input },
      summary: `Standort «${input.name}» geändert`,
    });
    return id;
  }
  const { data, error } = await supabase.from("locations").insert(input).select("id").single();
  if (error) throw error;
  await recordAudit({
    entityType: "location",
    entityId: data.id,
    action: "location_created",
    next: { ...input },
    summary: `Standort «${input.name}» erstellt`,
  });
  return data.id;
}

export interface CategoryInput {
  name: string;
  active: boolean;
  sort_order: number;
}

export async function saveCategory(input: CategoryInput, id?: string, previous?: ProductCategory) {
  if (id) {
    const { error } = await supabase.from("product_categories").update(input).eq("id", id);
    if (error) throw error;
    await recordAudit({
      entityType: "category",
      entityId: id,
      action: "category_updated",
      previous: previous ? { ...previous } : null,
      next: { ...input },
      summary: `Kategorie «${input.name}» geändert`,
    });
    return id;
  }
  const { data, error } = await supabase
    .from("product_categories")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  await recordAudit({
    entityType: "category",
    entityId: data.id,
    action: "category_created",
    next: { ...input },
    summary: `Kategorie «${input.name}» erstellt`,
  });
  return data.id;
}
