// @vitest-environment happy-dom
/**
 * Gerenderte Regressionstests für das zweite Produktbild unter React
 * StrictMode (wie im Vorschau-Dev-Build: Effekte werden doppelt ausgeführt).
 * Speicher, Signieren und Bild-Ladeereignisse sind gemockt.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------- In-Memory-Backend ----------
interface Row {
  id: string;
  catch_id: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
}
const db = vi.hoisted(() => ({
  objects: new Map<string, { contentType: string | undefined; size: number }>(),
  rows: [] as Row[],
  uploads: [] as { path: string; contentType: string | undefined }[],
  removed: [] as string[],
  signCalls: [] as string[],
  failSign: new Map<string, number>(),
  deleteAfterUpload: false,
  nextId: 1,
}));

vi.mock("@/integrations/supabase/client", () => {
  const bucket = {
    upload: async (path: string, file: File, options?: { contentType?: string }) => {
      const contentType = options?.contentType ?? file.type;
      db.objects.set(path, { contentType, size: file.size });
      db.uploads.push({ path, contentType });
      if (db.deleteAfterUpload) db.objects.delete(path);
      return { data: { path }, error: null };
    },
    remove: async (paths: string[]) => {
      for (const path of paths) {
        db.objects.delete(path);
        db.removed.push(path);
      }
      return { data: [], error: null };
    },
    createSignedUrl: async (path: string) => {
      db.signCalls.push(path);
      const remaining = db.failSign.get(path) ?? 0;
      if (remaining > 0) {
        db.failSign.set(path, remaining - 1);
        return { data: null, error: { message: "Netzwerkfehler" } };
      }
      if (!db.objects.has(path)) return { data: null, error: { message: "Object not found" } };
      return { data: { signedUrl: `https://signed.test/${path}?n=${db.signCalls.length}` }, error: null };
    },
  };
  const table = {
    select: () => ({
      eq: async (_column: string, value: string) => ({
        data: db.rows.filter((row) => row.catch_id === value).map((row) => ({ ...row })),
        error: null,
      }),
    }),
    insert: async (rows: Omit<Row, "id">[]) => {
      for (const row of rows) db.rows.push({ ...row, id: `row-${db.nextId++}` });
      return { error: null };
    },
    update: (patch: Partial<Row>) => ({
      eq: async (_column: string, id: string) => {
        const row = db.rows.find((entry) => entry.id === id);
        if (row) Object.assign(row, patch);
        return { error: null };
      },
    }),
    delete: () => ({
      in: async (_column: string, ids: string[]) => {
        db.rows = db.rows.filter((row) => !ids.includes(row.id));
        return { error: null };
      },
    }),
  };
  return {
    supabase: {
      storage: { from: () => bucket },
      from: () => table,
    },
  };
});

import { CatchImagesField } from "@/components/catch/catch-image-field";
import { useSessionUploads } from "@/hooks/use-session-uploads";
import { supabase } from "@/integrations/supabase/client";
import {
  abandonedUploads,
  cleanupAbandonedUploads,
  removeStorageObjects,
  syncCatchImages,
  toFormImages,
  type CatchImageRecord,
  type CatchImageSyncClient,
  type FormCatchImage,
} from "@/lib/catch-images";
import { CATCH_IMAGE_BUCKET } from "@/lib/catches";

const client = supabase as unknown as CatchImageSyncClient;
const CATCH_ID = "catch-1";

/** Gleiche Besitz-/Speicherlogik wie CatchForm, ohne das ganze Formular. */
function Harness({ initialRows }: { initialRows: CatchImageRecord[] }) {
  const [images, setImages] = useState<FormCatchImage[]>(() => toFormImages(initialRows));
  const uploads = useSessionUploads((pending) =>
    cleanupAbandonedUploads(client, CATCH_ID, pending).then(() => undefined),
  );
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <CatchImagesField images={images} onChange={setImages} onUploaded={uploads.register} />
      <button
        type="button"
        onClick={async () => {
          await syncCatchImages(client, CATCH_ID, images, initialRows.map((row) => row.id));
          await removeStorageObjects(
            client,
            CATCH_IMAGE_BUCKET,
            abandonedUploads(uploads.pending(), images),
          );
          uploads.clear();
          setSaved(true);
        }}
      >
        Speichern
      </button>
      {saved ? <p>gespeichert</p> : null}
    </div>
  );
}

function renderStrict(initialRows: CatchImageRecord[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Harness initialRows={initialRows} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

function jpeg(name = "WhatsApp Image 2026-10-23 at 15.14.37.jpeg") {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], name, {
    type: "image/jpeg",
  });
}

async function chooseFiles(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    fireEvent.change(input);
  });
}

function seedOriginal(): CatchImageRecord[] {
  db.objects.set("original.jpg", { contentType: "image/jpeg", size: 10 });
  const row: Row = {
    id: "row-original",
    catch_id: CATCH_ID,
    storage_path: "original.jpg",
    is_primary: true,
    sort_order: 0,
  };
  db.rows.push(row);
  return [{ ...row }];
}

const flushTimers = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

