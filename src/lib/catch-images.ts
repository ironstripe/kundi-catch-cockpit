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
export function abandonedUploads(uploaded: Iterable<string>, images: FormCatchImage[]): string[] {
  const kept = new Set(images.map((image) => image.storagePath));
  return [...uploaded].filter((path) => !kept.has(path));
}

/**
 * Sitzungs-Uploads, die beim Verlassen gefahrlos gelöscht werden dürfen:
 * nur Objekte, die von keinem catch_images-Datensatz referenziert werden.
 * Nach einem Teilerfolg kann ein frischer Upload bereits gespeichert sein —
 * dieses Objekt darf nicht entfernt werden.
 */
export function uploadsSafeToRemove(pending: string[], referencedPaths: string[]): string[] {
  const referenced = new Set(referencedPaths);
  return pending.filter((path) => !referenced.has(path));
}

/** Minimale Client-Schnittstelle — erlaubt Tests ohne echte Datenbank. */
export interface CatchImageSyncClient {
  rpc(
    fn: "sync_catch_images",
    args: { _catch_id: string; _images: { id: string | null; storage_path: string }[]; _baseline_ids: string[] },
  ): PromiseLike<{
    data: { inserted: number; updated: number; removed: number; removed_paths: string[] } | null;
    error: { message: string } | null;
  }>;
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

/**
 * Räumt verlassene Sitzungs-Uploads auf. Nach einem Teilerfolg (Catch
 * existiert) werden nur Objekte gelöscht, die kein catch_images-Datensatz
 * referenziert; schlägt diese Prüfung fehl, bleibt alles erhalten.
 */
export async function cleanupAbandonedUploads(
  client: CatchImageSyncClient,
  catchId: string | undefined,
  pending: string[],
): Promise<string[]> {
  if (pending.length === 0) return [];
  let safe = pending;
  if (catchId) {
    try {
      const { data, error } = await client
        .from("catch_images")
        .select("id, storage_path, is_primary, sort_order")
        .eq("catch_id", catchId);
      if (error) return [];
      safe = uploadsSafeToRemove(
        pending,
        (data ?? []).map((row) => row.storage_path),
      );
    } catch {
      return [];
    }
  }
  await removeStorageObjects(client, CATCH_IMAGE_BUCKET, safe);
  return safe;
}

export interface SyncResult {
  inserted: number;
  removed: number;
  updated: number;
}

/**
 * Bringt die gespeicherten Bilddatensätze auf den Formularstand — atomar in
 * einer Datenbanktransaktion (RPC `sync_catch_images`, pro Catch serialisiert,
 * RLS des Aufrufers gilt). Das alte Hauptbild wird vor dem neuen
 * zurückgestuft; bei jedem Fehler wird alles zurückgerollt.
 *
 * Entfernt wird nur, was in `baselineIds` stand und im Formular bewusst
 * fehlt — nebenläufig hinzugefügte Datensätze bleiben erhalten. Frisch
 * hochgeladene Bilder werden über den Speicherpfad wiedererkannt (Retry).
 *
 * Speicherobjekte werden erst nach bestätigtem Commit gelöscht; bei Fehler
 * oder unklarem Ausgang bleibt jedes Objekt erhalten.
 */
export async function syncCatchImages(
  client: CatchImageSyncClient,
  catchId: string,
  desired: FormCatchImage[],
  baselineIds: string[],
): Promise<SyncResult> {
  let response: Awaited<ReturnType<CatchImageSyncClient["rpc"]>>;
  try {
    response = await client.rpc("sync_catch_images", {
      _catch_id: catchId,
      _images: desired.map((image) => ({
        id: image.persistedId,
        storage_path: image.storagePath,
      })),
      _baseline_ids: baselineIds,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Bilder konnten nicht gespeichert werden: ${message}`);
  }
  if (response.error || !response.data) {
    throw new Error(
      `Bilder konnten nicht gespeichert werden: ${response.error?.message ?? "Keine Antwort"}`,
    );
  }
  const result = response.data;
  await removeStorageObjects(client, CATCH_IMAGE_BUCKET, result.removed_paths ?? []);
  return { inserted: result.inserted, removed: result.removed, updated: result.updated };
}
