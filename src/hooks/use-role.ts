import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export interface SessionProfile {
  id: string;
  name: string | null;
  email: string | null;
  active: boolean;
  role: AppRole;
}

async function fetchSession(): Promise<SessionProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, name, email, active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roleList = (roles ?? []).map((row) => row.role as AppRole);
  const role: AppRole = roleList.includes("admin")
    ? "admin"
    : roleList.includes("editor")
      ? "editor"
      : "viewer";

  return {
    id: user.id,
    name: profile?.name ?? null,
    email: profile?.email ?? user.email ?? null,
    active: profile?.active ?? true,
    role,
  };
}

/**
 * Angemeldetes Profil inklusive Rolle und Berechtigungen.
 * Die UI blendet Aktionen aus; die verbindliche Prüfung erfolgt über RLS.
 */
export function useRoles() {
  const query = useQuery({ queryKey: ["session-profile"], queryFn: fetchSession, staleTime: 60_000 });
  const profile = query.data ?? null;
  const role = profile?.role ?? "viewer";
  const active = profile?.active ?? false;
  const isAdmin = active && role === "admin";
  const canEdit = active && (role === "admin" || role === "editor");

  return {
    profile,
    role,
    roles: profile ? [role] : [],
    isActive: active,
    isLoading: query.isLoading,
    isAdmin,
    canEdit,
    /** Abschluss-, Wiederöffnungs- und Abbruchaktionen. */
    canManage: canEdit,
  };
}
