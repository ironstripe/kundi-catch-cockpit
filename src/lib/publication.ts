/**
 * Datenzugriff für die WhatsApp-Publikation:
 * optimiertes Bild, Textversionen, Publikationsstatus.
 */

import { supabase } from "@/integrations/supabase/client";
import { CATCH_IMAGE_BUCKET, type CatchDetail } from "@/lib/catches";
import { optimizeImageBlob, OPTIMIZED_PREFIX } from "@/lib/whatsapp-image";
import type { PostSource } from "@/lib/whatsapp-post";

export interface PreparedImage {
  /** Bild, das kopiert oder heruntergeladen wird. */
  blob: Blob;
  /** Pfad im privaten Bucket (nur intern, nie im UI anzeigen). */
  path: string;
  /** Signierte URL für die Vorschau. */
  url: string;
  /** false, wenn die Optimierung nicht möglich war und das Original dient. */
  optimized: boolean;
}

/** Catch-Daten -> Eingabewerte der Postgenerierung. */
export function catchToPostSource(item: CatchDetail): PostSource {
  return {
    product_name: item.product_name,
    description: item.description,
    packaging: item.packaging,
    expiry_date: item.expiry_date,
    regular_price: item.regular_price,
    catch_price: item.catch_price,
    quantity_unit: item.quantity_unit,
    location_names: item.location_names,
    available_from: item.available_from,
    available_until: item.available_until,
    handicap_story: item.handicap_story,
    image_path: item.image_path,
  };
}

async function signedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(CATCH_IMAGE_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function download(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(CATCH_IMAGE_BUCKET).download(path);
  if (error) throw error;
  return data;
}

/**
 * Liefert die WhatsApp-optimierte Bildvariante und erzeugt sie bei Bedarf.
 * Das Original wird nie überschrieben; bei Fehlern dient es als Fallback.
 */
export async function ensureOptimizedImage(catchId: string): Promise<PreparedImage | null> {
  const { data: rows, error } = await supabase
    .from("catch_images")
    .select("id, storage_path, optimized_path, optimized_source_path, is_primary, sort_order")
    .eq("catch_id", catchId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const row = rows?.[0];
  if (!row) return null;

  if (row.optimized_path && row.optimized_source_path === row.storage_path) {
    try {
      const blob = await download(row.optimized_path);
      return { blob, path: row.optimized_path, url: await signedUrl(row.optimized_path), optimized: true };
    } catch {
      /* neu erzeugen */
    }
  }

  const original = await download(row.storage_path);
  const optimizedBlob = await optimizeImageBlob(original);

  if (!optimizedBlob) {
    return {
      blob: original,
      path: row.storage_path,
      url: await signedUrl(row.storage_path),
      optimized: false,
    };
  }

  const objectPath = `${OPTIMIZED_PREFIX}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(CATCH_IMAGE_BUCKET)
    .upload(objectPath, optimizedBlob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) {
    return {
      blob: optimizedBlob,
      path: row.storage_path,
      url: await signedUrl(row.storage_path),
      optimized: true,
    };
  }

  const previous = row.optimized_path;
  await supabase
    .from("catch_images")
    .update({ optimized_path: objectPath, optimized_source_path: row.storage_path })
    .eq("id", row.id);
  if (previous && previous !== objectPath) {
    await supabase.storage.from(CATCH_IMAGE_BUCKET).remove([previous]);
  }

  return { blob: optimizedBlob, path: objectPath, url: await signedUrl(objectPath), optimized: true };
}

interface SavePostArgs {
  catchId: string;
  generatedText: string;
  finalText: string;
  signature: string;
  generatedAt?: string;
  reason: "generated" | "edited" | "reset" | "published";
  imagePath?: string | null;
  usedForPublication?: boolean;
}

/** Speichert eine Textversion und den aktuellen Stand am Catch. */
export async function savePostVersion({
  catchId,
  generatedText,
  finalText,
  signature,
  generatedAt,
  reason,
  imagePath = null,
  usedForPublication = false,
}: SavePostArgs): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const { data: last } = await supabase
    .from("post_versions")
    .select("version")
    .eq("catch_id", catchId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (last?.[0]?.version ?? 0) + 1;

  const { error } = await supabase.from("post_versions").insert({
    catch_id: catchId,
    version: nextVersion,
    body: finalText,
    generated_text: generatedText,
    final_text: finalText,
    reason,
    image_path: imagePath,
    used_for_publication: usedForPublication,
    created_by: userId,
  });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("catches")
    .update({
      post_generated_text: generatedText,
      post_final_text: finalText,
      post_source_signature: signature,
      post_outdated_decision: null,
      ...(generatedAt ? { post_generated_at: generatedAt } : {}),
    })
    .eq("id", catchId);
  if (updateError) throw updateError;
}

/** Merkt sich, dass der Nutzer den bestehenden Text trotz Datenänderung behält. */
export async function keepOutdatedPost(catchId: string, signature: string): Promise<void> {
  const { error } = await supabase
    .from("catches")
    .update({ post_outdated_decision: "keep", post_source_signature: signature })
    .eq("id", catchId);
  if (error) throw error;
}

/** Setzt den Catch nach ausdrücklicher Bestätigung auf «Publiziert». */
export async function markCatchPublished(args: {
  catchId: string;
  finalText: string;
  generatedText: string;
  signature: string;
  imagePath: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const publishedAt = new Date().toISOString();

  const { error } = await supabase
    .from("catches")
    .update({
      status: "published",
      published_at: publishedAt,
      published_by: userId,
      published_text: args.finalText,
      published_image_path: args.imagePath,
      post_final_text: args.finalText,
    })
    .eq("id", args.catchId);
  if (error) throw error;

  await savePostVersion({
    catchId: args.catchId,
    generatedText: args.generatedText,
    finalText: args.finalText,
    signature: args.signature,
    reason: "published",
    imagePath: args.imagePath,
    usedForPublication: true,
  });

  await supabase.from("audit_events").insert({
    entity_type: "catch",
    entity_id: args.catchId,
    action: "published",
    actor_id: userId,
    payload: { published_at: publishedAt, image_path: args.imagePath },
  });
}
