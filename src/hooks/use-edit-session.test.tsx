// @vitest-environment happy-dom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
  useNavigate,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseTitleEditor } from "@/components/offers/case-title-editor";
import {
  UnsavedChangesDialog,
  useEditShortcuts,
  useUnsavedChangesGuard,
} from "@/hooks/use-edit-session";

afterEach(() => cleanup());

const ctrlEnter = { key: "Enter", ctrlKey: true };

describe("CaseTitleEditor (Stift-Bearbeitung)", () => {
  it("fokussiert sofort, Ctrl+Enter speichert genau einmal, Esc speichert nie", async () => {
    let resolve: (ok: boolean) => void = () => {};
    const onSave = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
    render(<CaseTitleEditor title="Alt" onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Titel ändern/ }));
    const input = screen.getByLabelText("Titel des Angebotsdossiers");
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "Neu" } });
    fireEvent.keyDown(input, ctrlEnter);
    fireEvent.keyDown(input, ctrlEnter);
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Neu");
    await act(async () => resolve(true));
    expect(screen.queryByLabelText("Titel des Angebotsdossiers")).toBeNull();
  });

  it("bleibt bei Fehler offen und behält den Wert für den erneuten Versuch", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<CaseTitleEditor title="Alt" onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Titel ändern/ }));
    const input = screen.getByLabelText("Titel des Angebotsdossiers");
    fireEvent.change(input, { target: { value: "Retry" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    });
    expect(screen.getByRole("alert").textContent).toMatch(/fehlgeschlagen/);
    expect((screen.getByLabelText("Titel des Angebotsdossiers") as HTMLInputElement).value).toBe(
      "Retry",
    );
  });

  it("Esc verwirft ohne Speichern und stellt den Öffnungswert wieder her", () => {
    const onSave = vi.fn();
    render(<CaseTitleEditor title="Alt" onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Titel ändern/ }));
    const input = screen.getByLabelText("Titel des Angebotsdossiers");
    fireEvent.change(input, { target: { value: "Verworfen" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Titel ändern/ }));
    expect((screen.getByLabelText("Titel des Angebotsdossiers") as HTMLInputElement).value).toBe(
      "Alt",
    );
  });
});

function Scope({
  name,
  onCommit,
  onCancel,
  children,
}: {
  name: string;
  onCommit: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}) {
  const scope = useEditShortcuts({ onCommit, ...(onCancel ? { onCancel } : {}) });
  return (
    <div {...scope}>
      <textarea aria-label={name} />
      {children}
    </div>
  );
}

describe("useEditShortcuts Scoping", () => {
  it("verschachtelte Bearbeitung löst nur ihre eigene Aktion aus", () => {
    const parent = vi.fn();
    const child = vi.fn();
    const childCancel = vi.fn();
    render(
      <Scope name="outer" onCommit={parent}>
        <Scope name="inner" onCommit={child} onCancel={childCancel} />
      </Scope>,
    );
    fireEvent.keyDown(screen.getByLabelText("inner"), ctrlEnter);
    fireEvent.keyDown(screen.getByLabelText("inner"), { key: "Escape" });
    expect(child).toHaveBeenCalledTimes(1);
    expect(childCancel).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();
  });

  it("ignoriert Wiederholung, IME-Komposition und offene Overlays", () => {
    const commit = vi.fn();
    render(<Scope name="text" onCommit={commit} />);
    const el = screen.getByLabelText("text");
    fireEvent.keyDown(el, { ...ctrlEnter, repeat: true });
    fireEvent.keyDown(el, { ...ctrlEnter, isComposing: true });
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("data-state", "open");
    document.body.appendChild(overlay);
    fireEvent.keyDown(el, ctrlEnter);
    overlay.remove();
    expect(commit).not.toHaveBeenCalled();
    fireEvent.keyDown(el, ctrlEnter);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("Esc ohne Abbruch-Handler (Mehrfeldformular) schreibt nichts", () => {
    const commit = vi.fn();
    render(<Scope name="form" onCommit={commit} />);
    fireEvent.keyDown(screen.getByLabelText("form"), { key: "Escape" });
    expect(commit).not.toHaveBeenCalled();
  });
});

function EditorPage() {
  const [value, setValue] = useState("");
  const guard = useUnsavedChangesGuard(value !== "");
  const navigate = useNavigate();
  return (
    <div>
      <input aria-label="feld" value={value} onChange={(e) => setValue(e.target.value)} />
      <Link to={"/other" as "/"}>Weg</Link>
      <button
        type="button"
        onClick={() => {
          guard.allowNextNavigation();
          void navigate({ to: "/other" as "/" });
        }}
      >
        Speichern
      </button>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

function makeRouter() {
  const root = createRootRoute();
  const edit = createRoute({ getParentRoute: () => root, path: "/", component: EditorPage });
  const other = createRoute({
    getParentRoute: () => root,
    path: "/other",
    component: () => <p>Andere Seite</p>,
  });
  return createRouter({
    routeTree: root.addChildren([edit, other]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

describe("useUnsavedChangesGuard", () => {
  it("blockiert Router-Navigation bei echten Änderungen, lässt Navigation nach Speichern zu", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    const field = await screen.findByLabelText("feld");
    fireEvent.change(field, { target: { value: "x" } });

    fireEvent.click(screen.getByText("Weg"));
    expect(await screen.findByText("Ungespeicherte Änderungen verwerfen?")).toBeTruthy();
    fireEvent.click(screen.getByText("Weiter bearbeiten"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect((screen.getByLabelText("feld") as HTMLInputElement).value).toBe("x");

    fireEvent.click(screen.getByText("Speichern"));
    expect(await screen.findByText("Andere Seite")).toBeTruthy();
  });

  it("bestätigtes Verwerfen navigiert weiter", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    fireEvent.change(await screen.findByLabelText("feld"), { target: { value: "x" } });
    fireEvent.click(screen.getByText("Weg"));
    fireEvent.click(await screen.findByText("Verwerfen und verlassen"));
    expect(await screen.findByText("Andere Seite")).toBeTruthy();
  });
});
