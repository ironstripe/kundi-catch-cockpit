/**
 * Bildaufbereitung für den WhatsApp-Post.
 *
 * Das Original bleibt immer unverändert; die optimierte Variante wird
 * zusätzlich im privaten Bucket abgelegt.
 */

export const MAX_LONG_EDGE = 1080;
export const OPTIMIZED_PREFIX = "optimized";

/** Dateiname für den Download-Fallback: "KC-2026-001-felchenfilets.jpg". */
export function optimizedFileName(
  catchNumber: string | null,
  productName: string,
  extension = "jpg",
): string {
  const slug = productName
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = catchNumber?.trim() ? `${catchNumber.trim()}-` : "";
  return `${prefix}${slug || "kundi-catch"}.${extension}`;
}

/** Kann dieser Browser Bilder direkt in die Zwischenablage schreiben? */
export function supportsImageClipboard(
  nav: { clipboard?: { write?: unknown } } | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
  hasClipboardItem = typeof window !== "undefined" && "ClipboardItem" in window,
): boolean {
  return Boolean(nav?.clipboard?.write) && hasClipboardItem;
}

/** Kann dieser Browser Text in die Zwischenablage schreiben? */
export function supportsTextClipboard(
  nav: { clipboard?: { writeText?: unknown } } | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
): boolean {
  return Boolean(nav?.clipboard?.writeText);
}

async function drawToCanvas(blob: Blob, maxEdge: number): Promise<HTMLCanvasElement | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Erzeugt eine WhatsApp-taugliche Bildvariante:
 * Ausrichtung korrigiert, EXIF entfernt, lange Kante max. 1080 px, JPG.
 * Gibt null zurück, wenn der Browser das Format nicht lesen kann (z. B. HEIC).
 */
export async function optimizeImageBlob(blob: Blob): Promise<Blob | null> {
  const canvas = await drawToCanvas(blob, MAX_LONG_EDGE);
  if (!canvas) return null;
  return canvasToBlob(canvas, "image/jpeg", 0.85);
}

/** Wandelt ein Bild in ein PNG um, wie es die Zwischenablage erwartet. */
export async function toClipboardPng(blob: Blob): Promise<Blob | null> {
  if (blob.type === "image/png") return blob;
  const canvas = await drawToCanvas(blob, MAX_LONG_EDGE);
  if (!canvas) return null;
  return canvasToBlob(canvas, "image/png");
}

/** Schreibt ein Bild in die Zwischenablage. Wirft, wenn es nicht klappt. */
export async function copyImageToClipboard(blob: Blob): Promise<void> {
  if (!supportsImageClipboard()) {
    throw new Error("clipboard-unsupported");
  }
  const png = await toClipboardPng(blob);
  if (!png) throw new Error("convert-failed");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/** Löst einen Download der optimierten Datei aus. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
