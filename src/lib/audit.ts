/**
 * Änderungsprotokoll: Schreiben und Lesen von Audit-Ereignissen.
 * Es werden ausschliesslich fachliche Werte gespeichert — keine Passwörter oder Tokens.
 */

import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "created"
  | "updated"
  | "status_changed"
  | "published"
  | "deleted"
  | "closed"
  | "reconciliation_changed"
  | "reopened"
  | "cancelled"
  | "calculation_decision"
  | "critical_calculation_confirmed"
  | "user_created"
  | "user_updated"
  | "role_changed"
  | "user_activated"
  | "user_deactivated"
  | "password_reset_sent"
  | "user_deleted"
  | "initial_password_set"
  | "supplier_created"
  | "supplier_updated"
  | "location_created"
  | "location_updated"
  | "category_created"
  | "category_updated"
  | "thresholds_updated"
  | "template_updated"
  | "logo_replaced"
  | "settings_reset"
  | "export_created"
  | "backup_sent"
  | "instagram_selected"
  | "instagram_approved"
  | "instagram_published"
  | "instagram_failed"
  | "instagram_retried"
  | "instagram_settings_updated"
  | "offer_received"
  | "offer_extracted"
  | "offer_extraction_failed"
  | "offer_edited"
  | "offer_converted"
  | "offer_ignored"
  | "offer_reopened"
  | "offer_image_selected";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: "Erstellt",
  updated: "Geändert",
  status_changed: "Status geändert",
  export_created: "Export erstellt",
  backup_sent: "Backup übermittelt",
  published: "Publiziert",
  deleted: "Gelöscht",
  closed: "Abgeschlossen",
  reconciliation_changed: "Nachkalkulation geändert",
  reopened: "Wieder geöffnet",
  cancelled: "Abgebrochen",
  calculation_decision: "Kalkulationsentscheid",
  critical_calculation_confirmed: "Kritischer Catch freigegeben",
  user_created: "Nutzer erstellt",
  user_updated: "Nutzer geändert",
  role_changed: "Rolle geändert",
  user_activated: "Nutzer aktiviert",
  user_deactivated: "Nutzer deaktiviert",
  password_reset_sent: "Passwort-Reset gesendet",
  user_deleted: "Nutzer gelöscht",
  initial_password_set: "Startpasswort gesetzt",

  supplier_created: "Lieferant erstellt",
  supplier_updated: "Lieferant geändert",
  location_created: "Standort erstellt",
  location_updated: "Standort geändert",
  category_created: "Kategorie erstellt",
  category_updated: "Kategorie geändert",
  thresholds_updated: "Kalkulationsregeln geändert",
  template_updated: "WhatsApp-Vorlage geändert",
  logo_replaced: "Logo ersetzt",
  settings_reset: "Auf Standardwerte zurückgesetzt",
  instagram_selected: "Für Instagram ausgewählt",
  instagram_approved: "Instagram freigegeben",
  instagram_published: "Auf Instagram veröffentlicht",
  instagram_failed: "Instagram fehlgeschlagen",
  instagram_retried: "Instagram erneut versucht",
  instagram_settings_updated: "Instagram-Einstellungen geändert",
  offer_received: "Angebot empfangen",
  offer_extracted: "Angebot ausgewertet",
  offer_extraction_failed: "Auswertung fehlgeschlagen",
  offer_edited: "Angebot bearbeitet",
  offer_converted: "Als Catch übernommen",
  offer_ignored: "Angebot abgelegt",
  offer_reopened: "Angebot wieder geöffnet",
  offer_image_selected: "Angebotsbild gewählt",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  catch: "Catch",
  user: "Nutzer und Rollen",
  supplier: "Lieferanten",
  location: "Standorte",
  category: "Produktkategorien",
  settings: "Einstellungen",
  supplier_offer: "Angebotseingang",
};

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  reason: string | null;
  payload: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface AuditFilters {
  from?: string;
  to?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
}

/** Schreibt ein Audit-Ereignis; Fehler werden bewusst nicht an die UI weitergereicht. */
export async function recordAudit(args: {
  entityType: string;
  entityId: string;
  action: AuditAction;
  previous?: Record<string, unknown> | null;
  next?: Record<string, unknown> | null;
  reason?: string | null;
  summary?: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (args.previous !== undefined) payload["previous"] = args.previous;
  if (args.next !== undefined) payload["next"] = args.next;
  if (args.summary) payload["summary"] = args.summary;
  // Die handelnde Person wird serverseitig aus der Anmeldung gesetzt (Trigger).
  const { error } = await supabase.from("audit_events").insert({
    entity_type: args.entityType,
    entity_id: args.entityId,
    action: args.action,
    reason: args.reason ?? null,
    payload: payload as never,
  });

  if (error) console.error("Audit-Eintrag fehlgeschlagen", error);
}

export async function fetchAuditEvents(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  let query = supabase
    .from("audit_events")
    .select("id, entity_type, entity_id, action, reason, payload, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  const { data, error } = await query;
  if (error) throw error;

  const actorIds = [
    ...new Set((data ?? []).map((row) => row.actor_id).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", actorIds);
    for (const profile of profiles ?? []) {
      names.set(profile.id, profile.name ?? profile.email ?? "Unbekannt");
    }
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action: row.action,
    reason: row.reason,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    actor_id: row.actor_id,
    actor_name: row.actor_id ? (names.get(row.actor_id) ?? "Unbekannt") : "System",
    created_at: row.created_at,
  }));
}

/** Kurzbeschreibung eines Ereignisses für die Tabelle. */
export function auditSummary(event: AuditEvent): string {
  const payload = event.payload ?? {};
  if (typeof payload["summary"] === "string") return payload["summary"];
  if (event.reason) return event.reason;
  const next = payload["next"];
  if (next && typeof next === "object") {
    return Object.entries(next as Record<string, unknown>)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ");
  }
  return AUDIT_ACTION_LABELS[event.action] ?? event.action;
}
