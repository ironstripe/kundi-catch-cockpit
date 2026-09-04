/**
 * Reine Regeln der Benutzerverwaltung.
 * Wird von Server-Funktionen und Oberfläche geteilt und ist vollständig testbar.
 */

export type AppRole = "admin" | "editor" | "viewer";

export const APP_ROLES: AppRole[] = ["admin", "editor", "viewer"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Voller Zugriff inklusive Nutzerverwaltung, Einstellungen, Wiederöffnen und Abbrechen.",
  editor: "Catches erfassen, bearbeiten, publizieren und abschliessen.",
  viewer: "Nur lesender Zugriff auf Catches, Historie, Kalkulationen und Bilder.",
};

export const MIN_PASSWORD_LENGTH = 8;

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as string[]).includes(value);
}

export function assertRole(value: unknown): AppRole {
  if (!isAppRole(value)) throw new Error("Ungültige Rolle.");
  return value;
}

export function normalizeEmail(value: unknown): string {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  }
  return email;
}

export function assertPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
  }
  if (value.length > 72) throw new Error("Das Passwort darf höchstens 72 Zeichen lang haben.");
  return value;
}

/** Berechtigungen je Rolle — Grundlage der Oberfläche, verbindlich bleibt die Datenbank. */
export interface RolePermissions {
  /** Catches erfassen und bearbeiten, Bilder hochladen. */
  canEdit: boolean;
  /** Catch publizieren und abschliessen. */
  canPublish: boolean;
  canClose: boolean;
  /** Wiederöffnen und Abbrechen — nur Administratoren. */
  canReopen: boolean;
  canCancel: boolean;
  /** Nutzerverwaltung und Systemeinstellungen. */
  canAdminister: boolean;
}

export function permissionsFor(role: AppRole, active: boolean): RolePermissions {
  const editor = active && (role === "admin" || role === "editor");
  const admin = active && role === "admin";
  return {
    canEdit: editor,
    canPublish: editor,
    canClose: editor,
    canReopen: admin,
    canCancel: admin,
    canAdminister: admin,
  };
}

/** Höchste Rolle aus mehreren Zuweisungen (Admin schlägt Editor schlägt Viewer). */
export function highestRole(roles: readonly string[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("editor")) return "editor";
  return "viewer";
}

export interface AdminGuardInput {
  /** Angemeldete Person. */
  actorId: string;
  targetId: string;
  targetIsAdmin: boolean;
  targetIsActive: boolean;
  /** Rolle nach der Änderung; `undefined` bedeutet unverändert. */
  nextRole?: AppRole | undefined;
  /** Aktiv-Status nach der Änderung; `undefined` bedeutet unverändert. */
  nextActive?: boolean | undefined;
  /** Anzahl aktiver Administratoren ohne die Zielperson. */
  otherActiveAdmins: number;
  /** Löschvorgang statt Änderung. */
  deleting?: boolean;
}

/**
 * Prüft, ob eine Änderung an einem Konto erlaubt ist.
 * Wirft eine Ausnahme mit einer verständlichen deutschen Meldung.
 */
export function assertAdminChangeAllowed(input: AdminGuardInput): void {
  const losesAdmin =
    input.targetIsAdmin &&
    (Boolean(input.deleting) ||
      (input.nextRole !== undefined && input.nextRole !== "admin") ||
      input.nextActive === false ||
      (!input.targetIsActive && input.nextActive !== true && Boolean(input.deleting)));

  const isSelf = input.actorId === input.targetId;

  if (isSelf && input.deleting) {
    throw new Error("Du kannst dein eigenes Konto nicht löschen.");
  }
  if (isSelf && losesAdmin) {
    throw new Error(
      "Du kannst dein eigenes Administratorkonto nicht deaktivieren oder herabstufen.",
    );
  }
  if (losesAdmin && input.targetIsActive && input.otherActiveAdmins === 0) {
    throw new Error(
      "Der letzte aktive Administrator kann nicht deaktiviert, herabgestuft oder gelöscht werden.",
    );
  }
}
