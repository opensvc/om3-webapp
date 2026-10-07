import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, IconButton } from "../components/Button";

describe("Button", () => {
  test("defaults to a secondary md button of type button", () => {
    render(<Button>Cancel</Button>);
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("border", "border-line", "h-8", "px-3");
  });

  test("keeps an explicit type", () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  test.each([
    ["primary", "bg-accent"],
    ["secondary", "bg-surface-raised"],
    ["danger", "bg-state-down"],
    ["ghost", "text-ink-muted"],
  ] as const)("the %s variant carries %s", (variant, className) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass(className);
  });

  test("the sm size is the toolbar height", () => {
    render(<Button size="sm">Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-7", "px-2");
  });

  test("merges the caller's classes, the caller winning a conflict", () => {
    render(<Button className="h-10 extra">Go</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("h-10", "extra");
    expect(button).not.toHaveClass("h-8");
  });

  test("places the icon before the label", () => {
    render(<Button icon={<svg data-testid="icon" />}>Refresh</Button>);
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button.firstChild).toBe(screen.getByTestId("icon"));
  });

  test("a disabled button does not call onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("calls onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("forwards its ref to the button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBe(screen.getByRole("button"));
  });
});

describe("IconButton", () => {
  test("takes its accessible name and tooltip from label", () => {
    render(
      <IconButton label="Close">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveAttribute("title", "Close");
    expect(button).toHaveAttribute("type", "button");
  });

  test("is outlined by default and bare on demand", () => {
    const { rerender } = render(
      <IconButton label="Close">
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("border", "border-line");
    rerender(
      <IconButton label="Close" bare>
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("border");
    expect(button).toHaveClass("hover:bg-surface-sunken");
  });

  test("forwards its ref and can be disabled", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton label="Close" ref={ref} disabled>
        <svg />
      </IconButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Close" }));
    expect(ref.current).toBeDisabled();
  });
});
