/**
 * Mehrere Produktbilder eines Catches.
 *
 * Bilder werden sofort in den privaten Bucket geladen, aber Datensätze,
 * Reihenfolge und Löschungen laufen erst beim bestätigten Speichern.
 * Verwerfen lässt bereits gespeicherte Bilder unangetastet; nur frisch
 * hochgeladene, nicht übernommene Objekte werden aufgeräumt.
 */

import { CATCH_IMAGE_BUCKET } from "@/lib/catches";

/** Gespeicherter Bilddatensatz eines Catches. */
export interface CatchImageRecord {
  id: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
}

/** Ein Bild im Formular: persistiert (mit Id) oder frisch hochgeladen. */
export interface FormCatchImage {
  /** Stabiler Schlüssel: Datensatz-Id oder «new:<storagePath>». */
  key: string;
  storagePath: string;
  /** Vorhandener Datensatz oder null für frisch Hochgeladenes. */
  persistedId: string | null;
}

export function newImageKey(storagePath: string): string {
  return `new:${storagePath}`;
}

/** Datensätze -> Formularliste in stabiler Reihenfolge (Hauptbild zuerst). */
export function toFormImages(rows: CatchImageRecord[]): FormCatchImage[] {
  return [...rows]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
    .map((row) => ({ key: row.id, storagePath: row.storage_path, persistedId: row.id }));
}

/** Hängt frisch hochgeladene Bilder hinten an; Duplikate werden übersprungen. */
export function addImages(images: FormCatchImage[], storagePaths: string[]): FormCatchImage[] {
  const existing = new Set(images.map((image) => image.storagePath));
  const added = storagePaths
    .filter((path) => !existing.has(path))
    .map((path) => ({ key: newImageKey(path), storagePath: path, persistedId: null }));
  if (added.length === 0) return images;
  return [...images, ...added];
}

export function removeImage(images: FormCatchImage[], key: string): FormCatchImage[] {
  return images.filter((image) => image.key !== key);
}

/** Macht das gewählte Bild zum Hauptbild (immer an erster Stelle). */
export function makePrimary(images: FormCatchImage[], key: string): FormCatchImage[] {
  const index = images.findIndex((image) => image.key === key);
  if (index <= 0) return images;
  const next = [...images];
  const [image] = next.splice(index, 1);
  if (!image) return images;
  next.unshift(image);
  return next;
}

/** Verschiebt ein Bild um eine Position (nur innerhalb der Liste). */
export function moveImage(images: FormCatchImage[], key: string, delta: -1 | 1): FormCatchImage[] {
  const index = images.findIndex((image) => image.key === key);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= images.length) return images;
  const next = [...images];
  const a = next[index]!;
  const b = next[target]!;
  next[index] = b;
  next[target] = a;
  return next;
}

/** Reihenfolge, Hauptbild, Zusätze und Entfernungen gegenüber dem Ladezustand. */
export function imagesDirty(images: FormCatchImage[], initialRows: CatchImageRecord[]): boolean {
  const before = toFormImages(initialRows).map((image) => image.key);
  const after = images.map((image) => image.key);
  return before.length !== after.length || before.some((key, index) => key !== after[index]);
}

/** Frisch hochgeladene Speicherobjekte, die es nicht ins Formular geschafft haben. */
export function abandonedUploads(
  uploaded: Iterable<string>,
  images: FormCatchImage[],
): string[] {
  const kept = new Set(images.map((image) => image.storagePath));
  return [...uploaded].filter((path) => !kept.has(path));
}

/** Minimale Client-Schnittstelle — erlaubt Tests ohne echte Datenbank. */
export interface CatchImageSyncClient {
  storage: {
    from(bucket: string): {
      remove(paths: string[]): PromiseLike<{ error: { message: string } | null }>;
    };
  };
  from(table: "catch_images"): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): PromiseLike<{ data: CatchImageRecord[] | null; error: { message: string } | null }>;
    };
    insert(rows: Record<string, unknown>[]): PromiseLike<{ error: { message: string } | null }>;
    update(row: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }>;
    };
    delete(): {
      in(column: string, values: string[]): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/** Aufräumen ist best effort — verwaiste private Objekte sind harmlos. */
export async function removeStorageObjects(
  client: CatchImageSyncClient,
  bucket: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    await client.storage.from(bucket).remove(paths);
  } catch {
    /* best effort */
  }
}

