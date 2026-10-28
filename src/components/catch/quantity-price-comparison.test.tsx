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
it("hover can move into help content, then closes on leaving", async () => {
  render(<InfoHelp label="DB II">Aufwand pro vorbereitete Einheit.</InfoHelp>);
  const trigger = screen.getByRole("button", { name: "Info: DB II" });
  fireEvent.mouseEnter(trigger);
  const content = await screen.findByRole("dialog");
  fireEvent.mouseLeave(trigger);
  fireEvent.mouseEnter(content);
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(screen.getByRole("dialog")).toBe(content);
  fireEvent.mouseLeave(content);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("a deliberate click pins hover help until outside click or Escape", async () => {
  render(
    <>
      <InfoHelp label="DB II">Aufwand.</InfoHelp>
      <input aria-label="Outside" />
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Info: DB II" });
  fireEvent.mouseEnter(trigger);
  fireEvent.click(trigger);
  const content = await screen.findByRole("dialog");
  fireEvent.mouseLeave(trigger);
  fireEvent.mouseLeave(content);
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(screen.getByRole("dialog")).toBe(content);
  const outside = screen.getByLabelText("Outside");
  // happy-dom clears event.target after dispatch; Radix defers this event until click.
  const pointerDown = new MouseEvent("pointerdown", { bubbles: true, button: 0 });
  Object.defineProperty(pointerDown, "target", { value: outside });
  fireEvent(outside, pointerDown);
  fireEvent.click(outside);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
