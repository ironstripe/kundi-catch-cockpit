/**
 * Backup-Webhook: erzeugt eine kurzlebige Download-URL für eine bereits
 * hochgeladene Exportdatei und meldet sie an den konfigurierten Webhook.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_SECONDS = 15 * 60;

export interface BackupStatus {
  configured: boolean;
  last_run: {
    file_name: string;
    status: string;
    attempted_at: string;
    succeeded_at: string | null;
    error_summary: string | null;
  } | null;
}

export const getBackupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackupStatus> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("backup_runs")
      .select("file_name, status, attempted_at, succeeded_at, error_summary")
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      configured: Boolean(process.env["BACKUP_WEBHOOK_URL"]),
      last_run: data ?? null,
    };
  });

export const sendBackupWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string; fileName: string }) => {
    if (!input?.path || !input?.fileName) throw new Error("Ungültige Eingabe.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const webhookUrl = process.env["BACKUP_WEBHOOK_URL"];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const attemptedAt = new Date();

    async function record(status: string, errorSummary: string | null) {
      await supabaseAdmin.from("backup_runs").insert({
        file_name: data.fileName,
        status,
        attempted_at: attemptedAt.toISOString(),
        succeeded_at: status === "success" ? new Date().toISOString() : null,
        error_summary: errorSummary,
        actor_id: context.userId,
      });
    }

    if (!webhookUrl) {
      return { ok: false as const, reason: "not_configured" as const };
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("exports")
      .createSignedUrl(data.path, SIGNED_URL_SECONDS);

    if (signError || !signed?.signedUrl) {
      await record("failed", "Download-Link konnte nicht erstellt werden.");
      return { ok: false as const, reason: "sign_failed" as const };
    }

    const expiresAt = new Date(attemptedAt.getTime() + SIGNED_URL_SECONDS * 1000);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "kundi-catch",
          generated_at: attemptedAt.toISOString(),
          file_name: data.fileName,
          download_url: signed.signedUrl,
          expires_at: expiresAt.toISOString(),
        }),
      });
      if (!response.ok) {
        await record("failed", `Webhook antwortete mit Status ${response.status}.`);
        return { ok: false as const, reason: "webhook_error" as const, status: response.status };
      }
      await record("success", null);
      return { ok: true as const, expires_at: expiresAt.toISOString() };
    } catch {
      await record("failed", "Webhook nicht erreichbar.");
      return { ok: false as const, reason: "unreachable" as const };
    }
  });