export interface SyncResult {
  inserted: number;
  removed: number;
  updated: number;
}

/**
 * Bringt die gespeicherten Bilddatensätze auf den Formularstand:
 * Reihenfolge und Hauptbild aktualisieren, Entferntes löschen (Datensatz
 * zuerst, Speicherobjekt danach), Neues einfügen.
 *
 * Idempotent: Wurde nach einem Teilerfolg erneut gespeichert, werden frisch
 * hochgeladene Bilder über ihren Speicherpfad erkannt und nicht doppelt
 * angelegt. Entfernt wird nur, was im Formular bewusst fehlt — nie
 * ungeladene Bestandsbilder.
 */
export async function syncCatchImages(
  client: CatchImageSyncClient,
  catchId: string,
  desired: FormCatchImage[],
): Promise<SyncResult> {
  const { data, error } = await client
    .from("catch_images")
    .select("id, storage_path, is_primary, sort_order")
    .eq("catch_id", catchId);
  if (error) {
    throw new Error(`Bilder des Catches konnten nicht gelesen werden: ${error.message}`);
  }
  const existing = data ?? [];

  // Frisch Hochgeladenes kann nach einem Teilerfolg bereits als Datensatz
  // existieren — über den Speicherpfad wiedererkennen statt doppelt anlegen.
  const byPath = new Map(existing.map((row) => [row.storage_path, row]));
  const resolved = desired.map((image, index) => {
    const persisted = image.persistedId
      ? (existing.find((row) => row.id === image.persistedId) ?? null)
      : (byPath.get(image.storagePath) ?? null);
    return { image, persisted, index };
  });

  const keptIds = new Set(
    resolved.map((entry) => entry.persisted?.id).filter((id): id is string => Boolean(id)),
  );
  const toRemove = existing.filter((row) => !keptIds.has(row.id));

  if (toRemove.length > 0) {
    const removed = await client
      .from("catch_images")
      .delete()
      .in(
        "id",
        toRemove.map((row) => row.id),
      );
    if (removed.error) {
      throw new Error(`Bilder konnten nicht entfernt werden: ${removed.error.message}`);
    }
    // Speicherobjekte erst nach erfolgreichem Löschen des Datensatzes aufräumen.
    await removeStorageObjects(
      client,
      CATCH_IMAGE_BUCKET,
      toRemove.map((row) => row.storage_path),
    );
  }

  let updated = 0;
  for (const entry of resolved) {
    if (!entry.persisted) continue;
    const isPrimary = entry.index === 0;
    if (entry.persisted.is_primary === isPrimary && entry.persisted.sort_order === entry.index) {
      continue;
    }
    const result = await client
      .from("catch_images")
      .update({ is_primary: isPrimary, sort_order: entry.index })
      .eq("id", entry.persisted.id);
    if (result.error) {
      throw new Error(`Reihenfolge der Bilder konnte nicht gespeichert werden: ${result.error.message}`);
    }
    updated += 1;
  }

  const fresh = resolved.filter((entry) => !entry.persisted);
  if (fresh.length > 0) {
    const inserted = await client.from("catch_images").insert(
      fresh.map((entry) => ({
        catch_id: catchId,
        storage_path: entry.image.storagePath,
        is_primary: entry.index === 0,
        sort_order: entry.index,
      })),
    );
    if (inserted.error) {
      throw new Error(`Neue Bilder konnten nicht gespeichert werden: ${inserted.error.message}`);
    }
  }

  return { inserted: fresh.length, removed: toRemove.length, updated };
}
