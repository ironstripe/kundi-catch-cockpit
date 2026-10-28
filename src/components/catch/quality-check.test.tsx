// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SampleCheckCard } from "@/components/catch/sample-check-card";
import { draftCatch } from "@/test/catch-fixture";
import {
  recordQualityCheck,
  startSounding,
  completeSounding,
  submitReviewResponse,
} from "@/lib/sounding";
const state = vi.hoisted(() => ({
  canEdit: true,
  payload: null as unknown,
  result: { data: { id: "catch-1" }, error: null as Error | null },
  from: vi.fn(),
}));
vi.mock("@/hooks/use-role", () => ({ useRoles: () => ({ canEdit: state.canEdit }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: state.from } }));
beforeEach(() => {
  state.canEdit = true;
  state.payload = null;
  state.result = { data: { id: "catch-1" }, error: null };
  state.from.mockReset();
  const query = {
    update: (payload: unknown) => {
      state.payload = payload;
      return query;
    },
    eq: () => query,
    in: () => query,
    select: () => query,
    single: async () => state.result,
  };
  state.from.mockReturnValue(query);
});
afterEach(cleanup);
function show(status: "pending" | "passed" | "failed", lifecycle = "draft") {
  const item = {
    ...draftCatch,
    sample_check_status: status,
    sample_check_note: "Historische Notiz",
    status: lifecycle as typeof draftCatch.status,
  };
  const changed = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SampleCheckCard item={item} onChanged={changed} />
    </QueryClientProvider>,
  );
  return { changed, item };
}
it.each(["pending", "failed"] as const)(
  "%s stays unchecked until deliberate action; mark preserves notes",
  async (status) => {
    const { changed, item } = show(status);
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    expect(state.from).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(state.payload).toEqual({ sample_check_status: "passed" });
    expect(item.sample_check_note).toBe("Historische Notiz");
  },
);
it("uncheck records pending, never failed and never overwrites historical notes", async () => {
  show("passed");
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(state.payload).toEqual({ sample_check_status: "pending" }));
});
it("failed mark remains truthful with actionable error and retry", async () => {
  state.result.error = new Error("Keine Verbindung");
  const { changed } = show("pending");
  fireEvent.click(screen.getByRole("checkbox"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
  state.result.error = null;
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
});
it.each(["viewer", "closed", "cancelled"])("%s cannot toggle", (scope) => {
  state.canEdit = scope !== "viewer";
  show("pending", scope === "viewer" ? "draft" : scope);
  expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(state.from).not.toHaveBeenCalled();
});
it("inactive Sounding rejects every mutation helper before accessing the database", async () => {
  await expect(
    startSounding("catch", {} as Parameters<typeof startSounding>[1], ["user"]),
  ).rejects.toThrow("inaktiv");
  await expect(completeSounding("round")).rejects.toThrow("inaktiv");
  await expect(submitReviewResponse("round", "user", "approved", "")).rejects.toThrow("inaktiv");
  await expect(
    submitReviewResponse("round", "user", "question", "note", "existing"),
  ).rejects.toThrow("inaktiv");
  expect(state.from).not.toHaveBeenCalled();
});
it("permission errors from the existing authenticated write propagate", async () => {
  state.result.error = new Error("permission denied");
  await expect(recordQualityCheck("catch", true)).rejects.toThrow("permission denied");
});
