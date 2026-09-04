/**
 * Privilegierte Nutzerverwaltung.
 * Läuft ausschliesslich serverseitig; der Service-Key erreicht nie den Browser.
 * Konten werden mit einem Startpasswort angelegt, das beim ersten Login gewechselt werden muss.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertAdminChangeAllowed,
  assertPassword,
  assertRole,
  highestRole,
  normalizeEmail,
  type AppRole,
} from "@/lib/user-admin";

export type ManagedRole = AppRole;

export interface ManagedUser {
  id: string;
  name: string | null;
  email: string | null;
  role: ManagedRole;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const { data, error } = await (
    context.supabase as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: boolean; error: unknown }>;
    }
  ).rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Du hast keine Berechtigung für diesen Bereich.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Db = Awaited<ReturnType<typeof admin>>;

async function logAudit(
  db: Db,
  args: {
    entityId: string;
    action: string;
    actorId: string;
    summary: string;
    previous?: Record<string, unknown>;
    next?: Record<string, unknown>;
  },
) {
  const payload: Record<string, unknown> = { summary: args.summary };
  if (args.previous) payload["previous"] = args.previous;
  if (args.next) payload["next"] = args.next;
  await db.from("audit_events").insert({
    entity_type: "user",
    entity_id: args.entityId,
    action: args.action,
    actor_id: args.actorId,
    payload: payload as never,
  });
}

async function loadTarget(db: Db, userId: string) {
  const { data: profile } = await db
    .from("profiles")
    .select("id, name, email, active")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) throw new Error("Der Nutzer wurde nicht gefunden.");
  const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", userId);
  const role = highestRole((roleRows ?? []).map((row) => String(row.role)));
  return { profile, role };
}

/** Anzahl aktiver Administratoren ohne die angegebene Person. */
async function otherActiveAdmins(db: Db, exceptUserId: string): Promise<number> {
  const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((row) => row.user_id).filter((id) => id !== exceptUserId);
  if (ids.length === 0) return 0;
  const { data: profiles } = await db
    .from("profiles")
    .select("id")
    .in("id", ids)
    .eq("active", true);
  return (profiles ?? []).length;
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context as never);
    const db = await admin();
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      db
        .from("profiles")
        .select("id, name, email, active, must_change_password, created_at, last_login_at"),
      db.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const row of roles ?? []) {
      roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), String(row.role)]);
    }
    return (profiles ?? [])
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: highestRole(roleMap.get(profile.id) ?? []),
        active: profile.active,
        must_change_password: profile.must_change_password,
        created_at: profile.created_at,
        last_login_at: profile.last_login_at,
      }))
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  });

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { email: string; name: string; role: ManagedRole; password: string }) => ({
      email: normalizeEmail(input.email),
      name: String(input.name ?? "").trim(),
      role: assertRole(input.role),
      password: assertPassword(input.password),
    }),
  )
  .handler(async ({ data, context }): Promise<{ userId: string }> => {
    await assertAdmin(context as never);
    const db = await admin();

    const created = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(
        created.error?.message?.includes("already")
          ? "Für diese E-Mail-Adresse besteht bereits ein Konto."
          : "Der Nutzer konnte nicht angelegt werden. Bitte E-Mail-Adresse und Passwort prüfen.",
      );
    }
    const userId = created.data.user.id;

    await db.from("profiles").upsert({
      id: userId,
      name: data.name || data.email,
      email: data.email,
      active: true,
      must_change_password: true,
    });
    await db.from("user_roles").delete().eq("user_id", userId);
    await db.from("user_roles").insert({ user_id: userId, role: data.role });
    await logAudit(db, {
      entityId: userId,
      action: "user_created",
      actorId: context.userId,
      next: { email: data.email, name: data.name, role: data.role },
      summary: `Nutzer ${data.email} erstellt (${data.role}), Passwortwechsel erforderlich`,
    });

    return { userId };
  });

