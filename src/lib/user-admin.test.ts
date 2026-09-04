import { describe, expect, it } from "vitest";

import {
  assertAdminChangeAllowed,
  assertPassword,
  assertRole,
  highestRole,
  normalizeEmail,
  permissionsFor,
} from "@/lib/user-admin";

describe("Rollen und Berechtigungen", () => {
  it("wählt die höchste Rolle", () => {
    expect(highestRole(["viewer", "admin", "editor"])).toBe("admin");
    expect(highestRole(["viewer", "editor"])).toBe("editor");
    expect(highestRole([])).toBe("viewer");
  });

  it("erlaubt Wiederöffnen und Abbrechen nur Administratoren", () => {
    expect(permissionsFor("admin", true).canReopen).toBe(true);
    expect(permissionsFor("editor", true).canReopen).toBe(false);
    expect(permissionsFor("editor", true).canCancel).toBe(false);
    expect(permissionsFor("editor", true).canClose).toBe(true);
    expect(permissionsFor("viewer", true).canEdit).toBe(false);
  });

  it("entzieht deaktivierten Konten alle Rechte", () => {
    const permissions = permissionsFor("admin", false);
    expect(Object.values(permissions).every((value) => value === false)).toBe(true);
  });

  it("prüft Rollen und E-Mail-Adressen", () => {
    expect(assertRole("editor")).toBe("editor");
    expect(() => assertRole("superuser")).toThrow();
    expect(normalizeEmail("  Anna@Kundelfingerhof.CH ")).toBe("anna@kundelfingerhof.ch");
    expect(() => normalizeEmail("keine-mail")).toThrow();
  });

  it("verlangt ausreichend lange Startpasswörter", () => {
    expect(assertPassword("Fischsuppe2026")).toBe("Fischsuppe2026");
    expect(() => assertPassword("kurz")).toThrow();
  });
});

describe("Schutz des letzten Administrators", () => {
  const base = {
    actorId: "admin-1",
    targetId: "admin-2",
    targetIsAdmin: true,
    targetIsActive: true,
    otherActiveAdmins: 1,
  };

  it("lässt Änderungen zu, solange ein weiterer Admin aktiv ist", () => {
    expect(() => assertAdminChangeAllowed({ ...base, nextRole: "editor" })).not.toThrow();
    expect(() => assertAdminChangeAllowed({ ...base, deleting: true })).not.toThrow();
  });

  it("verhindert das Herabstufen des letzten aktiven Administrators", () => {
    expect(() =>
      assertAdminChangeAllowed({ ...base, otherActiveAdmins: 0, nextRole: "viewer" }),
    ).toThrow(/letzte aktive Administrator/);
  });

  it("verhindert das Deaktivieren und Löschen des letzten Administrators", () => {
    expect(() =>
      assertAdminChangeAllowed({ ...base, otherActiveAdmins: 0, nextActive: false }),
    ).toThrow(/letzte aktive Administrator/);
    expect(() =>
      assertAdminChangeAllowed({ ...base, otherActiveAdmins: 0, deleting: true }),
    ).toThrow(/letzte aktive Administrator/);
  });

  it("verhindert Selbstherabstufung und Selbstlöschung", () => {
    expect(() =>
      assertAdminChangeAllowed({ ...base, targetId: "admin-1", nextRole: "editor" }),
    ).toThrow(/eigenes Administratorkonto/);
    expect(() =>
      assertAdminChangeAllowed({ ...base, targetId: "admin-1", deleting: true }),
    ).toThrow(/eigenes Konto/);
  });

  it("lässt das Löschen eines Nicht-Admins immer zu", () => {
    expect(() =>
      assertAdminChangeAllowed({
        ...base,
        targetIsAdmin: false,
        otherActiveAdmins: 0,
        deleting: true,
      }),
    ).not.toThrow();
  });
});
