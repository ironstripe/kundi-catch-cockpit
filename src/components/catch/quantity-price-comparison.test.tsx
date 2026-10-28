// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { QuantityPriceComparison } from "@/components/catch/quantity-price-comparison";
import { InfoHelp } from "@/components/ui/info-help";

afterEach(cleanup);
it("switching Catch identity resets competitor entries and known sold weight", () => {
  const view = render(<QuantityPriceComparison key="one" grossPrice={10} quantityUnit="Stk" />);
  fireEvent.change(screen.getByLabelText("Vergleich: Packpreis inkl. MWST"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("Nettofüllmenge der Packung"), {
    target: { value: "500" },
  });
  fireEvent.change(screen.getByLabelText("Nettogewicht pro Verkaufseinheit"), {
    target: { value: "500" },
  });
  view.rerender(<QuantityPriceComparison key="two" grossPrice={12} quantityUnit="Stk" />);
  expect((screen.getByLabelText("Vergleich: Packpreis inkl. MWST") as HTMLInputElement).value).toBe(
    "",
  );
  expect(
    (screen.getByLabelText("Nettogewicht pro Verkaufseinheit") as HTMLInputElement).value,
  ).toBe("");
});
it("deliberate touch/click, keyboard focus and Escape operate help", async () => {
  render(<InfoHelp label="DB II">Aufwand pro vorbereitete Einheit.</InfoHelp>);
  fireEvent.click(screen.getByRole("button", { name: "Info: DB II" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.focus(screen.getByRole("button", { name: "Info: DB II" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
});
