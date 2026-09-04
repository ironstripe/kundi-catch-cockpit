/**
 * Statuswechsel am Ende des Catch-Lebenszyklus:
 * Abschluss, Wiederöffnung und Abbruch — jeweils mit Audit-Eintrag.
 */

import { supabase } from "@/integrations/supabase/client";
import type { CatchDetail } from "@/lib/catches";

export interface ReconciliationSnapshot {
  purchase_quantity: number;
  quantity_unit: string;
  purchase_price: number | null;
  delivery_cost: number;
  catch_price: number | null;
  regular_price: number | null;
  published_at: string | null;
  remaining_quantity: number;
  inventory_counted_at: string;
}

async function actor(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function audit(
  catchId: string,
  action: string,
  payload: Record<string, unknown>,
  actorId: string | null,
) {
  await supabase.from("audit_events").insert({
    entity_type: "catch",
    entity_id: catchId,
    action,
    actor_id: actorId,
    payload: payload as never,
  });
}

export function buildSnapshot(
  item: CatchDetail,
  remainingQuantity: number,
  inventoryCountedAt: string,
): ReconciliationSnapshot {
  return {
    purchase_quantity: item.purchase_quantity,
    quantity_unit: item.quantity_unit,
    purchase_price: item.purchase_price,
    delivery_cost: item.delivery_included ? 0 : item.delivery_cost,
    catch_price: item.catch_price,
    regular_price: item.regular_price,
    published_at: item.published_at,
    remaining_quantity: remainingQuantity,
    inventory_counted_at: inventoryCountedAt,
  };
}

interface CloseArgs {
  item: CatchDetail;
  remainingQuantity: number;
  inventoryCountedAt: string;
  learning: string;
  /** Berechnete Kennzahlen — nur fürs Audit, nicht als Quelle der Wahrheit. */
  result: Record<string, unknown>;
}

/** Fixiert die Nachkalkulation und verschiebt den Catch in die Historie. */
export async function closeCatch({
  item,
  remainingQuantity,
  inventoryCountedAt,
  learning,
  result,
}: CloseArgs): Promise<void> {
  const actorId = await actor();
  const closedAt = new Date().toISOString();
  const snapshot = buildSnapshot(item, remainingQuantity, inventoryCountedAt);

  const previous = {
    status: item.status,
    remaining_quantity: item.remaining_quantity,
    inventory_counted_at: item.inventory_counted_at,
    learning: item.learning,
  };

  const { error } = await supabase
    .from("catches")
    .update({
      status: "closed",
      remaining_quantity: remainingQuantity,
      inventory_counted_at: inventoryCountedAt,
      learning: learning.trim() || null,
      actual_sell_through:
        item.purchase_quantity > 0
          ? ((item.purchase_quantity - remainingQuantity) / item.purchase_quantity) * 100
          : null,
      closed_at: closedAt,
      closed_by: actorId,
      reconciliation_snapshot: snapshot as unknown as never,
    })
    .eq("id", item.id)
    .in("status", ["published", "closed"]);
  if (error) throw error;

  await audit(
    item.id,
    item.status === "closed" ? "reconciliation_changed" : "closed",
    { previous, next: { status: "closed", ...snapshot }, result, closed_at: closedAt },
    actorId,
  );
}

/** Öffnet einen abgeschlossenen Catch mit Begründung wieder. */
export async function reopenCatch(item: CatchDetail, reason: string): Promise<void> {
  const actorId = await actor();
  const reopenedAt = new Date().toISOString();

  const { error } = await supabase
    .from("catches")
    .update({
      status: "published",
      reopened_at: reopenedAt,
      reopened_by: actorId,
      reopen_reason: reason.trim(),
    })
    .eq("id", item.id)
    .eq("status", "closed");
  if (error) throw error;

  await audit(
    item.id,
    "reopened",
    {
      reason: reason.trim(),
      reopened_at: reopenedAt,
      previous: {
        status: "closed",
        remaining_quantity: item.remaining_quantity,
        inventory_counted_at: item.inventory_counted_at,
        learning: item.learning,
        closed_at: item.closed_at,
        reconciliation_snapshot: item.reconciliation_snapshot,
      },
      next: { status: "published" },
    },
    actorId,
  );
}

/** Bricht einen Catch mit Begründung ab. */
export async function cancelCatch(item: CatchDetail, reason: string): Promise<void> {
  const actorId = await actor();
  const cancelledAt = new Date().toISOString();

  const { error } = await supabase
    .from("catches")
    .update({
      status: "cancelled",
      cancelled_at: cancelledAt,
      cancelled_by: actorId,
      cancellation_reason: reason.trim(),
    })
    .eq("id", item.id);
  if (error) throw error;

  await audit(
    item.id,
    "cancelled",
    {
      reason: reason.trim(),
      cancelled_at: cancelledAt,
      previous: { status: item.status },
      next: { status: "cancelled" },
    },
    actorId,
  );
}