export const updateManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { userId: string; name?: string; role?: ManagedRole; active?: boolean }) => ({
      userId: String(input.userId),
      ...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
      ...(input.role !== undefined ? { role: assertRole(input.role) } : {}),
      ...(input.active !== undefined ? { active: Boolean(input.active) } : {}),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();
    const { profile, role: currentRole } = await loadTarget(db, data.userId);

    assertAdminChangeAllowed({
      actorId: context.userId,
      targetId: data.userId,
      targetIsAdmin: currentRole === "admin",
      targetIsActive: profile.active,
      nextRole: data.role,
      nextActive: data.active,
      otherActiveAdmins: await otherActiveAdmins(db, data.userId),
    });

    const patch: { name?: string; active?: boolean } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.active !== undefined) patch.active = data.active;
    if (Object.keys(patch).length > 0) {
      const { error } = await db.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error("Die Änderung konnte nicht gespeichert werden.");
    }

    if (data.role && data.role !== currentRole) {
      await db.from("user_roles").delete().eq("user_id", data.userId);
      await db.from("user_roles").insert({ user_id: data.userId, role: data.role });
      await logAudit(db, {
        entityId: data.userId,
        action: "role_changed",
        actorId: context.userId,
        previous: { role: currentRole },
        next: { role: data.role },
        summary: `Rolle von ${profile.email}: ${currentRole} → ${data.role}`,
      });
    }
    if (data.active !== undefined && data.active !== profile.active) {
      await logAudit(db, {
        entityId: data.userId,
        action: data.active ? "user_activated" : "user_deactivated",
        actorId: context.userId,
        previous: { active: profile.active },
        next: { active: data.active },
        summary: `${profile.email} ${data.active ? "aktiviert" : "deaktiviert"}`,
      });
    }
    if (data.name !== undefined && data.name !== (profile.name ?? "")) {
      await logAudit(db, {
        entityId: data.userId,
        action: "user_updated",
        actorId: context.userId,
        previous: { name: profile.name },
        next: { name: data.name },
        summary: `Name geändert: ${profile.email}`,
      });
    }
    return { ok: true };
  });

/** Setzt ein neues Startpasswort; die betroffene Person muss es beim nächsten Login wechseln. */
export const setManagedPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => ({
    userId: String(input.userId),
    password: assertPassword(input.password),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();
    const { profile } = await loadTarget(db, data.userId);

    const { error } = await db.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) {
      throw new Error("Das Startpasswort konnte nicht gesetzt werden. Bitte ein anderes wählen.");
    }
    await db.from("profiles").update({ must_change_password: true }).eq("id", data.userId);
    await logAudit(db, {
      entityId: data.userId,
      action: "initial_password_set",
      actorId: context.userId,
      summary: `Startpasswort für ${profile.email} gesetzt, Wechsel beim nächsten Login erforderlich`,
    });
    return { ok: true };
  });

export const sendManagedPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; email: string; redirectTo: string }) => ({
    userId: String(input.userId),
    email: normalizeEmail(input.email),
    redirectTo: String(input.redirectTo),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();
    const { error } = await db.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error("Der Passwort-Reset konnte nicht gesendet werden.");
    await logAudit(db, {
      entityId: data.userId,
      action: "password_reset_sent",
      actorId: context.userId,
      summary: `Passwort-Reset an ${data.email} gesendet`,
    });
    return { ok: true };
  });

/** Löscht ein Konto endgültig; der letzte aktive Administrator bleibt geschützt. */
export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: String(input.userId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();
    const { profile, role } = await loadTarget(db, data.userId);

    assertAdminChangeAllowed({
      actorId: context.userId,
      targetId: data.userId,
      targetIsAdmin: role === "admin",
      targetIsActive: profile.active,
      otherActiveAdmins: await otherActiveAdmins(db, data.userId),
      deleting: true,
    });

    await logAudit(db, {
      entityId: data.userId,
      action: "user_deleted",
      actorId: context.userId,
      previous: { email: profile.email, name: profile.name, role },
      summary: `Nutzer ${profile.email} gelöscht`,
    });

    await db.from("user_roles").delete().eq("user_id", data.userId);
    await db.from("profiles").delete().eq("id", data.userId);
    const { error } = await db.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Das Konto konnte nicht gelöscht werden.");
    return { ok: true };
  });

/** Bestätigt den erzwungenen Passwortwechsel der angemeldeten Person. */
export const confirmPasswordChanged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    await db.from("profiles").update({ must_change_password: false }).eq("id", context.userId);
    return { ok: true };
  });
