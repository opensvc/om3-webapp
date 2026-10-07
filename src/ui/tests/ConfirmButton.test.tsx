import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmButton } from "../components/ConfirmButton";

const LABELS = {
  label: "Delete",
  question: "Delete this node?",
  confirmLabel: "Yes, delete",
  cancelLabel: "Cancel",
  pendingLabel: "Deleting…",
};

describe("ConfirmButton", () => {
  test("shows only the arming button at first", () => {
    render(<ConfirmButton {...LABELS} icon={<svg data-testid="icon" />} onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  test("arming asks the question and focuses the confirm button", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmButton {...LABELS} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("group", { name: "Delete this node?" })).toBeInTheDocument();
    expect(screen.getByText("Delete this node?").tagName).toBe("P");
    expect(screen.getByRole("button", { name: "Yes, delete" })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("confirming calls onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmButton {...LABELS} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("cancelling disarms without confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmButton {...LABELS} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  test("pending, the confirm button shows the pending label and is disabled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { rerender } = render(<ConfirmButton {...LABELS} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    rerender(<ConfirmButton {...LABELS} pending onConfirm={onConfirm} />);
    const pending = screen.getByRole("button", { name: "Deleting…" });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("inline, the question is a span on the same line", async () => {
    const user = userEvent.setup();
    render(<ConfirmButton {...LABELS} inline onConfirm={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this node?").tagName).toBe("SPAN");
    expect(screen.getByRole("group")).toHaveClass("flex", "whitespace-nowrap");
  });
});
