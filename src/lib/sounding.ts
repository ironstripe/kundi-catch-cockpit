/**
 * Musterprüfung und internes Sounding.
 *
 * Reine Regeln (Steckbrief, Teams-Nachricht, Abschluss- und Freigabebedingungen)
 * sind vollständig testbar und werden von Formular, Detailseite und Review-Seite
 * geteilt. Verbindlich bleiben die Datenbankregeln: Personen und Zeitstempel
 * werden serverseitig bestimmt.
 */

import { supabase } from "@/integrations/supabase/client";
import type { CalculationResult } from "@/lib/catch-calculation";
import type { CatchDetail } from "@/lib/catches";
import { formatCurrency, formatDate, formatPercentValue, formatQuantity } from "@/lib/format";

/* ------------------------------------------------------------------ Typen */

export type SampleCheckStatus = "pending" | "passed" | "failed";

export const SAMPLE_CHECK_LABELS: Record<SampleCheckStatus, string> = {
  pending: "Ausstehend",
  passed: "Bestanden",
  failed: "Nicht bestanden",
};

export type ReviewRoundStatus =
  "requested" | "feedback_received" | "completed" | "outdated" | "cancelled";

export const REVIEW_ROUND_STATUS_LABELS: Record<ReviewRoundStatus, string> = {
  requested: "Angefragt",
  feedback_received: "Rückmeldung erhalten",
  completed: "Abgeschlossen",
  outdated: "Überholt",
  cancelled: "Abgebrochen",
};

export type ReviewDecision = "approved" | "question" | "stop";

export const REVIEW_DECISIONS: ReviewDecision[] = ["approved", "question", "stop"];

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  approved: "Passt für mich",
  question: "Rückfrage",
  stop: "Stopp – so nicht umsetzen",
};

