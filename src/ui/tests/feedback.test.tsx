import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert } from "../components/Alert";
import { Spinner } from "../components/Spinner";
import { Switch } from "../components/Switch";

describe("Alert", () => {
  test.each([
    ["error", "alert", "border-state-down"],
    ["warning", "alert", "border-state-warn"],
    ["success", "status", "border-state-up"],
    ["info", "status", "bg-surface-sunken"],
  ] as const)("the %s tone has role %s and class %s", (tone, role, className) => {
    render(<Alert tone={tone}>Message</Alert>);
    const alert = screen.getByRole(role);
    expect(alert).toHaveTextContent("Message");
    expect(alert).toHaveClass(className);
  });

  test("defaults to the error tone", () => {
    render(<Alert>Failed</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("border-state-down");
  });

  test("shows an icon except for info", () => {
    const { rerender } = render(<Alert tone="success">Done</Alert>);
    expect(screen.getByRole("status").querySelector("svg")).not.toBeNull();
    rerender(<Alert tone="info">Note</Alert>);
    expect(screen.getByRole("status").querySelector("svg")).toBeNull();
  });

  test("renders the action at the end of the strip", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <Alert
        action={
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        }
      >
        Failed
      </Alert>,
    );
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(screen.getByRole("alert").lastChild).toBe(retry);
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("Spinner", () => {
  test("is a status named Loading by default", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  test("takes a label", () => {
    render(<Spinner label="Fetching nodes" className="extra" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Fetching nodes");
    expect(status).toHaveClass("extra");
  });
});

describe("Switch", () => {
  test("is a switch reporting its state", () => {
    render(<Switch checked label="Frozen" stateLabel="yes" />);
    const toggle = screen.getByRole("switch", { name: "Frozen : yes" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAttribute("title", "yes");
  });

  test("calls onChange with the opposite value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Switch checked={false} label="Frozen" stateLabel="no" onChange={onChange} />,
    );
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Switch checked label="Frozen" stateLabel="yes" onChange={onChange} />);
    await user.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  test("toggles from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} label="Frozen" stateLabel="no" onChange={onChange} />);
    screen.getByRole("switch").focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("disabled, it does not call onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} disabled label="Frozen" stateLabel="no" onChange={onChange} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
    await user.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
