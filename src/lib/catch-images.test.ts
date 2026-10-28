import { describe, expect, it } from "vitest";

import {
  abandonedUploads,
  addImages,
  imagesDirty,
  makePrimary,
  moveImage,
  removeImage,
  toFormImages,
  uploadsSafeToRemove,
  type CatchImageRecord,
  type CatchImageSyncClient,
} from "@/lib/catch-images";

function fakeClient(
  opts: {
    existing?: CatchImageRecord[];
    insertFails?: boolean;
    deleteFails?: boolean;
  } = {},
) {
  const state = {
    rows: [...(opts.existing ?? [])],
    removed: [] as string[],
  };
  const client: CatchImageSyncClient = {
    rpc: async () => ({ data: null, error: { message: "nicht verwendet" } }),
    storage: {
      from: () => ({
        remove: async (paths) => {
          state.removed.push(...paths);
          return { data: {}, error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({ eq: async () => ({ data: state.rows, error: null }) }),
      insert: async (rows) => {
        if (opts.insertFails) return { error: { message: "db down" } };
        for (const row of rows) {
          state.rows.push({
            id: `r${state.rows.length}`,
            storage_path: String(row["storage_path"]),
            is_primary: Boolean(row["is_primary"]),
            sort_order: Number(row["sort_order"]),
          });
        }
        return { error: null };
      },
      update: (row) => ({
        eq: async (_column, id) => {
          const target = state.rows.find((entry) => entry.id === id);
          if (target) {
            target.is_primary = Boolean(row["is_primary"]);
            target.sort_order = Number(row["sort_order"]);
          }
          return { error: null };
        },
      }),
      delete: () => ({
        in: async (_column, ids) => {
          if (opts.deleteFails) return { error: { message: "delete failed" } };
          state.rows = state.rows.filter((entry) => !ids.includes(entry.id));
          return { error: null };
        },
      }),
    }),
  };
  return { client, state };
}

const legacyRow: CatchImageRecord = {
  id: "a1",
  storage_path: "altes-bild.jpg",
  is_primary: true,
  sort_order: 0,
};

describe("Formular-Helfer", () => {
  it("lädt ein Legacy-Bild mit einem Datensatz als Hauptbild", () => {
    const images = toFormImages([legacyRow]);
    expect(images).toEqual([{ key: "a1", storagePath: "altes-bild.jpg", persistedId: "a1" }]);
  });

  it("sortiert das Hauptbild zuerst und behält die stabile Reihenfolge", () => {
    const rows: CatchImageRecord[] = [
      { id: "b", storage_path: "zweit.jpg", is_primary: false, sort_order: 1 },
      { id: "a", storage_path: "haupt.jpg", is_primary: true, sort_order: 0 },
    ];
    expect(toFormImages(rows).map((image) => image.storagePath)).toEqual([
      "haupt.jpg",
      "zweit.jpg",
    ]);
  });

  it("hängt neue Bilder an, ohne Bestehendes zu ersetzen, und überspringt Duplikate", () => {
    const start = toFormImages([legacyRow]);
    const next = addImages(start, ["neu-1.jpg", "altes-bild.jpg", "neu-2.jpg"]);
    expect(next.map((image) => image.storagePath)).toEqual([
      "altes-bild.jpg",
      "neu-1.jpg",
      "neu-2.jpg",
    ]);
  });

  it("setzt ein anderes Bild als Hauptbild an die erste Stelle", () => {
    const images = addImages(toFormImages([legacyRow]), ["neu.jpg"]);
    const next = makePrimary(images, images[1]!.key);
    expect(next[0]!.storagePath).toBe("neu.jpg");
    expect(next[1]!.storagePath).toBe("altes-bild.jpg");
  });

  it("verschiebt und entfernt einzelne Bilder", () => {
    const images = addImages(toFormImages([legacyRow]), ["neu-1.jpg", "neu-2.jpg"]);
    const moved = moveImage(images, images[2]!.key, -1);
    expect(moved.map((image) => image.storagePath)).toEqual([
      "altes-bild.jpg",
      "neu-2.jpg",
      "neu-1.jpg",
    ]);
    expect(removeImage(moved, moved[1]!.key).map((image) => image.storagePath)).toEqual([
      "altes-bild.jpg",
      "neu-1.jpg",
    ]);
  });

  it("erkennt Zusätze, Entfernungen, Reihenfolge und Hauptbild als Änderung", () => {
    const initial = [legacyRow];
    const loaded = toFormImages(initial);
    expect(imagesDirty(loaded, initial)).toBe(false);
    expect(imagesDirty(addImages(loaded, ["neu.jpg"]), initial)).toBe(true);
    expect(imagesDirty([], initial)).toBe(true);

    const twoRows: CatchImageRecord[] = [
      legacyRow,
      { id: "a2", storage_path: "zweit.jpg", is_primary: false, sort_order: 1 },
    ];
    const twoLoaded = toFormImages(twoRows);
    expect(imagesDirty(moveImage(twoLoaded, twoLoaded[1]!.key, -1), twoRows)).toBe(true);
    expect(imagesDirty(makePrimary(twoLoaded, twoLoaded[1]!.key), twoRows)).toBe(true);
  });

  it("räumt nur frisch hochgeladene, nicht übernommene Objekte auf", () => {
    const images = addImages(toFormImages([legacyRow]), ["behalten.jpg"]);
    expect(abandonedUploads(["behalten.jpg", "verworfen.jpg"], images)).toEqual(["verworfen.jpg"]);
  });
});

// syncCatchImages: siehe catch-images-sync-db.test.ts (echtes PostgreSQL, echter Hauptbild-Index).

describe("uploadsSafeToRemove", () => {
  it("behält Pfade, die inzwischen von catch_images referenziert werden", () => {
    expect(uploadsSafeToRemove(["frisch-a.jpg", "frisch-b.jpg"], ["frisch-a.jpg"])).toEqual([
      "frisch-b.jpg",
    ]);
  });

  it("löscht nichts, wenn alle Sitzungs-Uploads bereits gespeichert sind", () => {
    expect(uploadsSafeToRemove(["frisch.jpg"], ["frisch.jpg", "alt.jpg"])).toEqual([]);
  });

  it("Teilerfolg dann Verwerfen: gespeicherte Sitzungs-Uploads bleiben erhalten", async () => {
    // Ein Bild wurde bereits gespeichert (Teilerfolg), danach schlug ein
    // weiteres Einfügen fehl; der Nutzer verwirft. Beim Aufräumen dürfen
    // nur nicht-referenzierte Pfade gelöscht werden.

    // Simuliert den Teilerfolg: Datensatz existiert trotz Fehler.
    const persisted: CatchImageRecord = {
      id: "r9",
      storage_path: "schon-da.jpg",
      is_primary: false,
      sort_order: 1,
    };
    const pending = ["schon-da.jpg", "nie-gespeichert.jpg"];
    const safe = uploadsSafeToRemove(
      pending,
      [legacyRow, persisted].map((row) => row.storage_path),
    );
    expect(safe).toEqual(["nie-gespeichert.jpg"]);
  });
});
