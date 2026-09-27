export type CatchFormStatus = "draft" | "ready" | "published" | "closed" | "cancelled" | undefined;

/**
 * Status für das gewöhnliche Speichern (Schaltfläche = Ctrl/Cmd+Enter).
 * Neu/Entwurf → draft; bestehend «Bereit» → ready (mit den bestehenden
 * Bereit-Prüfungen und Sperren). «published» bleibt über saveCatch publiziert.
 * Ein Entwurf wird hierdurch nie «Bereit».
 */
export function ordinarySaveStatus(
  mode: "create" | "edit",
  currentStatus: CatchFormStatus,
): "draft" | "ready" {
  if (mode === "create") return "draft";
  return currentStatus === "ready" ? "ready" : "draft";
}

export function ordinarySaveLabel(mode: "create" | "edit", currentStatus: CatchFormStatus): string {
  if (mode === "create" || currentStatus === "draft" || currentStatus === undefined)
    return "Als Entwurf speichern";
  return "Änderungen speichern";
}
