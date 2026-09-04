import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AccountGate } from "@/components/auth/account-gate";
import { AppShell } from "@/components/layout/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AccountGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AccountGate>
  );
}
