/**
 * Bild-Synchronisation gegen echtes PostgreSQL (PGlite) mit dem echten
 * eindeutigen Hauptbild-Index und der echten Migration — keine Produktionsdaten.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  addImages,
  makePrimary,
  removeImage,
  syncCatchImages,
  toFormImages,
  type CatchImageRecord,
  type CatchImageSyncClient,
} from "@/lib/catch-images";

const CATCH = "00000000-0000-0000-0000-00000000c001";
const OTHER = "00000000-0000-0000-0000-00000000c002";
const db = new PGlite();
const migration = readdirSync("drizzle/migrations").find((f) => f.includes("atomic_catch_image_sync"))!;

beforeAll(async () => {
  await db.exec(`
    CREATE FUNCTION public.can_edit() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.edit', true), 'true') = 'true' $$;
    CREATE TABLE public.catches (id uuid PRIMARY KEY);
    CREATE TABLE public.catch_images (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      catch_id uuid NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
      storage_path text NOT NULL CHECK (storage_path <> 'kaputt.jpg'),
      is_primary boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX idx_catch_images_one_primary ON public.catch_images (catch_id) WHERE is_primary;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    INSERT INTO public.catches VALUES ('${CATCH}'), ('${OTHER}');
  `);
  await db.exec(readFileSync(`drizzle/migrations/${migration}`, "utf8"));
}, 30000);
afterAll(() => db.close());

const removedObjects: string[] = [];
let rpcThrows = false;
const client = {
  storage: {
    from: () => ({
      remove: async (paths: string[]) => {
        removedObjects.push(...paths);
        return { error: null };
      },
    }),
  },
  rpc: async (_fn: string, args: { _catch_id: string; _images: unknown; _baseline_ids: string[] }) => {
    if (rpcThrows) throw new Error("Netzwerk unterbrochen");
    try {
      const res = await db.query<{ r: never }>(
        "SELECT public.sync_catch_images($1::uuid, $2::jsonb, $3::uuid[]) AS r",
        [args._catch_id, JSON.stringify(args._images), args._baseline_ids],
      );
      return { data: res.rows[0]!.r, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },
} as unknown as CatchImageSyncClient;

async function rows(catchId = CATCH): Promise<CatchImageRecord[]> {
  const res = await db.query<CatchImageRecord>(
    "SELECT id, storage_path, is_primary, sort_order FROM catch_images WHERE catch_id=$1 ORDER BY sort_order",
    [catchId],
  );
  return res.rows;
}
async function seed(paths: string[], catchId = CATCH) {
  for (const [i, p] of paths.entries()) {
    await db.query(
      "INSERT INTO catch_images (catch_id, storage_path, is_primary, sort_order) VALUES ($1,$2,$3,$4)",
      [catchId, p, i === 0, i],
    );
  }
  return rows(catchId);
}
const ids = (r: CatchImageRecord[]) => r.map((x) => x.id);

beforeEach(async () => {
  await db.exec("DELETE FROM catch_images; SET test.edit = 'true';");
  removedObjects.length = 0;
  rpcThrows = false;
});

describe("sync_catch_images (echter Hauptbild-Index)", () => {
  it("wechselt das Hauptbild auf ein bestehendes Bild", async () => {
    const before = await seed(["eins.jpg", "zwei.jpg"]);
    await syncCatchImages(client, CATCH, makePrimary(toFormImages(before), before[1]!.id), ids(before));
    const after = await rows();
    expect(after.map((r) => [r.storage_path, r.is_primary, r.sort_order])).toEqual([
      ["zwei.jpg", true, 0],
      ["eins.jpg", false, 1],
    ]);
    expect(removedObjects).toEqual([]);
  });

  it("ersetzt ein entferntes Hauptbild durch einen neuen Upload", async () => {
    const before = await seed(["alt.jpg"]);
    const desired = addImages(removeImage(toFormImages(before), before[0]!.id), ["neu.jpg"]);
    const result = await syncCatchImages(client, CATCH, desired, ids(before));
    expect(result).toEqual({ inserted: 1, updated: 0, removed: 1 });
    expect((await rows()).map((r) => [r.storage_path, r.is_primary])).toEqual([["neu.jpg", true]]);
    expect(removedObjects).toEqual(["alt.jpg"]);
  });

  it("neuer Upload als Hauptbild vor bestehendem Bild", async () => {
    const before = await seed(["alt.jpg"]);
    const desired = makePrimary(addImages(toFormImages(before), ["neu.jpg"]), "new:neu.jpg");
    await syncCatchImages(client, CATCH, desired, ids(before));
    expect((await rows()).map((r) => [r.storage_path, r.is_primary])).toEqual([
      ["neu.jpg", true],
      ["alt.jpg", false],
    ]);
  });

  it("fügt ein Zweitbild hinzu und entfernt ein Zweitbild", async () => {
    const before = await seed(["eins.jpg"]);
    await syncCatchImages(client, CATCH, addImages(toFormImages(before), ["zwei.jpg"]), ids(before));
    const two = await rows();
    expect(two.map((r) => [r.storage_path, r.is_primary])).toEqual([
      ["eins.jpg", true],
      ["zwei.jpg", false],
    ]);
    await syncCatchImages(client, CATCH, removeImage(toFormImages(two), two[1]!.id), ids(two));
    expect((await rows()).map((r) => r.storage_path)).toEqual(["eins.jpg"]);
    expect(removedObjects).toEqual(["zwei.jpg"]);
  });

  it("Retry ist idempotent und legt keine Duplikate an", async () => {
    const before = await seed(["eins.jpg"]);
    const desired = addImages(toFormImages(before), ["neu.jpg"]);
    await syncCatchImages(client, CATCH, desired, ids(before));
    const second = await syncCatchImages(client, CATCH, desired, ids(before));
    expect(second.inserted).toBe(0);
    expect((await rows()).map((r) => r.storage_path)).toEqual(["eins.jpg", "neu.jpg"]);
  });

  it("rollt bei Fehler alles zurück und behält alle Speicherobjekte", async () => {
    const before = await seed(["alt.jpg", "zwei.jpg"]);
    const desired = addImages(removeImage(toFormImages(before), before[0]!.id), ["kaputt.jpg"]);
    await expect(syncCatchImages(client, CATCH, desired, ids(before))).rejects.toThrow(
      /nicht gespeichert/,
    );
    expect(await rows()).toEqual(before);
    expect(removedObjects).toEqual([]);
  });

  it("unklarer Ausgang (Netzwerkfehler) löscht keine Speicherobjekte", async () => {
    const before = await seed(["alt.jpg"]);
    rpcThrows = true;
    await expect(
      syncCatchImages(client, CATCH, removeImage(toFormImages(before), before[0]!.id), ids(before)),
    ).rejects.toThrow(/Netzwerk/);
    expect(removedObjects).toEqual([]);
  });

  it("erhält nebenläufig hinzugefügte, dem Editor unbekannte Bilder", async () => {
    const before = await seed(["eins.jpg"]);
    await db.query(
      "INSERT INTO catch_images (catch_id, storage_path, is_primary, sort_order) VALUES ($1,'parallel.jpg',false,1)",
      [CATCH],
    );
    await syncCatchImages(client, CATCH, removeImage(toFormImages(before), before[0]!.id).concat(
      addImages([], ["neu.jpg"]),
    ), ids(before));
    const after = await rows();
    expect(after.map((r) => r.storage_path).sort()).toEqual(["neu.jpg", "parallel.jpg"]);
    expect(after.filter((r) => r.is_primary).map((r) => r.storage_path)).toEqual(["neu.jpg"]);
  });

  it("weist fremde Bild-Ids und fremde Pfade zurück", async () => {
    const foreign = await seed(["fremd.jpg"], OTHER);
    await expect(
      syncCatchImages(client, CATCH, toFormImages(foreign), []),
    ).rejects.toThrow(/gehört nicht/);
    await expect(
      syncCatchImages(client, CATCH, addImages([], ["fremd.jpg"]), []),
    ).rejects.toThrow(/anderen Catch/);
    await expect(
      syncCatchImages(client, CATCH, addImages([], ["../x.jpg"]), []),
    ).rejects.toThrow(/Ungültiger Bildpfad/);
    expect(await rows(OTHER)).toEqual(foreign);
  });

  it("verweigert ohne Bearbeitungsrecht und ändert nichts", async () => {
    const before = await seed(["eins.jpg"]);
    await db.exec("SET test.edit = 'false'");
    await expect(
      syncCatchImages(client, CATCH, addImages(toFormImages(before), ["neu.jpg"]), ids(before)),
    ).rejects.toThrow(/Keine Berechtigung/);
    expect(await rows()).toEqual(before);
  });
});
