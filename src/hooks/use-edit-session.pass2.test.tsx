// @vitest-environment happy-dom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseTitleEditor } from "@/components/offers/case-title-editor";
import { UnsavedChangesDialog, useUnsavedChangesGuard } from "@/hooks/use-edit-session";
import { useSyncedDraft } from "@/hooks/use-synced-draft";
import { ordinarySaveLabel, ordinarySaveStatus } from "@/lib/catch-save-intent";

afterEach(() => cleanup());
const ctrlEnter = { key: "Enter", ctrlKey: true };

describe("Catch: gewöhnliches Speichern", () => {
  it("neu → Entwurf, Entwurf bleibt Entwurf, Bereit bleibt Bereit, nie Entwurf → Bereit", () => {
    expect(ordinarySaveStatus("create", undefined)).toBe("draft");
    expect(ordinarySaveStatus("edit", "draft")).toBe("draft");
    expect(ordinarySaveStatus("edit", "ready")).toBe("ready");
    expect(ordinarySaveStatus("edit", "published")).toBe("draft"); // saveCatch hält «published»
    expect(ordinarySaveLabel("create", undefined)).toBe("Als Entwurf speichern");
    expect(ordinarySaveLabel("edit", "draft")).toBe("Als Entwurf speichern");
    expect(ordinarySaveLabel("edit", "ready")).toBe("Änderungen speichern");
  });
});

describe("CaseTitleEditor bei laufendem/fehlerhaftem Speichern", () => {
  it("Esc während des Speicherns schliesst nicht", async () => {
    let resolve: (ok: boolean) => void = () => {};
    const onSave = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
    render(<CaseTitleEditor title="Alt" onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Titel ändern/ }));
    const input = screen.getByLabelText("Titel des Angebotsdossiers");
    fireEvent.change(input, { target: { value: "Neu" } });
    fireEvent.keyDown(input, ctrlEnter);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByLabelText("Titel des Angebotsdossiers")).toBeTruthy();
    await act(async () => resolve(true));
    expect(screen.queryByLabelText("Titel des Angebotsdossiers")).toBeNull();
  });

  it("abgelehnter Speicher-Promise behält Entwurf und sperrt den erneuten Versuch nicht", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("netz")).mockResolvedValueOnce(true);
    render(<CaseTitleEditor title="Alt" onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Titel ändern/ }));
    const input = screen.getByLabelText("Titel des Angebotsdossiers");
    fireEvent.change(input, { target: { value: "Neu" } });
    await act(async () => {
      fireEvent.keyDown(input, ctrlEnter);
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Titel des Angebotsdossiers") as HTMLInputElement).value).toBe(
      "Neu",
    );
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("Titel des Angebotsdossiers"), ctrlEnter);
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("Titel des Angebotsdossiers")).toBeNull();
  });
});

describe("useSyncedDraft (Dossierfelder, WhatsApp-/Instagram-Text)", () => {
  it("gleiches Objekt: Refetch behält lokale Änderung und den Öffnungsstand für Esc", () => {
    const { result, rerender } = renderHook(({ id, server }) => useSyncedDraft(id, server), {
      initialProps: { id: "A", server: "v1" },
    });
    act(() => result.current.setValue("lokal"));
    rerender({ id: "A", server: "v2" });
    expect(result.current.value).toBe("lokal");
    expect(result.current.dirty).toBe(true);
    act(() => result.current.restoreOpening());
    expect(result.current.value).toBe("v1");
  });

  it("gleiches Objekt, unbearbeitet: Refetch übernimmt Serverwert", () => {
    const { result, rerender } = renderHook(({ id, server }) => useSyncedDraft(id, server), {
      initialProps: { id: "A", server: "v1" },
    });
    rerender({ id: "A", server: "v2" });
    expect(result.current.value).toBe("v2");
  });

  it("anderes Objekt: harter Reset, keine Werte aus A in B", () => {
    const { result, rerender } = renderHook(({ id, server }) => useSyncedDraft(id, server), {
      initialProps: { id: "A", server: "a" },
    });
    act(() => result.current.setValue("lokal A"));
    rerender({ id: "B", server: "b" });
    expect(result.current.value).toBe("b");
    expect(result.current.dirty).toBe(false);
  });

  it("nach Erfolg: Eingaben nach dem Absenden bleiben; ohne Erfolg setzt kein Refetch zurück", () => {
    const { result, rerender } = renderHook(({ id, server }) => useSyncedDraft(id, server), {
      initialProps: { id: "A", server: "v1" },
    });
    act(() => result.current.setValue("gesendet"));
    // unabhängiger Refetch während des (später fehlschlagenden) Speicherns
    rerender({ id: "A", server: "fremd" });
    expect(result.current.value).toBe("gesendet");
    act(() => result.current.setValue("gesendet + mehr"));
    act(() => result.current.markSaved("gesendet"));
    rerender({ id: "A", server: "gesendet" });
    expect(result.current.value).toBe("gesendet + mehr");
  });
});

