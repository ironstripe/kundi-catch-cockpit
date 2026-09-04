/**
 * Rückmeldung der Instagram-Automatisierung.
 * Öffentlich erreichbar, aber nur mit gültiger Signatur und Idempotenzschlüssel.
 */

import { createFileRoute } from "@tanstack/react-router";

async function hmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/public/instagram/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INSTAGRAM_CALLBACK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        let payload: {
          idempotency_key?: string;
          status?: string;
          media_id?: string | null;
          permalink?: string | null;
          error?: string | null;
          token?: string | null;
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const key = payload.idempotency_key ?? "";
        if (!key) return new Response("Missing idempotency_key", { status: 400 });

        const provided = request.headers.get("x-kundi-signature") ?? payload.token ?? "";
        const expected = await hmacHex(secret, key);
        if (!safeEqual(provided, expected)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("catches")
          .select("id, instagram_status")
          .eq("instagram_idempotency_key", key)
          .maybeSingle();
        if (!row) return new Response("Unknown key", { status: 404 });
        if (row.instagram_status === "published") {
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        const success = payload.status === "published" || payload.status === "success";
        const now = new Date().toISOString();
        await supabaseAdmin
          .from("catches")
          .update(
            success
              ? {
                  instagram_status: "published",
                  instagram_published_at: now,
                  instagram_media_id: payload.media_id ?? null,
                  instagram_permalink: payload.permalink ?? null,
                  instagram_error: null,
                }
              : {
                  instagram_status: "failed",
                  instagram_error: payload.error ?? "Unbekannter Fehler der Automatisierung.",
                },
          )
          .eq("id", row.id);

        await supabaseAdmin.from("audit_events").insert({
          entity_type: "catch",
          entity_id: row.id,
          action: success ? "instagram_published" : "instagram_failed",
          actor_id: null,
          payload: {
            idempotency_key: key,
            permalink: payload.permalink ?? null,
            error: success ? null : (payload.error ?? null),
          },
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