export interface ReviewResponse {
  id: string;
  review_round_id: string;
  user_id: string;
  user_name: string | null;
  decision: ReviewDecision;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewRecipient {
  user_id: string;
  user_name: string | null;
}

export interface ReviewRound {
  id: string;
  catch_id: string;
  round_number: number;
  status: ReviewRoundStatus;
  snapshot: SoundingSnapshot | null;
  requested_at: string;
  requested_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  outdated_at: string | null;
  recipients: ReviewRecipient[];
  responses: ReviewResponse[];
}

/** Unveränderlicher Steckbrief der geprüften Werte. */
export interface SoundingSnapshot {
  catch_number: string | null;
  product_name: string;
  article_number: string | null;
  supplier_name: string | null;
  /** Interner Bildverweis — nie eine dauerhaft öffentliche Adresse. */
  image_path: string | null;
  purchase_quantity: number;
  quantity_unit: string;
  purchase_price_basis: string;
  net_purchase_price_per_unit: number | null;
  net_delivery_cost: number | null;
  net_investment: number | null;
  gross_catch_price: number | null;
  sales_vat_rate: number | null;
  gross_regular_price: number | null;
  discount_percentage: number | null;
  maximum_gross_revenue: number | null;
  maximum_net_revenue: number | null;
  maximum_contribution_margin: number | null;
  gross_margin_percentage: number | null;
  break_even_sell_through: number | null;
  available_from: string | null;
  available_until: string | null;
  location_names: string[];
  handicap_story: string | null;
  sample_check_status: SampleCheckStatus;
  sample_checked_by_name: string | null;
  sample_checked_at: string | null;
  sample_check_note: string | null;
  decision_level: string;
  decision_label: string;
}

/* ------------------------------------------------------- Steckbrief / Text */

export function buildSoundingSnapshot(
  item: CatchDetail,
  calculation: CalculationResult,
  checkedByName: string | null,
): SoundingSnapshot {
  const values = calculation.values;
  return {
    catch_number: item.catch_number,
    product_name: item.product_name,
    article_number: item.article_number ?? null,
    supplier_name: item.supplier_name ?? null,
    image_path: item.image_path ?? null,
    purchase_quantity: item.purchase_quantity,
    quantity_unit: item.quantity_unit,
    purchase_price_basis: item.purchase_price_includes_vat ? "inkl. MWST" : "exkl. MWST",
    net_purchase_price_per_unit: values?.net_purchase_price_per_unit ?? null,
    net_delivery_cost: values?.net_delivery_cost ?? null,
    net_investment: values?.net_investment ?? null,
    gross_catch_price: item.catch_price,
    sales_vat_rate: values?.vat_rate ?? item.vat_rate,
    gross_regular_price: item.regular_price,
    discount_percentage: values?.discount_percentage ?? null,
    maximum_gross_revenue: values?.maximum_gross_revenue ?? null,
    maximum_net_revenue: values?.maximum_net_revenue ?? null,
    maximum_contribution_margin: values?.maximum_contribution_margin ?? null,
    gross_margin_percentage: values?.gross_margin_percentage ?? null,
    break_even_sell_through: values?.break_even_sell_through ?? null,
    available_from: item.available_from,
    available_until: item.available_until,
    location_names: item.location_names,
    handicap_story: item.handicap_story ?? null,
    sample_check_status: item.sample_check_status,
    sample_checked_by_name: checkedByName,
    sample_checked_at: item.sample_checked_at,
    sample_check_note: item.sample_check_note ?? null,
    decision_level: calculation.level,
    decision_label: calculation.label,
  };
}

const MISSING = "—";

/** Interne Teams-Nachricht — bewusst knapp und ausschliesslich aus dem Steckbrief. */
export function soundingMessage(snapshot: SoundingSnapshot, reviewUrl: string): string {
  const lines = [
    "🐟 FOOD CATCH – Sounding",
    "",
    snapshot.product_name,
    `Menge: ${formatQuantity(snapshot.purchase_quantity, snapshot.quantity_unit)}`,
    "",
    `Einkauf inkl. Lieferung: ${
      snapshot.net_investment === null ? MISSING : formatCurrency(snapshot.net_investment)
    }`,
    `Verkaufspreis: ${
      snapshot.gross_catch_price === null ? MISSING : formatCurrency(snapshot.gross_catch_price)
    } inkl. MWST`,
    `Preisvorteil: ${
      snapshot.discount_percentage === null
        ? MISSING
        : formatPercentValue(snapshot.discount_percentage)
    }`,
    `Maximaler DB: ${
      snapshot.maximum_contribution_margin === null
        ? MISSING
        : formatCurrency(snapshot.maximum_contribution_margin)
    }`,
    `Rohmarge: ${
      snapshot.gross_margin_percentage === null
        ? MISSING
        : formatPercentValue(snapshot.gross_margin_percentage)
    }`,
    `Break-even: ${
      snapshot.break_even_sell_through === null
        ? MISSING
        : formatPercentValue(snapshot.break_even_sell_through)
    }`,
    "",
    `Musterprüfung: ✅ ${SAMPLE_CHECK_LABELS[snapshot.sample_check_status]}`,
    `Geprüft am: ${snapshot.sample_checked_at ? formatDate(snapshot.sample_checked_at) : MISSING}`,
    "",
    "Bitte Feedback im Cockpit erfassen:",
    reviewUrl,
  ];
  if (snapshot.article_number) {
    lines.splice(3, 0, `Artikelnummer: ${snapshot.article_number}`);
  }
  return lines.join("\n");
}

export function reviewUrlFor(catchId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/catches/${catchId}/review`;
}

/* ------------------------------------------------------------- Regelwerk */

/** Grund, weshalb ein Sounding noch nicht starten darf; null = startbar. */
export function soundingStartBlockReason(
  sampleStatus: SampleCheckStatus,
  calculationComplete: boolean,
): string | null {
  if (sampleStatus === "pending") return "Die Musterprüfung ist noch ausstehend.";
  if (sampleStatus === "failed") {
    return "Die Musterprüfung wurde nicht bestanden. Dieser Catch kann nicht freigegeben werden.";
  }
  if (!calculationComplete) {
    return "Die Kalkulation ist noch nicht vollständig.";
  }
  return null;
}

/** Grund, weshalb ein Sounding noch nicht abgeschlossen werden darf; null = möglich. */
export function soundingCompletionBlockReason(
  sampleStatus: SampleCheckStatus,
  round: Pick<ReviewRound, "status" | "responses"> | null,
): string | null {
  if (sampleStatus !== "passed") return "Die Musterprüfung ist nicht bestanden.";
  if (!round) return "Das Sounding wurde noch nicht gestartet.";
  if (round.status === "outdated") {
    return "Der Catch wurde nach dem Sounding verändert und muss erneut geprüft werden.";
  }
  if (round.status === "completed") return null;
  if (round.status === "cancelled") return "Diese Sounding-Runde wurde abgebrochen.";
  if (round.responses.length === 0) return "Es fehlt eine Rückmeldung.";
  if (round.responses.some((response) => response.decision === "stop")) {
    return "Eine Rückmeldung mit «Stopp» ist offen.";
  }
  if (!round.responses.some((response) => response.decision === "approved")) {
    return "Es braucht mindestens eine Zustimmung.";
  }
  return null;
}

/** Grund, weshalb der Catch nicht auf «Bereit» gesetzt werden darf; null = erlaubt. */
export function readyBlockReason(
  sampleStatus: SampleCheckStatus,
  round: Pick<ReviewRound, "status" | "responses"> | null,
): string | null {
  if (sampleStatus === "pending") return "Die Musterprüfung ist noch ausstehend.";
  if (sampleStatus === "failed") return "Die Musterprüfung wurde nicht bestanden.";
  if (!round) return "Das Sounding wurde noch nicht gestartet.";
  if (round.status === "outdated") {
    return "Der Catch wurde nach dem Sounding verändert und muss erneut geprüft werden.";
  }
  if (round.status === "completed") return null;
  if (round.responses.length === 0) return "Es fehlt eine Rückmeldung.";
  return "Das Sounding wurde noch nicht abgeschlossen.";
}

/** Kommentarpflicht: Rückfrage und Stopp brauchen eine Begründung. */
export function responseCommentRequired(decision: ReviewDecision): boolean {
  return decision === "question" || decision === "stop";
}

export function validateResponse(decision: ReviewDecision, comment: string): string | null {
  if (responseCommentRequired(decision) && comment.trim() === "") {
    return "Für «Rückfrage» und «Stopp» ist ein Kommentar erforderlich.";
  }
  if (comment.trim().length > 600) return "Der Kommentar darf höchstens 600 Zeichen haben.";
  return null;
}

/** Prüft den Teams-Gruppenchat-Link; null = in Ordnung. */
export function validateTeamsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Bitte eine vollständige Adresse mit https:// eingeben.";
  }
  if (url.protocol !== "https:") return "Der Link muss mit https:// beginnen.";
  return null;
}

const TEAMS_HOSTS = ["teams.microsoft.com", "teams.live.com", "teams.cloud.microsoft"];

/** Weicher Hinweis, wenn die Adresse nicht wie Microsoft Teams aussieht. */
export function looksLikeTeamsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return TEAMS_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/* --------------------------------------------------------- Datenzugriff */

export interface ActiveCockpitUser {
  id: string;
  name: string;
}

export async function fetchActiveUsers(): Promise<ActiveCockpitUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? row.email ?? "Unbekannt",
  }));
}

/** Alle Sounding-Runden eines Catches, neueste zuerst. */
export async function fetchReviewRounds(catchId: string): Promise<ReviewRound[]> {
  const { data, error } = await supabase
    .from("catch_review_rounds")
    .select(
      `id, catch_id, round_number, status, snapshot, requested_at, requested_by,
       completed_at, completed_by, outdated_at,
       catch_review_recipients ( user_id ),
       catch_review_responses ( id, review_round_id, user_id, decision, comment, created_at, updated_at )`,
    )
    .eq("catch_id", catchId)
    .order("round_number", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const userIds = new Set<string>();
  for (const row of rows) {
    for (const recipient of row.catch_review_recipients ?? []) userIds.add(recipient.user_id);
    for (const response of row.catch_review_responses ?? []) userIds.add(response.user_id);
  }

  const names = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", [...userIds]);
    for (const profile of profiles ?? []) {
      names.set(profile.id, profile.name ?? profile.email ?? "Unbekannt");
    }
  }

  return rows.map((row) => ({
    id: row.id,
    catch_id: row.catch_id,
    round_number: row.round_number,
    status: row.status as ReviewRoundStatus,
    snapshot: (row.snapshot as SoundingSnapshot | null) ?? null,
    requested_at: row.requested_at,
    requested_by: row.requested_by,
    completed_at: row.completed_at,
    completed_by: row.completed_by,
    outdated_at: row.outdated_at,
    recipients: (row.catch_review_recipients ?? []).map((recipient) => ({
      user_id: recipient.user_id,
      user_name: names.get(recipient.user_id) ?? null,
    })),
    responses: (row.catch_review_responses ?? []).map((response) => ({
      id: response.id,
      review_round_id: response.review_round_id,
      user_id: response.user_id,
      user_name: names.get(response.user_id) ?? null,
      decision: response.decision as ReviewDecision,
      comment: response.comment,
      created_at: response.created_at,
      updated_at: response.updated_at,
    })),
  }));
}

/** Aktuelle (höchste) Runde eines Catches. */
export function currentRound(rounds: ReviewRound[]): ReviewRound | null {
  return rounds[0] ?? null;
}

/** Musterprüfung erfassen; Person und Zeitpunkt setzt die Datenbank. */
export async function recordSampleCheck(
  catchId: string,
  status: Exclude<SampleCheckStatus, "pending">,
  note: string,
): Promise<void> {
  const { error } = await supabase
    .from("catches")
    .update({ sample_check_status: status, sample_check_note: note.trim() || null })
    .eq("id", catchId);
  if (error) throw error;
}

/** Startet eine neue Sounding-Runde mit den gewählten Prüfenden. */
export async function startSounding(
  catchId: string,
  snapshot: SoundingSnapshot,
  reviewerIds: string[],
): Promise<string> {
  if (reviewerIds.length === 0) {
    throw new Error("Bitte mindestens eine prüfende Person auswählen.");
  }
  const { data, error } = await supabase
    .from("catch_review_rounds")
    .insert({ catch_id: catchId, snapshot: snapshot as never })
    .select("id")
    .single();
  if (error) throw error;

  const { error: recipientError } = await supabase
    .from("catch_review_recipients")
    .insert(reviewerIds.map((userId) => ({ review_round_id: data.id, user_id: userId })));
  if (recipientError) throw recipientError;

  return data.id;
}

export async function completeSounding(roundId: string): Promise<void> {
  const { error } = await supabase
    .from("catch_review_rounds")
    .update({ status: "completed" })
    .eq("id", roundId);
  if (error) throw error;
}

/** Eigene Rückmeldung erfassen oder aktualisieren. */
export async function submitReviewResponse(
  roundId: string,
  userId: string,
  decision: ReviewDecision,
  comment: string,
  existingId?: string,
): Promise<void> {
  const problem = validateResponse(decision, comment);
  if (problem) throw new Error(problem);
  const payload = { decision, comment: comment.trim() || null };

  if (existingId) {
    const { error } = await supabase
      .from("catch_review_responses")
      .update(payload)
      .eq("id", existingId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("catch_review_responses")
    .insert({ review_round_id: roundId, user_id: userId, ...payload });
  if (error) throw error;
}
