import { useRef, useState, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "../components/Dialog";

function Harness({
  footer,
  withInitialFocus = false,
  onClose,
  body = true,
}: {
  footer?: ReactNode;
  withInitialFocus?: boolean;
  onClose?: () => void;
  body?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const second = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        title="Impersonate"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        initialFocus={withInitialFocus ? second : undefined}
        footer={footer}
      >
        {body && (
          <>
            <input aria-label="First" />
            <input aria-label="Second" ref={second} />
          </>
        )}
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  test("renders nothing when closed", () => {
    render(
      <Dialog open={false} title="Hidden" onClose={() => {}}>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  test("renders a modal dialog labelled by its title, in document.body", () => {
    const { container } = render(
      <div style={{ overflow: "hidden" }}>
        <Dialog open title="Impersonate" onClose={() => {}}>
          <p>Body</p>
        </Dialog>
      </div>,
    );
    const dialog = screen.getByRole("dialog", { name: "Impersonate" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(container).not.toContainElement(dialog);
    expect(screen.getByTestId("dialog-backdrop").parentElement).toBe(document.body);
  });

  test("applies the width of its size", () => {
    render(<Dialog open size="lg" title="Wide" onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveClass("max-w-3xl");
  });

  test("moves the focus to the first control of the body", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("textbox", { name: "First" })).toHaveFocus();
  });

  test("moves the focus to initialFocus when given", async () => {
    const user = userEvent.setup();
    render(<Harness withInitialFocus />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("textbox", { name: "Second" })).toHaveFocus();
  });

  test("focuses the dialog itself when its body holds no control", async () => {
    const user = userEvent.setup();
    render(<Harness body={false} footer={<button type="button">Save</button>} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  test("Escape calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("Escape does not reach the listeners above the dialog", () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Dialog open title="T" onClose={() => {}} />
      </div>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(outer).not.toHaveBeenCalled();
  });

  test("the close button calls onClose, its label as accessible name and title", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog open title="T" closeLabel="Dismiss" onClose={onClose} />);
    const close = screen.getByRole("button", { name: "Dismiss" });
    expect(close).toHaveAttribute("title", "Dismiss");
    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a pointerdown on the backdrop closes, one on the panel does not", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="T" onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );
    fireEvent.pointerDown(screen.getByRole("dialog"));
    fireEvent.pointerDown(screen.getByText("Body"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Tab and Shift+Tab wrap the focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness footer={<button type="button">Save</button>} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });

    save.focus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(save).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("textbox", { name: "Second" })).toHaveFocus();
  });

  test("gives the focus back to the opener on close", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    expect(opener).not.toHaveFocus();
    await user.keyboard("{Escape}");
    expect(opener).toHaveFocus();
  });

  test("renders the footer only when given", () => {
    const { rerender } = render(<Dialog open title="T" onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    rerender(<Dialog open title="T" onClose={() => {}} footer={<button type="button">Save</button>} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
