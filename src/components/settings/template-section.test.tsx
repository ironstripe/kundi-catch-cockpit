// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateSection } from "@/components/settings/template-section";
import { DEFAULT_POST_HEADER, normalizeTemplate } from "@/lib/app-settings";

const mocks = vi.hoisted(() => ({
  isAdmin: true,
  stored: {} as Record<string, unknown>,
  version: 3,
  save: vi.fn(),
}));
vi.mock("@/hooks/use-role", () => ({ useRoles: () => ({ isAdmin: mocks.isAdmin }) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/app-settings", async (original) => {
  const actual = await original<typeof import("@/lib/app-settings")>();
  return {
    ...actual,
    fetchAppSettings: async () => ({
      template: actual.normalizeTemplate(mocks.stored),
      template_version: mocks.version,
    }),
    saveSetting: mocks.save,
  };
});

afterEach(cleanup);
beforeEach(() => {
  mocks.isAdmin = true;
  mocks.stored = {};
  mocks.version = 3;
  mocks.save.mockReset();
  mocks.save.mockImplementation(async (_k: string, value: Record<string, unknown>) => {
    mocks.stored = value;
    mocks.version += 1;
  });
});

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TemplateSection />
    </QueryClientProvider>,
  );
}

const editor = () => screen.findByLabelText("Vorlagentext") as Promise<HTMLTextAreaElement>;

describe("Einstellungen › WhatsApp-Vorlage", () => {
  it("ein Textfeld mit Standardtext; speichert Text, behält Altwerte, lädt neu", async () => {
    mocks.stored = { hidden_blocks: ["claim"], show_expiry: false, extra: 1 };
    renderSection();
    const area = await editor();
    expect(area.value.startsWith(DEFAULT_POST_HEADER)).toBe(true);
    expect(area.value).toContain("{{catch}}");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("button", { name: /nach oben|nach unten/ })).toBeNull();
    expect(screen.queryByText("Beispielvorschau")).toBeNull();
    fireEvent.change(area, { target: { value: "🐟 *Neu*\nZeile\n\n{{catch}}" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved = mocks.save.mock.calls[0]![1];
    expect(saved.text).toBe("🐟 *Neu*\nZeile\n\n{{catch}}");
    expect(saved.extra).toBe(1);
    expect(mocks.save.mock.calls[0]![2]).toBe(3);
    cleanup();
    renderSection();
    expect((await editor()).value).toBe("🐟 *Neu*\nZeile\n\n{{catch}}");
  });

  it("gespeicherte eigene Altformulierung erscheint im Text", async () => {
    mocks.stored = { header: "Teilt bitte!", intro: "Hallo", claim: "", footer: "Danke" };
    renderSection();
    expect((await editor()).value).toBe("Teilt bitte!\n\nHallo\n\n{{catch}}\n\nDanke");
  });

  it("fehlender Platzhalter wird beim Speichern sichtbar ergänzt", async () => {
    renderSection();
    fireEvent.change(await editor(), { target: { value: "Nur Text" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]![1].text).toBe("Nur Text\n\n{{catch}}");
    await waitFor(async () => expect((await editor()).value).toBe("Nur Text\n\n{{catch}}"));
  });

  it("Standard wiederherstellen wirkt nur lokal; Verwerfen stellt Gespeichertes her", async () => {
    mocks.stored = { text: "Gespeichert {{catch}}" };
    renderSection();
    expect((await editor()).value).toBe("Gespeichert {{catch}}");
    fireEvent.click(screen.getByRole("button", { name: "Standard wiederherstellen" }));
    expect((await editor()).value.startsWith(DEFAULT_POST_HEADER)).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect((await editor()).value).toBe("Gespeichert {{catch}}");
  });

  it("leerer Text wird nicht gespeichert", async () => {
    renderSection();
    fireEvent.change(await editor(), { target: { value: " {{catch}} " } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("Viewer sieht die Vorlage nur lesend", async () => {
    mocks.isAdmin = false;
    renderSection();
    expect((await editor()).closest("fieldset")?.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Speichern" })).toBeNull();
  });

  it("normalizeTemplate bleibt mit Speicherwert kompatibel", () => {
    expect(normalizeTemplate({ header: "X" }).header).toBe("X");
  });
});
