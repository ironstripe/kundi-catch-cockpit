/**
 * Privilegierte Nutzerverwaltung.
 * Läuft ausschliesslich serverseitig; der Service-Key erreicht nie den Browser.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagedRole = "admin" | "editor" | "viewer";

export interface ManagedUser {
  id: string;
  name: string | null;
  email: string | null;
  role: ManagedRole;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
}

const ROLES: ManagedRole[] = ["admin", "editor", "viewer"];

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = await (context.supabase as never as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean; error: unknown }>;
  }).rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Du hast keine Berechtigung für diesen Bereich.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Anzahl aktiver Administratoren (ohne den optional ausgeschlossenen Nutzer). */
async function activeAdminCount(exceptUserId?: string): Promise<number> {
  const db = await admin();
  const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((row) => row.user_id).filter((id) => id !== exceptUserId);
  if (ids.length === 0) return 0;
  const { data: profiles } = await db.from("profiles").select("id").in("id", ids).eq("active", true);
  return (profiles ?? []).length;
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context as never);
    const db = await admin();
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      db.from("profiles").select("id, name, email, active, created_at, last_login_at"),
      db.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, ManagedRole>();
    for (const row of roles ?? []) {
      const current = roleMap.get(row.user_id);
      const next = row.role as ManagedRole;
      if (!current || ROLES.indexOf(next) < ROLES.indexOf(current)) roleMap.set(row.user_id, next);
    }
    return (profiles ?? [])
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: roleMap.get(profile.id) ?? "viewer",
        active: profile.active,
        created_at: profile.created_at,
        last_login_at: profile.last_login_at,
      }))
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  });

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; name: string; role: ManagedRole }) => {
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Bitte eine gültige E-Mail-Adresse eingeben.");
    if (!ROLES.includes(input.role)) throw new Error("Ungültige Rolle.");
    return { email, name: input.name.trim(), role: input.role };
  })
  .handler(async ({ data, context }): Promise<{ userId: string; initialPassword: string | null }> => {
    await assertAdmin(context as never);
    const db = await admin();

    const invited = await db.auth.admin.inviteUserByEmail(data.email);
    let userId = invited.data?.user?.id ?? null;
    let initialPassword: string | null = null;

    if (!userId) {
      initialPassword = `Kundi-${crypto.randomUUID().slice(0, 12)}!`;
      const created = await db.auth.admin.createUser({
        email: data.email,
        password: initialPassword,
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        throw new Error("Der Nutzer konnte nicht angelegt werden. Bitte E-Mail-Adresse prüfen.");
      }
      userId = created.data.user.id;
    }

    await db.from("profiles").upsert({ id: userId, name: data.name, email: data.email, active: true });
    await db.from("user_roles").delete().eq("user_id", userId);
    await db.from("user_roles").insert({ user_id: userId, role: data.role });
    await db.from("audit_events").insert({
      entity_type: "user",
      entity_id: userId,
      action: "user_created",
      actor_id: context.userId,
      payload: { next: { email: data.email, name: data.name, role: data.role }, summary: `Nutzer ${data.email} erstellt (${data.role})` } as never,
    });

    return { userId, initialPassword };
  });

export const updateManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; name?: string; role?: ManagedRole; active?: boolean }) => {
    if (input.role && !ROLES.includes(input.role)) throw new Error("Ungültige Rolle.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();

    const { data: profile } = await db
      .from("profiles")
      .select("id, name, email, active")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) throw new Error("Der Nutzer wurde nicht gefunden.");
    const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", data.userId);
    const currentRole = ((roleRows ?? [])[0]?.role ?? "viewer") as ManagedRole;

    const isSelf = data.userId === context.userId;
    const losesAdmin =
      currentRole === "admin" && ((data.role && data.role !== "admin") || data.active === false);

    if (isSelf && losesAdmin) {
      throw new Error("Du kannst dein eigenes Administratorkonto nicht deaktivieren oder herabstufen.");
    }
    if (losesAdmin && (await activeAdminCount(data.userId)) === 0) {
      throw new Error("Mindestens ein aktiver Administrator muss bestehen bleiben.");
    }

    const patch: { name?: string; active?: boolean } = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.active !== undefined) patch.active = data.active;
    if (Object.keys(patch).length > 0) {
      await db.from("profiles").update(patch).eq("id", data.userId);
    }
    if (data.role && data.role !== currentRole) {
      await db.from("user_roles").delete().eq("user_id", data.userId);
      await db.from("user_roles").insert({ user_id: data.userId, role: data.role });
      await db.from("audit_events").insert({
        entity_type: "user",
        entity_id: data.userId,
        action: "role_changed",
        actor_id: context.userId,
        payload: { previous: { role: currentRole }, next: { role: data.role }, summary: `Rolle von ${profile.email}: ${currentRole} → ${data.role}` } as never,
      });
    }
    if (data.active !== undefined && data.active !== profile.active) {
      await db.from("audit_events").insert({
        entity_type: "user",
        entity_id: data.userId,
        action: data.active ? "user_activated" : "user_deactivated",
        actor_id: context.userId,
        payload: { previous: { active: profile.active }, next: { active: data.active }, summary: `${profile.email} ${data.active ? "aktiviert" : "deaktiviert"}` } as never,
      });
    }
    if (data.name !== undefined && data.name.trim() !== (profile.name ?? "")) {
      await db.from("audit_events").insert({
        entity_type: "user",
        entity_id: data.userId,
        action: "user_updated",
        actor_id: context.userId,
        payload: { previous: { name: profile.name }, next: { name: data.name.trim() }, summary: `Name geändert: ${profile.email}` } as never,
      });
    }
    return { ok: true };
  });

export const sendManagedPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; email: string; redirectTo: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const db = await admin();
    const { error } = await db.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error("Die Einladung bzw. der Passwort-Reset konnte nicht gesendet werden.");
    await db.from("audit_events").insert({
      entity_type: "user",
      entity_id: data.userId,
      action: "password_reset_sent",
      actor_id: context.userId,
      payload: { summary: `Passwort-Reset an ${data.email} gesendet` } as never,
    });
    return { ok: true };
  });
