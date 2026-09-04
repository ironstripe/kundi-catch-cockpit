import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "viewer";

async function fetchMyRoles(): Promise<AppRole[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.role as AppRole);
}

/** Rollen des angemeldeten Benutzers; Abschlussaktionen sind Editor/Admin vorbehalten. */
export function useRoles() {
  const query = useQuery({ queryKey: ["user-roles"], queryFn: fetchMyRoles, staleTime: 300_000 });
  const roles = query.data ?? [];
  return {
    roles,
    isLoading: query.isLoading,
    canManage: roles.includes("admin") || roles.includes("editor"),
  };
}
