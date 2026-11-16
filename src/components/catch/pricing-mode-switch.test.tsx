// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatchForm } from "@/components/catch/catch-form";
import { EMPTY_CATCH_FORM, type CatchFormValues } from "@/lib/catches";

const mocks = vi.hoisted(() => ({ save: vi.fn(), canEdit: true }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-role", () => ({ useRoles: () => ({ canEdit: mocks.canEdit }) }));
vi.mock("@/hooks/use-edit-session", () => ({
  useEditShortcuts: () => ({}),
  useUnsavedChangesGuard: () => ({ allowNextNavigation: vi.fn() }),
  UnsavedChangesDialog: () => null,
}));
vi.mock("@/lib/catches", async (original) => ({
  ...(await original<typeof import("@/lib/catches")>()),
  saveCatch: mocks.save,
  fetchSuppliers: async () => [],
  fetchLocations: async () => [],
}));
vi.mock("@/lib/app-settings", async (original) => {
  const actual = await original<typeof import("@/lib/app-settings")>();
  return {
    ...actual,
    fetchAppSettings: async () => ({
      vat: { rate: 2.6 },
      calculation_defaults: { internal_handling_cost_per_unit: 2.5 },
      template: actual.normalizeTemplate({}),
    }),
  };
});
vi.mock("@/lib/catch-images", async (original) => ({
  ...(await original<typeof import("@/lib/catch-images")>()),
  syncCatchImages: async () => undefined,
  removeStorageObjects: async () => {},
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) } },
}));
vi.mock("@/components/catch/catch-image-gallery", () => ({ CatchImageGallery: () => null }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue("catch-1");
});

const legacy: CatchFormValues = {
  ...EMPTY_CATCH_FORM,
  product_name: "Lachs",
  purchase_quantity: "20",
  quantity_unit: "kg",
  purchase_price: "6.70",
  catch_price: "20",
  regular_price: "30",
};

function renderForm(initial: CatchFormValues) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CatchForm
        mode="edit"
        catchId="catch-1"
        currentStatus="draft"
        initialImages={[]}
        initialValues={initial}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
const price = (id: string) => document.getElementById(id) as HTMLInputElement;

describe("Preisbasis-Wechsel", () => {
  it("übernimmt CHF/kg nie still als Packungspreis und stellt beim Zurückwechseln wieder her", async () => {
    renderForm(legacy);
    expect(price("catch_price").value).toBe("20");
    fireEvent.click(screen.getByRole("radio", { name: "Einkauf und Verkauf getrennt" }));
    await waitFor(() => expect(price("catch_price").value).toBe(""));
    expect(price("regular_price").value).toBe("");
    expect(screen.getByRole("status").textContent).toContain("pro Verkaufspackung");

    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const saved = mocks.save.mock.calls[0]![0].values as CatchFormValues;
    expect(saved.pricing_mode).toBe("pack");
    expect(saved.catch_price).toBe("");
    expect(saved.regular_price).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: "Gemeinsame Einheit" }));
    await waitFor(() => expect(price("catch_price").value).toBe("20"));
    expect(price("regular_price").value).toBe("30");
  });

  it("gespeicherter Catch ohne Wechsel behält seine Preise", async () => {
    renderForm(legacy);
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const saved = mocks.save.mock.calls[0]![0].values as CatchFormValues;
    expect(saved.catch_price).toBe("20");
    expect(saved.regular_price).toBe("30");
    expect(saved.pricing_mode).toBe("unit");
  });
});
