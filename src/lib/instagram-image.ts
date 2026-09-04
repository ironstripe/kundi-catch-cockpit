/**
 * Bildableitung für Instagram: Zuschnitt auf 4:5 Hochformat.
 * Original und WhatsApp-Variante bleiben unverändert.
 */

import { supabase } from "@/integrations/supabase/client";
import { CATCH_IMAGE_BUCKET } from "@/lib/catches";

export const INSTAGRAM_PREFIX = "instagram";
export const INSTAGRAM_WIDTH = 1080;
export const INSTAGRAM_HEIGHT = 1350;

/** Schneidet mittig auf 4:5 zu und liefert ein JPG. Null, wenn nicht lesbar. */
export async function cropToPortrait(blob: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  const targetRatio = INSTAGRAM_WIDTH / INSTAGRAM_HEIGHT;
  const sourceRatio = bitmap.width / bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sourceRatio > targetRatio) {
    sw = Math.round(bitmap.height * targetRatio);
    sx = Math.round((bitmap.width - sw) / 2);
  } else {
    sh = Math.round(bitmap.width / targetRatio);
    sy = Math.round((bitmap.height - sh) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = INSTAGRAM_WIDTH;
  canvas.height = INSTAGRAM_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
}

/** Lädt die 4:5-Ableitung in den privaten Bucket und gibt den Pfad zurück. */
export async function uploadPortraitAsset(blob: Blob): Promise<string> {
  const path = `${INSTAGRAM_PREFIX}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(CATCH_IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

/** Signierte Vorschau-URL für eine Bildableitung. */
export async function signedPreviewUrl(path: string, seconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CATCH_IMAGE_BUCKET)
    .createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
