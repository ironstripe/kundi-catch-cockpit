import { describe, expect, it } from "vitest";

import {
  CATCH_IMAGE_EXISTS_MARKER,
  transferImageToCatch,
  type ImageTransferClient,
} from "@/lib/offer-image-transfer";

function fakeClient(opts: {
  existing?: { id: string; storage_path: string }[];
  downloadFails?: boolean;
  uploadFailsTimes?: number;
  insertFails?: boolean;
}) {
  const state = {
    uploads: [] as string[],
    removed: [] as string[],
    rows: [...(opts.existing ?? [])] as { id: string; storage_path: string }[],
    uploadFails: opts.uploadFailsTimes ?? 0,
  };
  const client: ImageTransferClient = {
    storage: {
      from: () => ({
        download: async () =>
          opts.downloadFails
            ? { data: null, error: { message: "not found" } }
            : { data: new Blob([new Uint8Array([1, 2, 3])]), error: null },
        upload: async (path) => {
          if (state.uploadFails > 0) {
            state.uploadFails -= 1;
            return { data: null, error: { message: "Speicher nicht erreichbar" } };
          }
          state.uploads.push(path);
          return { data: {}, error: null };
        },
        remove: async (paths) => {
          state.removed.push(...paths);
          return { data: {}, error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({ eq: async () => ({ data: state.rows, error: null }) }),
      insert: async (row) => {
        if (opts.insertFails) return { error: { message: "db down" } };
        state.rows.push({ id: `r${state.rows.length}`, storage_path: String(row["storage_path"]) });
        return { error: null };
      },
      delete: () => ({
        in: async (_c, ids) => {
          state.rows = state.rows.filter((row) => !ids.includes(row.id));
          return { error: null };
        },
      }),
    }),
  };
  return { client, state };
}

const attachment = { storage_path: "o/a.jpg", file_name: "Crevetten 2.jpg", mime_type: "image/jpeg" };
const base = { catchId: "c1", attachment, sourceBucket: "s", targetBucket: "t", replace: false, id: () => "x" };

describe("transferImageToCatch", () => {
  it("überträgt das gewählte Bild und legt den Datensatz an", async () => {
    const { client, state } = fakeClient({});
    const result = await transferImageToCatch(client, base);
    expect(result.storagePath).toBe("c1/x-Crevetten_2.jpg");
    expect(state.rows).toHaveLength(1);
  });

  it("meldet einen fehlgeschlagenen Upload und klappt beim erneuten Versuch", async () => {
    const { client, state } = fakeClient({ uploadFailsTimes: 1 });
    await expect(transferImageToCatch(client, base)).rejects.toThrow(/nicht im Catch gespeichert/);
    expect(state.rows).toHaveLength(0);
    await transferImageToCatch(client, base);
    expect(state.rows).toHaveLength(1);
  });

  it("meldet einen fehlgeschlagenen Download", async () => {
    const { client } = fakeClient({ downloadFails: true });
    await expect(transferImageToCatch(client, base)).rejects.toThrow(/nicht aus dem Dossier/);
  });

  it("räumt den Upload auf, wenn der Datensatz nicht angelegt wird", async () => {
    const { client, state } = fakeClient({ insertFails: true });
    await expect(transferImageToCatch(client, base)).rejects.toThrow(/Bilddatensatz/);
    expect(state.removed).toEqual(["c1/x-Crevetten_2.jpg"]);
  });

  it("überschreibt ein bestehendes Bild nur mit Bestätigung", async () => {
    const { client, state } = fakeClient({ existing: [{ id: "old", storage_path: "old.jpg" }] });
    await expect(transferImageToCatch(client, base)).rejects.toThrow(CATCH_IMAGE_EXISTS_MARKER);
    const result = await transferImageToCatch(client, { ...base, replace: true });
    expect(result.replaced).toBe(1);
    expect(state.rows.map((row) => row.id)).not.toContain("old");
  });

  it("lehnt Nicht-Bilder ab", async () => {
    const { client } = fakeClient({});
    await expect(
      transferImageToCatch(client, { ...base, attachment: { ...attachment, mime_type: "application/pdf" } }),
    ).rejects.toThrow(/kein Bild/);
  });
});
