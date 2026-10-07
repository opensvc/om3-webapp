import type { ReactElement } from "react";
import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import * as icons from "../icons";

describe("icons", () => {
  const all = Object.entries(icons) as [string, (props: { className?: string }) => ReactElement][];

  test("the module exports icons only", () => {
    expect(all.length).toBeGreaterThan(50);
    for (const [name] of all) expect(name).toMatch(/Icon$/);
  });

  test.each(all)("%s renders a hidden, unfocusable svg taking a class", (_, Icon) => {
    const { container } = render(<Icon className="tint" />);
    const svg = container.firstElementChild;
    expect(svg?.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("fill", "currentColor");
    expect(svg).toHaveClass("tint");
    expect(svg?.childElementCount).toBeGreaterThan(0);
  });
});
