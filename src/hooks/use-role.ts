import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { highestRole, permissionsFor, ROLE_LABELS, type AppRole } from "@/lib/user-admin";

export type { AppRole };
export { ROLE_LABELS };

export interface SessionProfile {
  id: string;
  name: string | null;
  email: string | null;
  active: boolean;
  mustChangePassword: boolean;
  role: AppRole;
}

async function fetchSession(): Promise<SessionProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, active, must_change_password")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    name: profile?.name ?? null,
    email: profile?.email ?? user.email ?? null,
    active: profile?.active ?? false,
    mustChangePassword: profile?.must_change_password ?? false,
    role: highestRole((roles ?? []).map((row) => String(row.role))),
  };
}

/**
 * Angemeldetes Profil inklusive Rolle und Berechtigungen.
 * Die UI blendet Aktionen aus; die verbindliche Prüfung erfolgt über RLS und Trigger.
 */
export function useRoles() {
  const query = useQuery({
    queryKey: ["session-profile"],
    queryFn: fetchSession,
    staleTime: 60_000,
  });
  const profile = query.data ?? null;
  const role = profile?.role ?? "viewer";
  const active = profile?.active ?? false;
  const permissions = permissionsFor(role, active);

  return {
    profile,
    role,
    roles: profile ? [role] : [],
    isActive: active,
    isLoading: query.isLoading,
    mustChangePassword: profile?.mustChangePassword ?? false,
    isAdmin: permissions.canAdminister,
    canEdit: permissions.canEdit,
    /** Wiederöffnen und Abbrechen — nur Administratoren. */
    canManage: permissions.canReopen,
    permissions,
  };
}
