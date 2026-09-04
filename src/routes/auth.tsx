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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z
  .string()
  .trim()
  .email({ message: "Bitte eine gültige E-Mail-Adresse eingeben." })
  .max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Das Passwort muss mindestens 8 Zeichen haben." })
  .max(72);

/** Supabase-Fehlermeldungen auf Deutsch, damit die Ursache klar wird. */
function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  const raw = err instanceof Error ? err.message : "";
  switch (code) {
    case "weak_password":
      return "Dieses Passwort gilt als unsicher (es taucht in bekannten Datenlecks auf). Bitte ein anderes Passwort mit mindestens 8 Zeichen wählen.";
    case "invalid_credentials":
      return "E-Mail oder Passwort stimmen nicht. Zugänge werden von der Administration erstellt.";
    case "email_address_invalid":
      return "Diese E-Mail-Adresse wird nicht akzeptiert.";
    case "over_email_send_rate_limit":
      return "Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.";
    case "user_banned":
      return "Dieser Zugang ist deaktiviert. Bitte die Administration kontaktieren.";
    default:
      return raw || "Anmeldung fehlgeschlagen.";
  }
}

type Mode = "signin" | "forgot" | "recovery";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
    });
    void supabase.auth.getSession().then(({ data }) => {
      const recovery =
        window.location.hash.includes("type=recovery") ||
        new URLSearchParams(window.location.search).get("reset") === "1";
      if (recovery) {
        setMode("recovery");
        return;
      }
      if (data.session) void navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (resetError) throw resetError;
        toast.success(
          "Falls ein Zugang besteht, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.",
        );
        setMode("signin");
        return;
      }

      if (mode === "recovery") {
        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
        const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data });
        if (updateError) throw updateError;
        toast.success("Passwort aktualisiert.");
        void navigate({ to: "/" });
        return;
      }

      const parsedEmail = emailSchema.safeParse(email);
      const parsedPassword = passwordSchema.safeParse(password);
      if (!parsedEmail.success) throw new Error(parsedEmail.error.issues[0]?.message);
      if (!parsedPassword.success) throw new Error(parsedPassword.error.issues[0]?.message);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: parsedEmail.data,
        password: parsedPassword.data,
      });
      if (signInError) throw signInError;

      const { data: profile } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile && profile.active === false) {
        await supabase.auth.signOut();
        throw new Error("Dieser Zugang ist deaktiviert. Bitte die Administration kontaktieren.");
      }
      await supabase
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", data.user.id);
      void navigate({ to: "/" });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signin" ? "Anmelden" : mode === "forgot" ? "Passwort zurücksetzen" : "Neues Passwort";

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
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">
              {mode === "forgot"
                ? "E-Mail-Adresse eingeben; bei bestehendem Zugang wird ein Link zum Zurücksetzen gesendet."
                : mode === "recovery"
                  ? "Bitte ein neues Passwort für den Zugang festlegen."
                  : "Interner Zugang für Mitarbeitende des Kundelfingerhofs. Zugänge werden von der Administration erstellt."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={handleSubmit} noValidate>
              {mode !== "recovery" ? (
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
              ) : null}
              {mode !== "forgot" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="password">
                    {mode === "recovery" ? "Neues Passwort" : "Passwort"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    maxLength={72}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {mode === "recovery" ? (
                    <p className="text-xs text-muted-foreground">
                      Mindestens 8 Zeichen. Bitte kein gängiges Passwort verwenden.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin"
                  ? "Anmelden"
                  : mode === "forgot"
                    ? "Link senden"
                    : "Passwort speichern"}
              </Button>
            </form>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "forgot" : "signin");
                setError(null);
              }}
            >
              {mode === "signin" ? "Passwort vergessen?" : "Zurück zur Anmeldung"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
