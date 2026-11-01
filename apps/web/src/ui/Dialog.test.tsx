import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      <Dialog
        open={open}
        title="Delete notebook?"
        onClose={() => {
          setOpen(false);
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>Alpha will be deleted.</p>
      </Dialog>
    </>
  );
}

afterEach(() => {
  cleanup();
});

test("focuses the first action, traps Tab and closes on Escape", async () => {
  const user = userEvent.setup();

  render(<Harness />);

  const open = screen.getByRole("button", { name: "Open" });

  await user.click(open);

  const dialog = screen.getByRole("dialog", { name: "Delete notebook?" });
  const cancel = screen.getByRole("button", { name: "Cancel" });
  const remove = screen.getByRole("button", { name: "Delete" });

  expect(dialog).toBeInTheDocument();
  expect(cancel).toHaveFocus();

  await user.tab();
  expect(remove).toHaveFocus();

  await user.tab();
  expect(cancel).toHaveFocus();

  await user.tab({ shift: true });
  expect(remove).toHaveFocus();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(open).toHaveFocus();
});
