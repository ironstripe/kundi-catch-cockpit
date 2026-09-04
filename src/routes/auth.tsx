import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { KundiCatchLogo } from "@/components/brand/kundi-catch-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Anmelden — Kundi Catch Cockpit" },
      {
        name: "description",
        content:
          "Interner Zugang zum Kundi Catch Cockpit der Kundelfingerhof AG. Anmeldung für berechtigte Mitarbeitende.",
      },
      { property: "og:title", content: "Anmelden — Kundi Catch Cockpit" },
      {
        property: "og:description",
        content: "Interner Zugang zum Kundi Catch Cockpit der Kundelfingerhof AG.",
      },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email({ message: "Bitte eine gültige E-Mail-Adresse eingeben." }).max(255),
  password: z.string().min(8, { message: "Das Passwort muss mindestens 8 Zeichen haben." }).max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Eingabe ungültig.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
        if (signInError) throw signInError;
        void navigate({ to: "/" });
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        toast.success("Konto erstellt");
        if (data.session) {
          void navigate({ to: "/" });
        } else {
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <KundiCatchLogo className="size-16" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Kundi Catch Cockpit</h1>
            <p className="text-xs text-muted-foreground">
              Guter Fisch. Kleines Handicap. Grosser Fang.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">
              {mode === "signin" ? "Anmelden" : "Konto erstellen"}
            </CardTitle>
            <CardDescription className="text-xs">
              Interner Zugang für Mitarbeitende des Kundelfingerhofs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  maxLength={255}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  maxLength={72}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? "Anmelden" : "Konto erstellen"}
              </Button>
            </form>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
            >
              {mode === "signin"
                ? "Noch kein Konto? Konto erstellen"
                : "Bereits ein Konto? Zur Anmeldung"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
