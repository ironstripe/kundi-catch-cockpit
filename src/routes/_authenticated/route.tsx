import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AccountGate } from "@/components/auth/account-gate";
import { AppShell } from "@/components/layout/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Zielpfad mitgeben, damit geschützte Deep-Links (z. B. Sounding-Review)
      // nach der Anmeldung wieder erreicht werden.
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
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