beforeEach(() => {
  db.objects.clear();
  db.rows = [];
  db.uploads = [];
  db.removed = [];
  db.signCalls = [];
  db.failSign.clear();
  db.deleteAfterUpload = false;
  db.nextId = 1;
  (URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = () =>
    "blob:local-preview";
  (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = () => {};
});
afterEach(() => cleanup());

describe("Zweites Produktbild unter StrictMode", () => {
  it("behält das Original, löscht den neuen Upload trotz Effekt-Replay nicht und speichert beide", async () => {
    const initialRows = seedOriginal();
    const { container, unmount } = renderStrict(initialRows);

    await chooseFiles(container, [jpeg()]);
    await flushTimers();

    // Upload: richtiger Pfad und MIME-Typ, Objekt existiert noch.
    expect(db.uploads).toHaveLength(1);
    const uploaded = db.uploads[0]!;
    expect(uploaded.path).toMatch(/\.jpeg$/);
    expect(uploaded.contentType).toBe("image/jpeg");
    expect(db.objects.has(uploaded.path)).toBe(true);
    expect(db.removed).toEqual([]);

    // Beide Vorschauen zeigen signierte URLs des gespeicherten Objekts.
    await waitFor(() => {
      const second = screen.getByAltText("Produktbild 2") as HTMLImageElement;
      expect(second.getAttribute("src")).toContain(`https://signed.test/${uploaded.path}`);
    });
    expect((screen.getByAltText("Produktbild 1") as HTMLImageElement).getAttribute("src")).toContain(
      "original.jpg",
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    });
    await screen.findByText("gespeichert");

    // Speichern: Original Hauptbild, neues Bild an Position 2.
    expect(
      db.rows
        .filter((row) => row.catch_id === CATCH_ID)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((row) => [row.storage_path, row.is_primary]),
    ).toEqual([
      ["original.jpg", true],
      [uploaded.path, false],
    ]);

    // Verlassen nach Erfolg löscht nichts.
    unmount();
    await flushTimers();
    expect(db.removed).toEqual([]);

    // Neu laden: beide Bilder in Reihenfolge, beide signierbar.
    const reloaded = db.rows.map((row) => ({ ...row }));
    renderStrict(reloaded);
    await waitFor(() => {
      expect((screen.getByAltText("Produktbild 2") as HTMLImageElement).getAttribute("src")).toContain(
        uploaded.path,
      );
    });
    expect(screen.queryByText("Bild konnte nicht geladen werden")).toBeNull();
  });

  it("echtes Verwerfen löscht nur nicht übernommene Sitzungs-Uploads", async () => {
    const initialRows = seedOriginal();
    const { container, unmount } = renderStrict(initialRows);
    await chooseFiles(container, [jpeg("neu.jpg")]);
    await flushTimers();
    const uploaded = db.uploads[0]!.path;
    expect(db.objects.has(uploaded)).toBe(true);

    unmount();
    await flushTimers();
    await flushTimers();

    expect(db.removed).toEqual([uploaded]);
    expect(db.objects.has("original.jpg")).toBe(true);
    expect(db.rows.map((row) => row.storage_path)).toEqual(["original.jpg"]);
  });

  it("räumt einen nach echtem Unmount fertig gewordenen Upload sicher auf", async () => {
    let registerLate: ((path: string) => void) | undefined;
    function LateHarness() {
      const uploads = useSessionUploads((pending) =>
        cleanupAbandonedUploads(client, CATCH_ID, pending).then(() => undefined),
      );
      registerLate = uploads.register;
      return null;
    }
    db.objects.set("spaet.jpg", { contentType: "image/jpeg", size: 1 });
    seedOriginal();
    const { unmount } = render(
      <StrictMode>
        <LateHarness />
      </StrictMode>,
    );
    unmount();
    await flushTimers();
    expect(db.removed).toEqual([]);

    registerLate!("spaet.jpg");
    await flushTimers();
    await flushTimers();
    expect(db.removed).toEqual(["spaet.jpg"]);
    expect(db.objects.has("original.jpg")).toBe(true);
  });

  it("zeigt bei Signierfehler eine klare Meldung und lädt mit neuer URL erneut", async () => {
    const initialRows = seedOriginal();
    // Erster Versuch + automatischer Wiederholversuch scheitern.
    db.failSign.set("original.jpg", 2);
    renderStrict(initialRows);

    // Ein Wiederholversuch des Signierens, dann klare Meldung (kein Dauerspinner).
    await screen.findByText("Bild konnte nicht geladen werden", undefined, { timeout: 4000 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Erneut laden" }));
    });
    await waitFor(() => {
      expect(screen.getByAltText("Produktbild 1").getAttribute("src")).toContain("original.jpg");
    });
    expect(screen.queryByText("Bild konnte nicht geladen werden")).toBeNull();
  });

  it("zeigt bei <img>-Ladefehler eine klare Meldung und holt eine frische signierte URL", async () => {
    const initialRows = seedOriginal();
    renderStrict(initialRows);
    const img = await screen.findByAltText("Produktbild 1");
    const firstSrc = img.getAttribute("src");
    const callsBefore = db.signCalls.length;

    await act(async () => {
      fireEvent.error(img);
    });
    await screen.findByText("Bild konnte nicht geladen werden");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Erneut laden" }));
    });
    await waitFor(() => {
      const fresh = screen.getByAltText("Produktbild 1").getAttribute("src");
      expect(fresh).toContain("original.jpg");
      expect(fresh).not.toBe(firstSrc);
    });
    expect(db.signCalls.length).toBeGreaterThan(callsBefore);
  });

  it("macht ein gelöschtes Objekt sichtbar statt es hinter der lokalen Vorschau zu verstecken", async () => {
    // Modelliert den alten Fehler: Objekt wird direkt nach dem Upload gelöscht.
    db.deleteAfterUpload = true;
    const { container } = renderStrict([]);
    await chooseFiles(container, [jpeg("weg.jpg")]);
    await screen.findByText("Bild konnte nicht geladen werden", undefined, { timeout: 4000 });
  });
});
