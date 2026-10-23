// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { CatchForm } from "@/components/catch/catch-form";
import { PublicationWorkspace } from "@/components/catch/publication-workspace";
import { EMPTY_CATCH_FORM } from "@/lib/catches";
import { draftCatch } from "@/test/catch-fixture";

const mocks = vi.hoisted(() => ({
  save: vi.fn(), sync: vi.fn(), publish: vi.fn(), saveText: vi.fn(), copy: vi.fn(),
  canEdit: true,
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-role", () => ({ useRoles: () => ({ canEdit: mocks.canEdit }) }));
vi.mock("@/hooks/use-edit-session", () => ({
  useEditShortcuts: () => ({}),
  useUnsavedChangesGuard: () => ({ allowNextNavigation: vi.fn() }),
  UnsavedChangesDialog: () => null,
}));
vi.mock("@/lib/catches", async (original) => ({
  ...(await original<typeof import("@/lib/catches")>()),
  saveCatch: mocks.save, fetchSuppliers: async () => [], fetchLocations: async () => [],
}));
vi.mock("@/lib/app-settings", async (original) => ({
  ...(await original<typeof import("@/lib/app-settings")>()), fetchAppSettings: async () => ({ vat: { rate: 2.6 }, calculation_defaults: { internal_handling_cost_per_unit: 2.5 } }),
}));
vi.mock("@/lib/catch-images", async (original) => ({
  ...(await original<typeof import("@/lib/catch-images")>()),
  syncCatchImages: mocks.sync, removeStorageObjects: async () => {},
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: null } }) },
} }));
vi.mock("@/lib/publication", async (original) => ({
  ...(await original<typeof import("@/lib/publication")>()),
  ensureOptimizedImage: async () => null,
  savePostVersion: mocks.saveText, markCatchPublished: mocks.publish,
}));
vi.mock("@/lib/whatsapp-image", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp-image")>()), supportsTextClipboard: () => true,
}));
// Image rendering/storage has its own real StrictMode/upload regression suite.
vi.mock("@/components/catch/catch-image-gallery", () => ({ CatchImageGallery: () => null }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks(); mocks.canEdit = true;
  mocks.save.mockResolvedValue("catch-1"); mocks.sync.mockResolvedValue(undefined);
  mocks.saveText.mockResolvedValue(undefined); mocks.publish.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.copy } });
  mocks.copy.mockResolvedValue(undefined);
});
function wrap(content: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{content}</QueryClientProvider>;
}
describe("saved draft → WhatsApp preparation", () => {
  it.each(["pending", "failed", "passed"] as const)("%s sample and no Sounding: save/open/copy without status transition", async (sample) => {
    function Flow() {
      const [open, setOpen] = useState(false);
      return open ? <PublicationWorkspace item={{ ...draftCatch, sample_check_status: sample, catch_price: null, regular_price: null, locations: [], available_from: null, handicap_story: null }} onChanged={vi.fn()} /> :
        <CatchForm mode="edit" catchId="catch-1" currentStatus="draft" initialImages={draftCatch.images}
          initialValues={{ ...EMPTY_CATCH_FORM, product_name: "Silberlachs-Filet" }}
          onSaved={(_id, _status, prepare) => setOpen(Boolean(prepare))} />;
    }
    render(wrap(<Flow />));
    fireEvent.click(screen.getByRole("button", { name: "Speichern und WhatsApp-Post vorbereiten" }));
    await waitFor(() => expect(screen.getByLabelText("WhatsApp-Post-Text")).toBeTruthy());
    expect(mocks.save.mock.calls[0]?.[0].status).toBe("draft");
    expect(mocks.sync.mock.calls[0]?.[2]).toHaveLength(1);
    const text = (screen.getByLabelText("WhatsApp-Post-Text") as HTMLTextAreaElement).value;
    expect(text).toContain("Silberlachs-Filet"); expect(text).not.toContain("CHF");
    expect(text).not.toContain("Abholen"); expect(text).not.toContain("Verfügbar ab");
    fireEvent.click(screen.getByRole("button", { name: "Text kopieren" }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith(text));
    fireEvent.click(screen.getByRole("button", { name: "Text sichern" }));
    await waitFor(() => expect(mocks.saveText).toHaveBeenCalledTimes(1));
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Als publiziert markieren" }));
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ja, als publiziert markieren" }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
  });
  it("two saved images reach synchronization intact; preparation preserves ready status without complete calculation", async () => {
    const images = [...draftCatch.images, { id: "img-2", storage_path: "second.jpg", is_primary: false, sort_order: 1 }];
    const onSaved = vi.fn();
    render(wrap(<CatchForm mode="edit" catchId="catch-1" currentStatus="ready" initialImages={images}
      initialValues={{ ...EMPTY_CATCH_FORM, product_name: "Fisch" }} onSaved={onSaved} />));
    fireEvent.click(screen.getByRole("button", { name: "Speichern und WhatsApp-Post vorbereiten" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("catch-1", "ready", true));
    expect(mocks.sync.mock.calls[0]?.[2].map((image: { storagePath: string }) => image.storagePath)).toEqual([draftCatch.image_path, "second.jpg"]);
    expect(mocks.save.mock.calls[0]?.[0].status).toBe("ready");
  });
  it.each(["viewer", "closed", "cancelled"])("%s cannot edit/save", async (state) => {
    mocks.canEdit = state !== "viewer";
    render(wrap(<CatchForm mode="edit" currentStatus={state === "viewer" ? "draft" : state as "closed" | "cancelled"}
      initialImages={[]} initialValues={{ ...EMPTY_CATCH_FORM, product_name: "Fisch" }} onSaved={vi.fn()} />));
    expect((screen.getByRole("button", { name: "Speichern und WhatsApp-Post vorbereiten" }) as HTMLButtonElement).closest("fieldset")?.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Speichern und WhatsApp-Post vorbereiten" }));
    expect(mocks.save).not.toHaveBeenCalled();
  });
});