function GuardedPage() {
  const [titleDirty, setTitleDirty] = useState(false);
  const [instagramDirty, setInstagramDirty] = useState(false);
  const guard = useUnsavedChangesGuard(titleDirty || instagramDirty);
  return (
    <div>
      <CaseTitleEditor title="Alt" onSave={async () => true} onDirtyChange={setTitleDirty} />
      <button type="button" onClick={() => setInstagramDirty(true)}>
        Instagram bearbeiten
      </button>
      <Link to={"/other" as "/"}>Weg</Link>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

function renderGuarded() {
  const root = createRootRoute();
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/", component: GuardedPage }),
      createRoute({ getParentRoute: () => root, path: "/other", component: () => <p>Andere</p> }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("Seiten-Guard mit aggregierten Quellen", () => {
  it("reine Titeländerung blockiert die Navigation", async () => {
    renderGuarded();
    fireEvent.click(await screen.findByRole("button", { name: /Titel ändern/ }));
    fireEvent.change(screen.getByLabelText("Titel des Angebotsdossiers"), {
      target: { value: "Neu" },
    });
    fireEvent.click(screen.getByText("Weg"));
    expect(await screen.findByText("Ungespeicherte Änderungen verwerfen?")).toBeTruthy();
    expect(screen.getAllByText("Ungespeicherte Änderungen verwerfen?")).toHaveLength(1);
  });

  it("bearbeiteter Instagram-Text blockiert die Navigation", async () => {
    renderGuarded();
    fireEvent.click(await screen.findByText("Instagram bearbeiten"));
    fireEvent.click(screen.getByText("Weg"));
    expect(await screen.findByText("Ungespeicherte Änderungen verwerfen?")).toBeTruthy();
  });
});

describe("Korrekturen: Quittung und Unmount", () => {
  it("normalisierte Speicherung wird quittiert, auch bei gleichem Serverwert/gleicher Referenz", () => {
    const server = { qty: "1" };
    const { result, rerender } = renderHook(({ id, s }) => useSyncedDraft(id, s), {
      initialProps: { id: "A", s: server },
    });
    act(() => result.current.setValue({ qty: "1.0" }));
    expect(result.current.dirty).toBe(true);
    // Refetch liefert dieselbe Referenz (Structural Sharing) → Effekt läuft nicht.
    rerender({ id: "A", s: server });
    act(() => result.current.reconcileSaved({ qty: "1.0" }, { qty: "1" }));
    expect(result.current.value).toEqual({ qty: "1" });
    expect(result.current.dirty).toBe(false);
  });

  it("Quittung verwirft keine Eingaben nach dem Absenden", () => {
    const { result } = renderHook(() => useSyncedDraft("A", "1"));
    act(() => result.current.setValue("1.0 mehr"));
    act(() => result.current.reconcileSaved("1.0", "1"));
    expect(result.current.value).toBe("1.0 mehr");
  });

  it("ausgeblendeter Editor entfernt seinen Dirty-Beitrag (kein Guard ohne Editor)", async () => {
    function Page() {
      const [show, setShow] = useState(true);
      const [dirty, setDirty] = useState(false);
      return (
        <div>
          {show ? (
            <CaseTitleEditor title="Alt" onSave={async () => true} onDirtyChange={setDirty} />
          ) : null}
          <button type="button" onClick={() => setShow(false)}>
            ausblenden
          </button>
          <p>dirty:{String(dirty)}</p>
        </div>
      );
    }
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /Titel ändern/ }));
    fireEvent.change(screen.getByLabelText("Titel des Angebotsdossiers"), {
      target: { value: "Neu" },
    });
    expect(screen.getByText("dirty:true")).toBeTruthy();
    fireEvent.click(screen.getByText("ausblenden"));
    expect(await screen.findByText("dirty:false")).toBeTruthy();
  });
});
