/**
 * Übernahme eines Dossier-Bildes in den Speicher eines Catches.
 *
 * Jeder Schritt (Download, Upload, Bilddatensatz) wird geprüft. Scheitert ein
 * Schritt, wird eine verständliche Meldung geworfen und nichts halb Fertiges
 * zurückgelassen. Die Originalanhänge im Dossier bleiben unverändert.
 */

export const CATCH_IMAGE_EXISTS_MARKER = "[catch-image-exists]";

interface StorageResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Minimale Client-Schnittstelle — erlaubt Tests ohne echte Datenbank. */
export interface ImageTransferClient {
  storage: {
    from(bucket: string): {
      download(path: string): PromiseLike<StorageResult<Blob>>;
      upload(
        path: string,
        body: ArrayBuffer | Uint8Array,
        options: { contentType: string; upsert: boolean },
      ): PromiseLike<StorageResult<unknown>>;
      remove(paths: string[]): PromiseLike<StorageResult<unknown>>;
    };
  };
  from(table: "catch_images"): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<StorageResult<{ id: string; storage_path: string }[]>>;
    };
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
    delete(): { in(column: string, values: string[]): PromiseLike<{ error: { message: string } | null }> };
  };
}

export interface TransferAttachment {
  storage_path: string;
  file_name: string;
  mime_type: string;
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-80) || "bild.jpg";
}

export async function transferImageToCatch(
  client: ImageTransferClient,
  args: {
    catchId: string;
    attachment: TransferAttachment;
    sourceBucket: string;
    targetBucket: string;
    replace: boolean;
    id?: () => string;
  },
): Promise<{ storagePath: string; replaced: number }> {
  if (!args.attachment.mime_type.startsWith("image/")) {
    throw new Error("Der gewählte Anhang ist kein Bild.");
  }

  const existing = await client.from("catch_images").select("id, storage_path").eq("catch_id", args.catchId);
  if (existing.error) throw new Error(`Bilder des Catches konnten nicht gelesen werden: ${existing.error.message}`);
  const current = existing.data ?? [];
  if (current.length && !args.replace) {
    throw new Error(
      `${CATCH_IMAGE_EXISTS_MARKER} Der Catch hat bereits ein Bild. Zum Ersetzen bitte bestätigen.`,
    );
  }

  const download = await client.storage.from(args.sourceBucket).download(args.attachment.storage_path);
  if (download.error || !download.data) {
    throw new Error(
      `Das Bild «${args.attachment.file_name}» konnte nicht aus dem Dossier geladen werden${
        download.error ? `: ${download.error.message}` : "."
      }`,
    );
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  if (!bytes.byteLength) throw new Error(`Das Bild «${args.attachment.file_name}» ist leer.`);

  const target = `${args.catchId}/${(args.id ?? (() => crypto.randomUUID()))()}-${safeFileName(args.attachment.file_name)}`;
  const upload = await client.storage.from(args.targetBucket).upload(target, bytes, {
    contentType: args.attachment.mime_type,
    upsert: false,
  });
  if (upload.error) {
    throw new Error(`Das Bild konnte nicht im Catch gespeichert werden: ${upload.error.message}`);
  }

  if (current.length) {
    const removed = await client.from("catch_images").delete().in("id", current.map((row) => row.id));
    if (removed.error) {
      await client.storage.from(args.targetBucket).remove([target]);
      throw new Error(`Das bisherige Bild konnte nicht ersetzt werden: ${removed.error.message}`);
    }
  }

  const inserted = await client.from("catch_images").insert({
    catch_id: args.catchId,
    storage_path: target,
    is_primary: true,
    sort_order: 0,
  });
  if (inserted.error) {
    await client.storage.from(args.targetBucket).remove([target]);
    throw new Error(`Der Bilddatensatz konnte nicht angelegt werden: ${inserted.error.message}`);
  }
  return { storagePath: target, replaced: current.length };
}
