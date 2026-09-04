import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { KundiCatchLogo } from "@/components/brand/kundi-catch-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { confirmPasswordChanged } from "@/lib/admin-users.functions";
import { MIN_PASSWORD_LENGTH } from "@/lib/user-admin";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <KundiCatchLogo className="size-16" />
          <h1 className="text-lg font-semibold tracking-tight">Kundi Catch Cockpit</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.assign("/auth");
}

/**
 * Prüft vor dem Betreten der Anwendung, ob das Konto aktiv ist
 * und ob ein erzwungener Passwortwechsel offen ist.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { isLoading, isActive, mustChangePassword, profile } = useRoles();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirmChanged = useServerFn(confirmPasswordChanged);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (profile && !isActive) {
    return (
      <Frame>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Zugang deaktiviert</CardTitle>
            <CardDescription className="text-xs">
              Dieses Konto ist derzeit deaktiviert. Bitte die Administration kontaktieren.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" onClick={() => void signOut()}>
              Abmelden
            </Button>
          </CardContent>
        </Card>
      </Frame>
    );
  }

  async function handleChange(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
      return;
    }
    if (password !== repeat) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(
        updateError.message.toLowerCase().includes("weak") ||
          (updateError as { code?: string }).code === "weak_password"
          ? "Dieses Passwort gilt als unsicher. Bitte ein anderes wählen."
          : "Das Passwort konnte nicht geändert werden. Bitte erneut versuchen.",
      );
      return;
    }
    try {
      await confirmChanged();
    } catch {
      setBusy(false);
      setError("Das Passwort wurde geändert, die Bestätigung schlug fehl. Bitte neu anmelden.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["session-profile"] });
    setBusy(false);
    setPassword("");
    setRepeat("");
    toast.success("Passwort geändert.");
    void navigate({ to: "/" });
  }

  if (mustChangePassword) {
    return (
      <Frame>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Neues Passwort festlegen</CardTitle>
            <CardDescription className="text-xs">
              Das Startpasswort muss vor der ersten Nutzung durch ein persönliches Passwort ersetzt
              werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleChange} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="forced-password">Neues Passwort</Label>
                <Input
                  id="forced-password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forced-password-repeat">Passwort wiederholen</Label>
                <Input
                  id="forced-password-repeat"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Mindestens {MIN_PASSWORD_LENGTH} Zeichen. Bitte kein gängiges Passwort verwenden.
                </p>
              </div>
              {error ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                Passwort speichern
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => void signOut()}
              >
                Abmelden
              </Button>
            </form>
          </CardContent>
        </Card>
      </Frame>
    );
  }

  return <>{children}</>;
}
