import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut, UserRound, WifiOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS, useRoles } from "@/hooks/use-role";
import { OFFLINE_MESSAGE, useOnlineStatus, useServiceWorker } from "@/hooks/use-pwa";
import { supabase } from "@/integrations/supabase/client";

/**
 * Desktop-first App-Shell mit einklappbarer Sidebar.
 * Auf Tablets bleibt die Sidebar per Icon-Modus bzw. Sheet erreichbar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, role } = useRoles();
  const online = useOnlineStatus();
  useServiceWorker();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  async function handlePasswordChange() {
    if (password.length < 8) {
      toast.error("Das Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("weak")
          ? "Dieses Passwort gilt als unsicher. Bitte ein anderes wählen."
          : "Das Passwort konnte nicht geändert werden.",
      );
      return;
    }
    toast.success("Passwort geändert.");
    setPassword("");
    setPasswordOpen(false);
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <span className="text-xs font-medium text-muted-foreground">Kundi Catch Cockpit</span>
            {!online ? (
              <Badge
                variant="destructive"
                className="ml-2 gap-1 text-[10px]"
                title={OFFLINE_MESSAGE}
              >
                <WifiOff className="size-3" aria-hidden />
                Offline – nur Lesemodus
              </Badge>
            ) : null}
            <span className="ml-auto" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-2 gap-2 text-xs">
                  <UserRound />
                  <span className="hidden max-w-[10rem] truncate sm:inline">
                    {profile?.name ?? profile?.email ?? "Konto"}
                  </span>
                  <Badge variant="outline" className="hidden text-[10px] md:inline-flex">
                    {ROLE_LABELS[role]}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-0.5">
                  <p className="truncate text-sm">{profile?.name ?? "Konto"}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {profile?.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
                  <KeyRound /> Passwort ändern
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort ändern</DialogTitle>
            <DialogDescription>
              Mindestens 8 Zeichen. Bitte kein gängiges Passwort verwenden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">Neues Passwort</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>
              Abbrechen
            </Button>
            <Button disabled={busy} onClick={() => void handlePasswordChange()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
