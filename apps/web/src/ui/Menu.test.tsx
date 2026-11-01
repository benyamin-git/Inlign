import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { Menu } from "./Menu.tsx";
import type { MenuItem } from "./Menu.tsx";

function renderMenu(items: MenuItem[]) {
  render(
    <>
      <Menu label="Actions for Alpha" items={items}>
        <span>icon</span>
      </Menu>
      <button type="button">Elsewhere</button>
    </>,
  );

  return screen.getByRole("button", { name: "Actions for Alpha" });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("closes when clicking outside the menu", async () => {
  const user = userEvent.setup();
  const trigger = renderMenu([{ id: "rename", label: "Rename", onSelect: vi.fn() }]);

  await user.click(trigger);
  expect(screen.getByRole("menu")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Elsewhere" }));

  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

test("closes on Tab and returns focus to the trigger", async () => {
  const user = userEvent.setup();
  const trigger = renderMenu([{ id: "rename", label: "Rename", onSelect: vi.fn() }]);

  await user.click(trigger);
  expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();

  await user.tab();

  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test("flips above the trigger when the menu would overflow the bottom", async () => {
  const user = userEvent.setup();
  const trigger = renderMenu([{ id: "rename", label: "Rename", onSelect: vi.fn() }]);

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute("aria-haspopup") === "menu") {
      return rect(100, 700, 40, 20);
    }

    if (this.getAttribute("role") === "menu") {
      return rect(100, 0, 200, 300);
    }

    return rect(0, 0, 0, 0);
  });

  await user.click(trigger);

  const menu = screen.getByRole("menu");

  expect(Number.parseFloat(menu.style.top)).toBeLessThan(700);
  expect(menu.style.maxHeight).toBe("300px");
  expect(menu).toHaveClass("overflow-y-auto");
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    left,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}
