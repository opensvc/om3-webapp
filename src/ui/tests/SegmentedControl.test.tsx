import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SegmentedControl } from "../components/SegmentedControl";

describe("SegmentedControl", () => {
  test("a choice among icons, each named, the one chosen pressed; a click says the other", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Edit as"
        value="design"
        onChange={onChange}
        options={[
          { value: "design", label: "Design", icon: <svg /> },
          { value: "text", label: "Text", icon: <svg /> },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Edit as" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute("aria-pressed", "true");
    const text = screen.getByRole("button", { name: "Text" });
    expect(text).toHaveAttribute("aria-pressed", "false");
    expect(text).toHaveAttribute("title", "Text");
    fireEvent.click(text);
    expect(onChange).toHaveBeenCalledWith("text");
  });
});
