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

const title = () =>
  screen.findByLabelText("Titel mit Teilen-Aufruf") as Promise<HTMLTextAreaElement>;

describe("Einstellungen › WhatsApp-Vorlage", () => {
  it("zeigt den Standardtitel, speichert Änderungen und lädt sie neu", async () => {
    renderSection();
    expect((await title()).value).toBe(DEFAULT_POST_HEADER);
    fireEvent.change(await title(), { target: { value: "🐟 *Neu*" } });
    expect(screen.getByText("Beispielvorschau")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]![1].header).toBe("🐟 *Neu*");
    expect(mocks.save.mock.calls[0]![2]).toBe(3);
    cleanup();
    renderSection();
    expect((await title()).value).toBe("🐟 *Neu*");
  });

  it("Standard wiederherstellen wirkt nur lokal; Verwerfen stellt Gespeichertes her", async () => {
    mocks.stored = { header: "Gespeichert" };
    renderSection();
    expect((await title()).value).toBe("Gespeichert");
    fireEvent.click(screen.getByRole("button", { name: "Standard wiederherstellen" }));
    expect((await title()).value).toBe(DEFAULT_POST_HEADER);
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect((await title()).value).toBe("Gespeichert");
  });

  it("ungültiger leerer Titel wird nicht gespeichert", async () => {
    renderSection();
    fireEvent.change(await title(), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("Viewer sieht die Vorlage nur lesend", async () => {
    mocks.isAdmin = false;
    renderSection();
    expect((await title()).closest("fieldset")?.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Speichern" })).toBeNull();
  });

  it("normalizeTemplate bleibt mit Speicherwert kompatibel", () => {
    expect(normalizeTemplate({ header: "X" }).header).toBe("X");
  });
});
